import { useState } from 'react'
import { clsx } from 'clsx'
import { PencilSimple, Trash, ArrowUp, ArrowDown } from '@phosphor-icons/react'
import { BlockRenderer } from './BlockRenderer'
import type { ProtocolBlock } from './BlockRenderer'
import { TextBlockEditor } from './TextBlockEditor'
import { AlertBlockEditor } from './AlertBlockEditor'
import { ChecklistBlockEditor } from './ChecklistBlockEditor'
import { StepsBlockEditor } from './StepsBlockEditor'
import { DecisionBlockEditor } from './DecisionBlockEditor'
import { DosageTableEditor } from './DosageTableEditor'
import { useEditorStore } from '@/store/editor.store'
import { strings } from '@/lib/strings'

type SectionBlock = Extract<ProtocolBlock, { type: 'section' }>

const EDITABLE_BLOCK_TYPES = new Set([
  'text',
  'alert',
  'checklist',
  'steps',
  'decision',
  'dosage_table',
])

interface EditorBlockRendererProps {
  block: ProtocolBlock
  nested?: boolean
  isFirst?: boolean
  isLast?: boolean
}

export function EditorBlockRenderer({
  block,
  nested = false,
  isFirst = false,
  isLast = false,
}: EditorBlockRendererProps): JSX.Element | null {
  if (block.type === 'section') {
    return <SectionEditor block={block} isFirst={isFirst} isLast={isLast} nested={nested} />
  }
  return <LeafBlockEditor block={block} nested={nested} isFirst={isFirst} isLast={isLast} />
}

// ── Section editor ────────────────────────────────────────────────────────────

