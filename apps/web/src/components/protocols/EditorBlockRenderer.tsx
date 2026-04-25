import { useState } from 'react'
import { cn } from '@/lib/utils'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
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
  const [titleDraft, setTitleDraft] = useState(block.title)

  const requiredBlockIds = useEditorStore((s) => s.requiredBlockIds)
  const updateBlock = useEditorStore((s) => s.updateBlock)
  const deleteBlock = useEditorStore((s) => s.deleteBlock)
  const moveBlock = useEditorStore((s) => s.moveBlock)
  const appendToSection = useEditorStore((s) => s.appendToSection)
  const duplicateBlock = useEditorStore((s) => s.duplicateBlock)

  const isRequired = requiredBlockIds.has(block.id)

  const commitTitle = () => {
    const trimmed = titleDraft.trim()
    const title = trimmed || strings.EDITOR_SECTION_DEFAULT_TITLE
    updateBlock(block.id, (b) => {
      if (b.type !== 'section') return b
      return { ...b, title }
    })
    setTitleDraft(title)
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur()
    }
    if (e.key === 'Escape') {
      setTitleDraft(block.title || strings.EDITOR_SECTION_DEFAULT_TITLE)
      e.currentTarget.blur()
    }
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
    <div
      id={`section-${block.id}`}
      className={cn('bg-n-0 border border-n-200 rounded mb-3', nested && 'ml-7')}
    >
      {/* Section header with 2px teal left rule */}
      <div className="relative flex items-center gap-2 bg-n-25 border-b border-n-100 pl-[18px] pr-4 py-3 rounded-t before:absolute before:left-0 before:top-0 before:bottom-0 before:w-0.5 before:bg-p-500 before:rounded-tl-sm">
        <i className="ph ph-dots-six-vertical text-[16px] text-n-300 cursor-grab shrink-0" />
        <span className="text-[10.5px] font-mono uppercase tracking-[0.05em] text-p-700 bg-p-50 border border-p-100 px-1.5 py-0.5 rounded-sm shrink-0">
          {strings.BLOCK_TYPE_SECTION}
        </span>

        {/* Title — editable inline */}
        <input
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={handleTitleKeyDown}
          className="flex-1 min-w-0 font-serif text-[17px] font-medium text-n-900 bg-transparent border-none outline-none focus:border-b focus:border-p-500 pb-px"
          placeholder={strings.EDITOR_SECTION_TITLE_PLACEHOLDER}
        />

        {isRequired && (
          <span className="text-[10px] font-mono uppercase tracking-[0.05em] text-n-400 shrink-0">
            {strings.EDITOR_BLOCK_REQUIRED_LABEL}
          </span>
        )}

        {/* Add block to section */}
        <button
          onClick={handleAddBlock}
          title={strings.EDITOR_SECTION_ADD_BLOCK}
          className="w-6 h-6 flex items-center justify-center rounded text-n-400 hover:text-n-800 hover:bg-n-100 transition-colors duration-[100ms] shrink-0"
        >
          <i className="ph ph-plus text-[13px]" />
        </button>

        <BlockContextMenu
          isFirst={isFirst}
          isLast={isLast}
          isRequired={isRequired}
          onMoveUp={() => moveBlock(block.id, 'up')}
          onMoveDown={() => moveBlock(block.id, 'down')}
          onDuplicate={() => duplicateBlock(block.id)}
          onDelete={handleDelete}
        />
      </div>

      {/* Section body */}
      <div className="px-[18px] py-4">
        {block.blocks.length > 0 ? (
          <div className="ml-7 border-l border-n-200">
            {block.blocks.map((child, idx) => (
              <EditorBlockRenderer
                key={child.id}
                block={child}
                nested
                isFirst={idx === 0}
                isLast={idx === block.blocks.length - 1}
              />
            ))}
          </div>
        ) : (
          <p className="text-[12.5px] font-sans text-n-400 italic text-center py-3">
            {strings.EDITOR_SECTION_EMPTY}
          </p>
        )}
      </div>
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
  const duplicateBlock = useEditorStore((s) => s.duplicateBlock)

  const isSelected = selectedBlockId === block.id
  const isRequired = requiredBlockIds.has(block.id)
  const isEditable = EDITABLE_BLOCK_TYPES.has(block.type)

  const handleDelete = () => {
    if (isRequired) return
    if (window.confirm(strings.EDITOR_BLOCK_DELETE_CONFIRM)) {
      deleteBlock(block.id)
    }
  }

  return (
    <div
      className={cn(
        'bg-n-0 border border-n-200 rounded mb-3',
        isSelected && 'border-p-500 shadow-[0_0_0_2px_rgba(45,87,96,0.12)]',
      )}
    >
      {/* Block header with 2px teal left rule */}
      <div className="relative flex items-center gap-2 bg-n-25 border-b border-n-100 pl-[18px] pr-4 py-3 rounded-t before:absolute before:left-0 before:top-0 before:bottom-0 before:w-0.5 before:bg-p-500 before:rounded-tl-sm">
        <i className="ph ph-dots-six-vertical text-[16px] text-n-300 cursor-grab shrink-0" />
        <span className="text-[10.5px] font-mono uppercase tracking-[0.05em] text-p-700 bg-p-50 border border-p-100 px-1.5 py-0.5 rounded-sm shrink-0">
          {blockTypeLabel(block.type)}
        </span>
        <span className="flex-1 min-w-0 truncate text-[15px] font-serif font-medium text-n-700">
          {blockDisplayTitle(block)}
        </span>
        {isRequired && (
          <span className="text-[10px] font-mono uppercase tracking-[0.05em] text-n-400 shrink-0">
            {strings.EDITOR_BLOCK_REQUIRED_LABEL}
          </span>
        )}

        <BlockContextMenu
          isFirst={isFirst}
          isLast={isLast}
          isRequired={isRequired}
          isEditable={isEditable}
          onEdit={isEditable ? () => selectBlock(isSelected ? null : block.id) : undefined}
          onMoveUp={() => moveBlock(block.id, 'up')}
          onMoveDown={() => moveBlock(block.id, 'down')}
          onDuplicate={() => duplicateBlock(block.id)}
          onDelete={handleDelete}
        />
      </div>

      {/* Block body */}
      {isSelected && isEditable ? (
        <EditForm block={block} />
      ) : (
        <div
          className={cn(
            'px-[18px] py-4',
            isEditable && 'cursor-pointer hover:bg-n-25 transition-colors duration-[100ms]',
          )}
          onClick={() => isEditable && !isSelected && selectBlock(block.id)}
          title={isEditable && !isSelected ? strings.EDITOR_BLOCK_EDIT : undefined}
        >
          <BlockRenderer block={block} nested={nested} />
        </div>
      )}
    </div>
  )
}

