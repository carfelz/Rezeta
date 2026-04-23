import { clsx } from 'clsx'
import { PencilSimple, Trash, ArrowUp, ArrowDown } from '@phosphor-icons/react'
import { BlockRenderer } from './BlockRenderer'
import type { ProtocolBlock } from './BlockRenderer'
import { TextBlockEditor } from './TextBlockEditor'
import { AlertBlockEditor } from './AlertBlockEditor'
import { useEditorStore } from '@/store/editor.store'
import { strings } from '@/lib/strings'

const EDITABLE_IN_SLICE4 = new Set(['text', 'alert'])

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
  const selectedBlockId = useEditorStore((s) => s.selectedBlockId)
  const requiredBlockIds = useEditorStore((s) => s.requiredBlockIds)
  const selectBlock = useEditorStore((s) => s.selectBlock)
  const deleteBlock = useEditorStore((s) => s.deleteBlock)
  const moveBlock = useEditorStore((s) => s.moveBlock)

  const isSelected = selectedBlockId === block.id
  const isRequired = requiredBlockIds.has(block.id)
  const isEditable = EDITABLE_IN_SLICE4.has(block.type)
  const isEditingThis = isSelected && isEditable

  if (block.type === 'section') {
    return (
      <div className={clsx('bg-n-0 border border-n-200 rounded-[5px] mb-3', nested && 'ml-7')}>
        {/* Section header — read-only in Slice 4 */}
        <div className="relative flex items-center gap-3 bg-n-25 border-b border-n-100 px-[18px] py-3 rounded-t before:absolute before:left-0 before:top-0 before:bottom-0 before:w-0.5 before:bg-p-500 before:rounded-tl-sm">
          <span className="text-[10.5px] font-mono uppercase tracking-[0.05em] text-p-700 bg-p-50 border border-p-100 px-1.5 py-0.5 rounded-sm shrink-0">
            {strings.BLOCK_TYPE_SECTION}
          </span>
          <span className="text-[17px] font-serif font-medium text-n-900 flex-1 min-w-0 truncate">
            {block.title}
          </span>
          {isRequired && (
            <span className="text-[10px] font-mono uppercase tracking-[0.05em] text-n-400 shrink-0">
              {strings.EDITOR_BLOCK_REQUIRED_LABEL}
            </span>
          )}
        </div>
        {/* Section children */}
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
        </div>
      </div>
    )
  }

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
          {/* Move up/down */}
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

          {/* Edit (only for editable types) */}
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

          {/* Delete */}
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
  return null
}

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