function SectionEditor({
  block,
  isFirst,
  isLast,
  nested,
}: {
  block: SectionBlock
  isFirst: boolean
  isLast: boolean
  nested: boolean
}): JSX.Element {
  const [isCollapsed, setIsCollapsed] = useState(block.collapsed_by_default ?? false)
  const [isEditingTitle, setIsEditingTitle] = useState(block.title === '')
  const [titleDraft, setTitleDraft] = useState(block.title)

  const requiredBlockIds = useEditorStore((s) => s.requiredBlockIds)
  const updateBlock = useEditorStore((s) => s.updateBlock)
  const deleteBlock = useEditorStore((s) => s.deleteBlock)
  const moveBlock = useEditorStore((s) => s.moveBlock)
  const appendToSection = useEditorStore((s) => s.appendToSection)

  const isRequired = requiredBlockIds.has(block.id)

  const commitTitle = () => {
    const trimmed = titleDraft.trim()
    const title = trimmed || strings.EDITOR_SECTION_DEFAULT_TITLE
    updateBlock(block.id, (b) => {
      if (b.type !== 'section') return b
      return { ...b, title }
    })
    setTitleDraft(title)
    setIsEditingTitle(false)
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commitTitle()
    if (e.key === 'Escape') {
      if (!block.title) {
        commitTitle()
      } else {
        setTitleDraft(block.title)
        setIsEditingTitle(false)
      }
    }
  }

  const startEditing = () => {
    setTitleDraft(block.title)
    setIsEditingTitle(true)
  }

  const handleAddBlock = () => {
    appendToSection(block.id, {
      id: `blk_${crypto.randomUUID().slice(0, 8)}`,
      type: 'text',
      content: '',
    })
  }

  const handleDelete = () => {
    if (isRequired) return
    if (window.confirm(strings.EDITOR_SECTION_DELETE_CONFIRM(block.blocks.length))) {
      deleteBlock(block.id)
    }
  }

  return (
    <div className={clsx('bg-n-0 border border-n-200 rounded-[5px] mb-3', nested && 'ml-7')}>
      {/* Section header */}
      <div className="relative flex items-center gap-2 bg-n-25 border-b border-n-100 px-[14px] py-2.5 rounded-t before:absolute before:left-0 before:top-0 before:bottom-0 before:w-0.5 before:bg-p-500 before:rounded-tl-sm">
        {/* Collapse toggle */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? strings.EDITOR_SECTION_EXPAND : strings.EDITOR_SECTION_COLLAPSE}
          className="shrink-0 w-5 h-5 flex items-center justify-center text-n-400 hover:text-n-700 transition-colors duration-[100ms]"
        >
          <i className={`ph ${isCollapsed ? 'ph-caret-right' : 'ph-caret-down'} text-[11px]`} />
        </button>

        {/* Type chip */}
        <span className="text-[10.5px] font-mono uppercase tracking-[0.05em] text-p-700 bg-p-50 border border-p-100 px-1.5 py-0.5 rounded-sm shrink-0">
          {strings.BLOCK_TYPE_SECTION}
        </span>

        {/* Title — editable inline */}
        {isEditingTitle ? (
          <input
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={handleTitleKeyDown}
            autoFocus
            className="flex-1 min-w-0 text-[16px] font-serif font-medium text-n-900 bg-transparent border-b border-p-500 focus:outline-none pb-0.5"
            placeholder={strings.EDITOR_SECTION_TITLE_PLACEHOLDER}
          />
        ) : (
          <button
            onClick={startEditing}
            title={strings.EDITOR_SECTION_CLICK_TO_RENAME}
            className="flex-1 min-w-0 text-left text-[16px] font-serif font-medium text-n-900 hover:text-p-700 truncate transition-colors duration-[100ms]"
          >
            {block.title || strings.EDITOR_SECTION_DEFAULT_TITLE}
          </button>
        )}

        {isRequired && (
          <span className="text-[10px] font-mono uppercase tracking-[0.05em] text-n-400 shrink-0">
            {strings.EDITOR_BLOCK_REQUIRED_LABEL}
          </span>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-0.5 ml-1 shrink-0">
          <button
            onClick={() => moveBlock(block.id, 'up')}
            disabled={isFirst}
            title={strings.TEMPLATE_EDITOR_MOVE_UP}
            className="w-6 h-6 flex items-center justify-center rounded text-n-400 hover:text-n-800 hover:bg-n-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-[100ms]"
          >
            <ArrowUp size={13} />
          </button>
          <button
            onClick={() => moveBlock(block.id, 'down')}
            disabled={isLast}
            title={strings.TEMPLATE_EDITOR_MOVE_DOWN}
            className="w-6 h-6 flex items-center justify-center rounded text-n-400 hover:text-n-800 hover:bg-n-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-[100ms]"
          >
            <ArrowDown size={13} />
          </button>
          <button
            onClick={startEditing}
            title={strings.EDITOR_SECTION_RENAME}
            className="w-6 h-6 flex items-center justify-center rounded text-n-400 hover:text-n-800 hover:bg-n-100 transition-colors duration-[100ms]"
          >
            <PencilSimple size={13} />
          </button>
          <button
            onClick={handleDelete}
            disabled={isRequired}
            title={
              isRequired
                ? strings.EDITOR_BLOCK_DELETE_REQUIRED_TOOLTIP
                : strings.EDITOR_SECTION_DELETE
            }
            className="w-6 h-6 flex items-center justify-center rounded text-n-400 hover:text-danger-text hover:bg-danger-bg disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-[100ms]"
          >
            <Trash size={13} />
          </button>
        </div>
      </div>

      {/* Section body */}
      {!isCollapsed && (
        <div className="p-3 flex flex-col gap-0">
          {block.blocks.length > 0 ? (
            block.blocks.map((child, idx) => (
              <EditorBlockRenderer
                key={child.id}
                block={child}
                nested
                isFirst={idx === 0}
                isLast={idx === block.blocks.length - 1}
              />
            ))
          ) : (
            <p className="text-[12.5px] font-sans text-n-400 italic text-center py-3">
              {strings.EDITOR_SECTION_EMPTY}
            </p>
          )}
          <button
            onClick={handleAddBlock}
            className="mt-1.5 flex items-center gap-1.5 px-2 py-1 text-[12px] font-sans text-n-500 hover:text-p-700 hover:bg-n-50 rounded transition-colors duration-[100ms] self-start"
          >
            <i className="ph ph-plus text-[11px]" />
            {strings.EDITOR_SECTION_ADD_BLOCK}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Leaf block editor ─────────────────────────────────────────────────────────

function LeafBlockEditor({
  block,
  nested,
  isFirst,
  isLast,
}: {
  block: ProtocolBlock
  nested: boolean
  isFirst: boolean
  isLast: boolean
}): JSX.Element {
  const selectedBlockId = useEditorStore((s) => s.selectedBlockId)
  const requiredBlockIds = useEditorStore((s) => s.requiredBlockIds)
  const selectBlock = useEditorStore((s) => s.selectBlock)
  const deleteBlock = useEditorStore((s) => s.deleteBlock)
  const moveBlock = useEditorStore((s) => s.moveBlock)

  const isSelected = selectedBlockId === block.id
  const isRequired = requiredBlockIds.has(block.id)
  const isEditable = EDITABLE_BLOCK_TYPES.has(block.type)
  const isEditingThis = isSelected && isEditable

  return (
    <div
      className={clsx(
        'bg-n-0 border rounded-[5px] mb-2 transition-all duration-[100ms]',
        nested ? 'ml-7' : '',
        isSelected
          ? 'border-p-500 shadow-[0_0_0_2px_rgba(45,87,96,0.12)]'
          : 'border-n-200 hover:border-n-300',
      )}
    >
      {/* Block header */}
      <div className="relative flex items-center gap-2 bg-n-25 border-b border-n-100 px-[18px] py-2.5 rounded-t before:absolute before:left-0 before:top-0 before:bottom-0 before:w-0.5 before:bg-p-500 before:rounded-tl-sm">
        <span className="text-[10.5px] font-mono uppercase tracking-[0.05em] text-p-700 bg-p-50 border border-p-100 px-1.5 py-0.5 rounded-sm shrink-0">
          {blockTypeLabel(block.type)}
        </span>
        <span className="text-[14px] font-serif text-n-700 flex-1 min-w-0 truncate">
          {blockDisplayTitle(block)}
        </span>
        {isRequired && (
          <span className="text-[10px] font-mono uppercase tracking-[0.05em] text-n-400 shrink-0">
            {strings.EDITOR_BLOCK_REQUIRED_LABEL}
          </span>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-0.5 ml-1 shrink-0">
          <button
            onClick={() => moveBlock(block.id, 'up')}
            disabled={isFirst}
            title={strings.TEMPLATE_EDITOR_MOVE_UP}
            className="w-6 h-6 flex items-center justify-center rounded text-n-400 hover:text-n-800 hover:bg-n-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-[100ms]"
          >
            <ArrowUp size={13} />
          </button>
          <button
            onClick={() => moveBlock(block.id, 'down')}
            disabled={isLast}
            title={strings.TEMPLATE_EDITOR_MOVE_DOWN}
            className="w-6 h-6 flex items-center justify-center rounded text-n-400 hover:text-n-800 hover:bg-n-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-[100ms]"
          >
            <ArrowDown size={13} />
          </button>

          {isEditable && (
            <button
              onClick={() => selectBlock(isSelected ? null : block.id)}
              title={strings.EDITOR_BLOCK_EDIT}
              className={clsx(
                'w-6 h-6 flex items-center justify-center rounded transition-colors duration-[100ms]',
                isSelected ? 'text-p-700 bg-p-50' : 'text-n-400 hover:text-n-800 hover:bg-n-100',
              )}
            >
              <PencilSimple size={13} />
            </button>
          )}

          <button
            onClick={() => {
              if (isRequired) return
              if (window.confirm(strings.EDITOR_BLOCK_DELETE_CONFIRM)) {
                deleteBlock(block.id)
              }
            }}
            disabled={isRequired}
            title={
              isRequired
                ? strings.EDITOR_BLOCK_DELETE_REQUIRED_TOOLTIP
                : strings.EDITOR_BLOCK_DELETE
            }
            className="w-6 h-6 flex items-center justify-center rounded text-n-400 hover:text-danger-text hover:bg-danger-bg disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-[100ms]"
          >
            <Trash size={13} />
          </button>
        </div>
      </div>

      {/* Block body */}
      {isEditingThis ? (
        <EditForm block={block} />
      ) : (
        <div className="p-4">
          <BlockRenderer block={block} nested={nested} />
        </div>
      )}
    </div>
  )
}

// ── Edit form ─────────────────────────────────────────────────────────────────

function EditForm({ block }: { block: ProtocolBlock }): JSX.Element | null {
  if (block.type === 'text') {
    return <TextBlockEditor id={block.id} content={block.content} />
  }
  if (block.type === 'alert') {
    return (
      <AlertBlockEditor
        id={block.id}
        severity={block.severity}
        title={block.title}
        content={block.content}
      />
    )
  }
  if (block.type === 'checklist') {
    return <ChecklistBlockEditor id={block.id} title={block.title} items={block.items} />
  }
  if (block.type === 'steps') {
    return <StepsBlockEditor id={block.id} title={block.title} steps={block.steps} />
  }
  if (block.type === 'decision') {
    return (
      <DecisionBlockEditor id={block.id} condition={block.condition} branches={block.branches} />
    )
  }
  if (block.type === 'dosage_table') {
    return <DosageTableEditor id={block.id} title={block.title} rows={block.rows} />
  }
  return null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function blockTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    text: strings.BLOCK_TYPE_TEXT,
    checklist: strings.BLOCK_TYPE_CHECKLIST,
    steps: strings.BLOCK_TYPE_STEPS,
    decision: strings.BLOCK_TYPE_DECISION,
    dosage_table: strings.BLOCK_TYPE_DOSAGE_TABLE,
    alert: strings.BLOCK_TYPE_ALERT,
    section: strings.BLOCK_TYPE_SECTION,
  }
  return labels[type] ?? strings.BLOCK_TYPE_UNKNOWN
}

function blockDisplayTitle(block: ProtocolBlock): string {
  switch (block.type) {
    case 'text':
      return block.content
        ? block.content.slice(0, 60) + (block.content.length > 60 ? '…' : '')
        : strings.EDITOR_BLOCK_EMPTY_TEXT
    case 'alert':
      return block.title ?? (block.content.slice(0, 60) || strings.BLOCK_TYPE_ALERT)
    case 'checklist':
      return block.title ?? strings.BLOCK_TYPE_CHECKLIST
    case 'steps':
      return block.title ?? strings.BLOCK_TYPE_STEPS
    case 'decision':
      return block.condition || strings.BLOCK_TYPE_DECISION
    case 'dosage_table':
      return block.title ?? strings.BLOCK_TYPE_DOSAGE_TABLE
    case 'section':
      return block.title
    default:
      return strings.BLOCK_TYPE_UNKNOWN
  }
}