// ── Context menu ──────────────────────────────────────────────────────────────

interface BlockContextMenuProps {
  isFirst: boolean
  isLast: boolean
  isRequired: boolean
  isEditable?: boolean
  onEdit?: (() => void) | undefined
  onMoveUp: () => void
  onMoveDown: () => void
  onDuplicate: () => void
  onDelete: () => void
}

function BlockContextMenu({
  isFirst,
  isLast,
  isRequired,
  isEditable,
  onEdit,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
}: BlockContextMenuProps): JSX.Element {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="w-6 h-6 flex items-center justify-center rounded text-n-400 hover:text-n-800 hover:bg-n-100 transition-colors duration-[100ms] shrink-0"
          title="Más acciones"
        >
          <i className="ph ph-dots-three text-[14px]" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-50 min-w-[168px] bg-n-0 border border-n-200 rounded-[5px] py-1"
          style={{
            boxShadow:
              '0 1px 0 rgba(14,14,13,.04), 0 8px 24px -8px rgba(14,14,13,.12), 0 2px 6px rgba(14,14,13,.06)',
          }}
        >
          {isEditable && onEdit && (
            <DropdownMenu.Item
              onSelect={onEdit}
              className="flex items-center gap-2 px-3 py-[7px] text-[12.5px] font-sans text-n-700 cursor-pointer select-none outline-none hover:bg-n-50 data-[highlighted]:bg-n-50"
            >
              <i className="ph ph-pencil-simple text-[13px] text-n-400" />
              {strings.EDITOR_BLOCK_CTX_EDIT}
            </DropdownMenu.Item>
          )}
          <DropdownMenu.Item
            onSelect={onMoveUp}
            disabled={isFirst}
            className="flex items-center gap-2 px-3 py-[7px] text-[12.5px] font-sans text-n-700 cursor-pointer select-none outline-none hover:bg-n-50 data-[highlighted]:bg-n-50 data-[disabled]:opacity-40 data-[disabled]:cursor-default"
          >
            <i className="ph ph-arrow-up text-[13px] text-n-400" />
            {strings.EDITOR_BLOCK_CTX_MOVE_UP}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={onMoveDown}
            disabled={isLast}
            className="flex items-center gap-2 px-3 py-[7px] text-[12.5px] font-sans text-n-700 cursor-pointer select-none outline-none hover:bg-n-50 data-[highlighted]:bg-n-50 data-[disabled]:opacity-40 data-[disabled]:cursor-default"
          >
            <i className="ph ph-arrow-down text-[13px] text-n-400" />
            {strings.EDITOR_BLOCK_CTX_MOVE_DOWN}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={onDuplicate}
            className="flex items-center gap-2 px-3 py-[7px] text-[12.5px] font-sans text-n-700 cursor-pointer select-none outline-none hover:bg-n-50 data-[highlighted]:bg-n-50"
          >
            <i className="ph ph-copy text-[13px] text-n-400" />
            {strings.EDITOR_BLOCK_CTX_DUPLICATE}
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="h-px bg-n-100 my-1" />
          <DropdownMenu.Item
            onSelect={onDelete}
            disabled={isRequired}
            className="flex items-center gap-2 px-3 py-[7px] text-[12.5px] font-sans text-danger-text cursor-pointer select-none outline-none hover:bg-danger-bg data-[highlighted]:bg-danger-bg data-[disabled]:opacity-40 data-[disabled]:cursor-default"
          >
            <i className="ph ph-trash text-[13px]" />
            {strings.EDITOR_BLOCK_CTX_DELETE}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
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
