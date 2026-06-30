/**
 * Template editor component — spec: template-editor-ux.md
 *
 * Single-column layout: header → name/specialty fields → block list → add-block palette.
 * No preview panel (template content is structural, not clinical).
 * One save action (no versioning, no autosave).
 */

import { useReducer, useCallback, useRef, useEffect, useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { toast } from 'sonner'
import { templateEditorWidgetStrings } from './strings'
import type { ProtocolTemplateDto } from '@rezeta/shared'
import {
  Button,
  Badge,
  Callout,
  Checkbox,
  Field,
  Input,
  NativeSelect,
  Textarea,
  AddBlockButton,
  ConfirmDialog,
} from '@/components/ui'

// ─── Category option (subset of ProtocolCategoryDto needed by the editor) ──────

export interface CategoryOption {
  id: string
  name: string
  color: string
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type BlockType =
  | 'section'
  | 'text'
  | 'checklist'
  | 'steps'
  | 'decision'
  | 'dosage_table'
  | 'alert'

export interface TemplateBlock {
  id: string
  type: BlockType
  title?: string | undefined
  description?: string | undefined
  placeholder?: string | undefined
  required?: boolean | undefined
  // section only
  collapsed_by_default?: boolean | undefined
  blocks?: TemplateBlock[] | undefined
}

export interface TemplateEditorState {
  name: string
  blocks: TemplateBlock[]
  expandedBlockId: string | null
  isDirty: boolean
}

// ─── Schema output ────────────────────────────────────────────────────────────

export interface TemplateSchema {
  version: string
  metadata?: { intended_use?: string | undefined } | undefined
  blocks: unknown[]
}

function blockToSchema(b: TemplateBlock): unknown {
  const base: Record<string, unknown> = { id: b.id, type: b.type }
  if (b.required !== undefined) base['required'] = b.required
  if (b.placeholder !== undefined) base['placeholder'] = b.placeholder
  if (b.type === 'section') {
    if (b.title) base['title'] = b.title
    if (b.description) base['description'] = b.description
    if (b.collapsed_by_default) base['collapsed_by_default'] = true
    base['placeholder_blocks'] = (b.blocks ?? []).map(blockToSchema)
  } else {
    if (b.title) base['title'] = b.title
  }
  return base
}

export function buildSchema(state: TemplateEditorState): TemplateSchema {
  return {
    version: '1.0',
    blocks: state.blocks.map(blockToSchema),
  }
}

// ─── State from existing template ─────────────────────────────────────────────

interface RawBlock {
  id?: unknown
  type?: unknown
  title?: unknown
  description?: unknown
  placeholder?: unknown
  required?: unknown
  collapsed_by_default?: unknown
  placeholder_blocks?: unknown
  blocks?: unknown
}

function isRecord(value: unknown): value is RawBlock {
  return typeof value === 'object' && value !== null
}

function parseBlocks(raw: unknown): TemplateBlock[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(isRecord).map((b) => {
    const block: TemplateBlock = {
      id: typeof b.id === 'string' ? b.id : genId('blk'),
      type: (typeof b.type === 'string' ? b.type : 'text') as BlockType,
    }
    if (typeof b.title === 'string') block.title = b.title
    if (typeof b.description === 'string') block.description = b.description
    if (typeof b.placeholder === 'string') block.placeholder = b.placeholder
    if (typeof b.required === 'boolean') block.required = b.required
    if (block.type === 'section') {
      const children = Array.isArray(b.placeholder_blocks)
        ? b.placeholder_blocks
        : Array.isArray(b.blocks)
          ? b.blocks
          : []
      block.blocks = parseBlocks(children)
      if (typeof b.collapsed_by_default === 'boolean') {
        block.collapsed_by_default = b.collapsed_by_default
      }
    }
    return block
  })
}

export function stateFromTemplate(template: ProtocolTemplateDto): TemplateEditorState {
  const schema = template.schema as { blocks?: unknown[] } | null
  return {
    name: template.name,
    blocks: parseBlocks(schema?.blocks ?? []),
    expandedBlockId: null,
    isDirty: false,
  }
}

// ─── ID generator ─────────────────────────────────────────────────────────────

function rand() {
  return Math.random().toString(36).slice(2, 7)
}
export function genId(prefix: string): string {
  return `${prefix}_${rand()}${rand()}`
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

type Action =
  | { type: 'SET_NAME'; value: string }
  | { type: 'TOGGLE_EXPAND'; id: string }
  | {
      type: 'UPDATE_BLOCK'
      id: string
      patch: Partial<TemplateBlock>
      parentId?: string | undefined
    }
  | {
      type: 'ADD_BLOCK'
      blockType: BlockType
      parentId?: string | undefined
      afterId?: string | undefined
    }
  | { type: 'DELETE_BLOCK'; id: string; parentId?: string | undefined }
  | { type: 'MOVE_BLOCK'; id: string; direction: 'up' | 'down'; parentId?: string | undefined }
  | { type: 'REORDER_BLOCKS'; activeId: string; overId: string; parentId?: string | undefined }
  | { type: 'MARK_CLEAN' }

function newBlock(blockType: BlockType): TemplateBlock {
  return {
    id: genId(blockType === 'section' ? 'sec' : 'blk'),
    type: blockType,
    required: false,
    ...(blockType === 'section' ? { title: '', blocks: [] } : {}),
  }
}

function updateBlockInList(
  blocks: TemplateBlock[],
  id: string,
  patch: Partial<TemplateBlock>,
  parentId?: string,
): TemplateBlock[] {
  if (parentId) {
    return blocks.map((b) =>
      b.id === parentId && b.type === 'section'
        ? { ...b, blocks: updateBlockInList(b.blocks ?? [], id, patch) }
        : b,
    )
  }
  return blocks.map((b) => (b.id === id ? { ...b, ...patch } : b))
}

function insertAfter(
  blocks: TemplateBlock[],
  block: TemplateBlock,
  afterId?: string,
): TemplateBlock[] {
  if (!afterId) return [...blocks, block]
  const idx = blocks.findIndex((b) => b.id === afterId)
  if (idx === -1) return [...blocks, block]
  return [...blocks.slice(0, idx + 1), block, ...blocks.slice(idx + 1)]
}

function deleteBlock(blocks: TemplateBlock[], id: string, parentId?: string): TemplateBlock[] {
  if (parentId) {
    return blocks.map((b) =>
      b.id === parentId && b.type === 'section'
        ? { ...b, blocks: deleteBlock(b.blocks ?? [], id) }
        : b,
    )
  }
  return blocks.filter((b) => b.id !== id)
}

function moveBlock(
  blocks: TemplateBlock[],
  id: string,
  direction: 'up' | 'down',
  parentId?: string,
): TemplateBlock[] {
  if (parentId) {
    return blocks.map((b) =>
      b.id === parentId && b.type === 'section'
        ? { ...b, blocks: moveBlock(b.blocks ?? [], id, direction) }
        : b,
    )
  }
  const idx = blocks.findIndex((b) => b.id === id)
  if (idx === -1) return blocks
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1
  if (swapIdx < 0 || swapIdx >= blocks.length) return blocks
  const result = [...blocks]
  ;[result[idx], result[swapIdx]] = [result[swapIdx]!, result[idx]!]
  return result
}

function reorderBlocks(
  blocks: TemplateBlock[],
  activeId: string,
  overId: string,
  parentId?: string,
): TemplateBlock[] {
  if (parentId) {
    return blocks.map((b) =>
      b.id === parentId && b.type === 'section'
        ? { ...b, blocks: reorderBlocks(b.blocks ?? [], activeId, overId) }
        : b,
    )
  }
  const oldIdx = blocks.findIndex((b) => b.id === activeId)
  const newIdx = blocks.findIndex((b) => b.id === overId)
  if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return blocks
  const result = [...blocks]
  const [moved] = result.splice(oldIdx, 1)
  result.splice(newIdx, 0, moved!)
  return result
}

function reducer(state: TemplateEditorState, action: Action): TemplateEditorState {
  switch (action.type) {
    case 'SET_NAME':
      return { ...state, name: action.value, isDirty: true }
    case 'TOGGLE_EXPAND':
      return { ...state, expandedBlockId: state.expandedBlockId === action.id ? null : action.id }
    case 'UPDATE_BLOCK':
      return {
        ...state,
        isDirty: true,
        blocks: updateBlockInList(state.blocks, action.id, action.patch, action.parentId),
      }
    case 'ADD_BLOCK': {
      const block = newBlock(action.blockType)
      if (action.blockType === 'section') {
        return {
          ...state,
          isDirty: true,
          blocks: insertAfter(state.blocks, block, action.afterId),
          expandedBlockId: block.id,
        }
      }
      if (action.parentId) {
        const newBlocks = state.blocks.map((b) => {
          if (b.id !== action.parentId || b.type !== 'section') return b
          return { ...b, blocks: insertAfter(b.blocks ?? [], block, action.afterId) }
        })
        return { ...state, isDirty: true, blocks: newBlocks, expandedBlockId: block.id }
      }
      return {
        ...state,
        isDirty: true,
        blocks: insertAfter(state.blocks, block, action.afterId),
        expandedBlockId: block.id,
      }
    }
    case 'DELETE_BLOCK':
      return {
        ...state,
        isDirty: true,
        blocks: deleteBlock(state.blocks, action.id, action.parentId),
        expandedBlockId: state.expandedBlockId === action.id ? null : state.expandedBlockId,
      }
    case 'MOVE_BLOCK':
      return {
        ...state,
        isDirty: true,
        blocks: moveBlock(state.blocks, action.id, action.direction, action.parentId),
      }
    case 'REORDER_BLOCKS':
      return {
        ...state,
        isDirty: true,
        blocks: reorderBlocks(state.blocks, action.activeId, action.overId, action.parentId),
      }
    case 'MARK_CLEAN':
      return { ...state, isDirty: false }
    default:
      return state
  }
}

// ─── Block type labels ────────────────────────────────────────────────────────

const TYPE_LABELS: Record<BlockType, string> = {
  section: 'SECCIÓN',
  text: 'TEXTO',
  checklist: 'CHECKLIST',
  steps: 'PASOS',
  decision: 'DECISIÓN',
  dosage_table: 'TABLA DOSIS',
  alert: 'ALERTA',
}

// ─── BlockRow ─────────────────────────────────────────────────────────────────

interface BlockRowProps {
  block: TemplateBlock
  isExpanded: boolean
  isLocked: boolean
  parentId?: string | undefined
  onToggle: (id: string) => void
  onUpdate: (id: string, patch: Partial<TemplateBlock>, parentId?: string) => void
  onDelete: (id: string, parentId?: string) => void
  onMove: (id: string, direction: 'up' | 'down', parentId?: string) => void
  onAddChild: (blockType: BlockType, parentId: string) => void
  dragListeners?: ReturnType<typeof useSortable>['listeners']
  dragAttributes?: ReturnType<typeof useSortable>['attributes']
  style?: React.CSSProperties
  dragRef?: (node: HTMLElement | null) => void
}

function BlockRow({
  block,
  isExpanded,
  isLocked,
  parentId,
  onToggle,
  onUpdate,
  onDelete,
  onMove,
  onAddChild,
  dragListeners,
  dragAttributes,
  style,
  dragRef,
}: BlockRowProps) {
  const isSection = block.type === 'section'
  const displayTitle = block.title ?? block.placeholder ?? templateEditorWidgetStrings.noTitle
  const isRequired = block.required ?? false
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <div
      ref={dragRef}
      style={{
        ...style,
        marginBottom: 'var(--space-2)',
        ...(isSection
          ? {
              background: 'var(--color-n-0)',
              border: '1px solid var(--color-n-200)',
              borderRadius: 'var(--radius-md)',
              borderLeft: '2px solid var(--color-p-500)',
            }
          : {
              background: 'var(--color-n-0)',
              border: '1px solid var(--color-n-100)',
              borderRadius: 'var(--radius-sm)',
            }),
      }}
    >
      <ConfirmDialog
        open={confirmOpen}
        title={templateEditorWidgetStrings.delete}
        description={templateEditorWidgetStrings.deleteSectionConfirm(
          block.title ?? '—',
          block.blocks?.length ?? 0,
        )}
        confirmLabel={templateEditorWidgetStrings.delete}
        variant="danger"
        onConfirm={() => {
          onDelete(block.id, parentId)
          setConfirmOpen(false)
        }}
        onCancel={() => setConfirmOpen(false)}
      />
      {/* Collapsed row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          padding: isSection ? '10px 14px' : '8px 12px',
          cursor: 'pointer',
          background: isSection ? 'var(--color-n-25)' : undefined,
          borderBottom: isExpanded ? '1px solid var(--color-n-100)' : undefined,
          borderRadius: isExpanded ? 'var(--radius-sm) var(--radius-sm) 0 0' : 'var(--radius-sm)',
        }}
        onClick={() => onToggle(block.id)}
      >
        {/* Drag handle */}
        {!isLocked && (
          <span
            {...dragListeners}
            {...dragAttributes}
            onClick={(e) => e.stopPropagation()}
            style={{
              cursor: 'grab',
              color: 'var(--color-n-300)',
              fontSize: 16,
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            <i className="ph ph-dots-six-vertical" />
          </span>
        )}

        {/* Type chip */}
        <span
          style={{
            fontSize: 10,
            fontFamily: 'var(--font-mono)',
            fontWeight: 500,
            color: 'var(--color-p-700)',
            background: 'var(--color-p-50)',
            border: '1px solid var(--color-p-100)',
            borderRadius: 'var(--radius-sm)',
            padding: '2px 6px',
            letterSpacing: '0.04em',
            flexShrink: 0,
          }}
        >
          {TYPE_LABELS[block.type]}
        </span>

        {/* Title */}
        <span
          style={{
            flex: 1,
            fontSize: 13,
            color: block.title ? 'var(--color-n-800)' : 'var(--color-n-400)',
            fontStyle: block.title ? undefined : 'italic',
            fontWeight: isSection ? 500 : 400,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
          }}
        >
          {displayTitle}
        </span>

        {/* Required toggle */}
        {!isLocked && (
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              cursor: 'pointer',
              flexShrink: 0,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={isRequired}
              onChange={(e) => onUpdate(block.id, { required: e.target.checked }, parentId)}
            />
            <span
              style={{
                fontSize: 11.5,
                color: 'var(--color-n-600)',
                fontFamily: 'var(--font-sans)',
              }}
            >
              {isSection
                ? templateEditorWidgetStrings.requiredSectionLabel
                : templateEditorWidgetStrings.requiredLabel}
            </span>
          </label>
        )}

        {/* Context menu */}
        {!isLocked && (
          <div
            style={{ display: 'flex', gap: 2, flexShrink: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="sm"
              className="w-[28px] px-0"
              title={templateEditorWidgetStrings.moveUp}
              onClick={() => onMove(block.id, 'up', parentId)}
            >
              <i className="ph ph-caret-up text-[14px]" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-[28px] px-0"
              title={templateEditorWidgetStrings.moveDown}
              onClick={() => onMove(block.id, 'down', parentId)}
            >
              <i className="ph ph-caret-down text-[14px]" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-[28px] px-0"
              title={
                isRequired
                  ? templateEditorWidgetStrings.requiredTooltip
                  : templateEditorWidgetStrings.delete
              }
              disabled={isRequired}
              onClick={() => {
                if (isRequired) return
                if (isSection && (block.blocks?.length ?? 0) > 0) {
                  setConfirmOpen(true)
                  return
                }
                onDelete(block.id, parentId)
              }}
            >
              <i
                className="ph ph-trash text-[14px]"
                style={{
                  color: isRequired ? 'var(--color-n-300)' : 'var(--color-danger-text)',
                }}
              />
            </Button>
          </div>
        )}
      </div>

      {/* Expanded detail panel */}
      {isExpanded && (
        <div
          style={{
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
          }}
        >
          {isSection ? (
            <>
              <Field label={templateEditorWidgetStrings.sectionTitleLabel}>
                <Input
                  value={block.title ?? ''}
                  disabled={isLocked}
                  onChange={(e) =>
                    onUpdate(block.id, { title: e.target.value || undefined }, parentId)
                  }
                  placeholder={templateEditorWidgetStrings.sectionTitlePlaceholder}
                />
              </Field>
              <Field label={templateEditorWidgetStrings.sectionDescLabel}>
                <Input
                  value={block.description ?? ''}
                  disabled={isLocked}
                  onChange={(e) =>
                    onUpdate(block.id, { description: e.target.value || undefined }, parentId)
                  }
                  placeholder={templateEditorWidgetStrings.blockDescriptionPlaceholder}
                />
              </Field>
            </>
          ) : (
            <>
              <Field label={templateEditorWidgetStrings.blockTitleOptional}>
                <Input
                  value={block.title ?? ''}
                  disabled={isLocked}
                  onChange={(e) =>
                    onUpdate(block.id, { title: e.target.value || undefined }, parentId)
                  }
                  placeholder={`Ej. ${TYPE_LABELS[block.type]}`}
                />
              </Field>
              <Field label={templateEditorWidgetStrings.placeholderHint}>
                <Textarea
                  value={block.placeholder ?? ''}
                  disabled={isLocked}
                  rows={2}
                  onChange={(e) =>
                    onUpdate(block.id, { placeholder: e.target.value || undefined }, parentId)
                  }
                  placeholder={templateEditorWidgetStrings.blockPlaceholderInstruction}
                />
              </Field>
            </>
          )}
        </div>
      )}

      {/* Child blocks (sections only) */}
      {isSection && (
        <div style={{ padding: '0 0 8px 0' }}>
          {(block.blocks ?? []).length > 0 && (
            <ChildBlockList
              blocks={block.blocks ?? []}
              parentId={block.id}
              expandedBlockId={null}
              isLocked={isLocked}
              onToggle={onToggle}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onMove={onMove}
              onAddChild={onAddChild}
            />
          )}
          {!isLocked && (
            <div style={{ padding: '4px 12px 0' }}>
              <AddBlockButton
                onClick={() => onAddChild('text', block.id)}
                label={templateEditorWidgetStrings.addBlockLabel}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── SortableBlockRow ─────────────────────────────────────────────────────────

interface SortableBlockRowProps extends Omit<
  BlockRowProps,
  'isExpanded' | 'dragListeners' | 'dragAttributes' | 'style' | 'dragRef'
> {
  expandedBlockId: string | null
}

function SortableBlockRow({ block, expandedBlockId, isLocked, ...rest }: SortableBlockRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
    disabled: isLocked,
  })

  return (
    <BlockRow
      block={block}
      isExpanded={expandedBlockId === block.id}
      isLocked={isLocked}
      dragListeners={listeners}
      dragAttributes={attributes}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      dragRef={setNodeRef}
      {...rest}
    />
  )
}

// ─── ChildBlockList ───────────────────────────────────────────────────────────

interface ChildBlockListProps {
  blocks: TemplateBlock[]
  parentId: string
  expandedBlockId: string | null
  isLocked: boolean
  onToggle: (id: string) => void
  onUpdate: (id: string, patch: Partial<TemplateBlock>, parentId?: string) => void
  onDelete: (id: string, parentId?: string) => void
  onMove: (id: string, direction: 'up' | 'down', parentId?: string) => void
  onAddChild: (blockType: BlockType, parentId: string) => void
}

function ChildBlockList({
  blocks,
  parentId,
  expandedBlockId,
  isLocked,
  onToggle,
  onUpdate,
  onDelete,
  onMove,
  onAddChild,
}: ChildBlockListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={() => {}}>
      <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
        <div style={{ padding: '4px 12px 0' }}>
          {blocks.map((child) => (
            <SortableBlockRow
              key={child.id}
              block={child}
              expandedBlockId={expandedBlockId}
              isLocked={isLocked}
              parentId={parentId}
              onToggle={onToggle}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onMove={onMove}
              onAddChild={onAddChild}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

// ─── TemplateEditor ───────────────────────────────────────────────────────────

interface TemplateEditorProps {
  initialState: TemplateEditorState
  isLocked: boolean
  blockingTypeIds?: string[] | undefined
  isSaving: boolean
  isSaveDisabled?: boolean
  categories: CategoryOption[]
  categoryId: string
  onCategoryChange: (categoryId: string) => void
  onSave: (name: string, schema: TemplateSchema) => void
  onCancel: () => void
}

export function TemplateEditor({
  initialState,
  isLocked,
  blockingTypeIds = [],
  isSaving,
  isSaveDisabled = false,
  categories,
  categoryId,
  onCategoryChange,
  onSave,
  onCancel,
}: TemplateEditorProps): JSX.Element {
  const [state, dispatch] = useReducer(reducer, initialState)
  const nameRef = useRef<HTMLInputElement>(null)
  const selectedCategory = categories.find((c) => c.id === categoryId)

  useEffect(() => {
    if (!initialState.name && nameRef.current) nameRef.current.focus()
  }, [initialState.name])

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (state.isDirty) e.preventDefault()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [state.isDirty])

  const handleSave = useCallback(() => {
    onSave(state.name, buildSchema(state))
    dispatch({ type: 'MARK_CLEAN' })
  }, [state, onSave])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleRootDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      dispatch({ type: 'REORDER_BLOCKS', activeId: active.id as string, overId: over.id as string })
    }
  }

  function handleAddBlock(blockType: BlockType) {
    if (blockType === 'section') {
      dispatch({ type: 'ADD_BLOCK', blockType: 'section' })
      return
    }
    const sections = state.blocks.filter((b) => b.type === 'section')
    if (sections.length === 0) {
      toast.warning(templateEditorWidgetStrings.needsSection)
      return
    }
    const last = sections[sections.length - 1]!
    dispatch({ type: 'ADD_BLOCK', blockType, parentId: last.id })
  }

  const isNewTemplate = !initialState.name
  const statusLabel = isLocked
    ? templateEditorWidgetStrings.statusLocked
    : isNewTemplate
      ? templateEditorWidgetStrings.statusNew
      : state.isDirty
        ? templateEditorWidgetStrings.statusEdited
        : undefined

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h1 className="text-h2 flex-1 m-0">{state.name || templateEditorWidgetStrings.newTitle}</h1>
        {statusLabel && <Badge variant={isLocked ? 'review' : 'draft'}>{statusLabel}</Badge>}
        {state.isDirty && !isLocked && (
          <span className="text-[12px] text-n-500">{templateEditorWidgetStrings.unsaved}</span>
        )}
        {selectedCategory && (
          <Badge
            showDot={false}
            style={{
              backgroundColor: selectedCategory.color,
              borderColor: selectedCategory.color,
              color: 'var(--color-n-0)',
            }}
          >
            {selectedCategory.name}
          </Badge>
        )}
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel}>
            {templateEditorWidgetStrings.cancel}
          </Button>
          {!isLocked && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={isSaving || !state.name.trim() || isSaveDisabled}
            >
              {isSaving ? templateEditorWidgetStrings.saving : templateEditorWidgetStrings.save}
            </Button>
          )}
        </div>
      </div>

      {/* Lock banner */}
      {isLocked && (
        <div className="mb-6" role="status">
          <Callout
            variant="warning"
            icon={<i className="ph ph-lock" style={{ fontSize: 18 }} />}
            title={templateEditorWidgetStrings.statusLocked}
          >
            {templateEditorWidgetStrings.lockedBanner}
            {blockingTypeIds.length > 0 && (
              <div className="mt-1 text-[12px] text-warning-text">
                {templateEditorWidgetStrings.lockedTypesPrefix}{' '}
                {blockingTypeIds.map((id) => (
                  <a
                    key={id}
                    href={`/ajustes/tipos/${id}`}
                    style={{ color: 'inherit', textDecoration: 'underline', marginRight: 6 }}
                  >
                    {id.slice(0, 8)}…
                  </a>
                ))}
              </div>
            )}
          </Callout>
        </div>
      )}

      {/* Name + Category */}
      <div className="flex flex-col gap-4 mb-6">
        <Field label={templateEditorWidgetStrings.fieldName} required>
          <Input
            ref={nameRef}
            value={state.name}
            disabled={isLocked}
            onChange={(e) => dispatch({ type: 'SET_NAME', value: e.target.value })}
            placeholder={templateEditorWidgetStrings.fieldNamePlaceholder}
          />
        </Field>
        <Field label={templateEditorWidgetStrings.fieldCategory} required>
          <NativeSelect
            value={categoryId}
            disabled={isLocked}
            onChange={(e) => onCategoryChange(e.target.value)}
            aria-label={templateEditorWidgetStrings.fieldCategory}
          >
            <option value="">{templateEditorWidgetStrings.fieldCategoryPlaceholder}</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>

      {/* Block list */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleRootDragEnd}
      >
        <SortableContext
          items={state.blocks.map((b) => b.id)}
          strategy={verticalListSortingStrategy}
        >
          {state.blocks.map((block) => (
            <SortableBlockRow
              key={block.id}
              block={block}
              expandedBlockId={state.expandedBlockId}
              isLocked={isLocked}
              onToggle={(id) => dispatch({ type: 'TOGGLE_EXPAND', id })}
              onUpdate={(id, patch, pid) =>
                dispatch({ type: 'UPDATE_BLOCK', id, patch, parentId: pid })
              }
              onDelete={(id, pid) => dispatch({ type: 'DELETE_BLOCK', id, parentId: pid })}
              onMove={(id, direction, pid) =>
                dispatch({ type: 'MOVE_BLOCK', id, direction, parentId: pid })
              }
              onAddChild={(blockType, pid) =>
                dispatch({ type: 'ADD_BLOCK', blockType, parentId: pid })
              }
            />
          ))}
        </SortableContext>
      </DndContext>

      {/* Add-block palette */}
      {!isLocked && (
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-n-100">
          {(
            [
              ['section', templateEditorWidgetStrings.addSection],
              ['text', templateEditorWidgetStrings.addText],
              ['checklist', templateEditorWidgetStrings.addChecklist],
              ['steps', templateEditorWidgetStrings.addSteps],
              ['decision', templateEditorWidgetStrings.addDecision],
              ['dosage_table', templateEditorWidgetStrings.addDosage],
              ['alert', templateEditorWidgetStrings.addAlert],
            ] as [BlockType, string][]
          ).map(([blockType, label]) => (
            <Button
              key={blockType}
              variant="secondary"
              size="sm"
              onClick={() => handleAddBlock(blockType)}
            >
              {label}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
