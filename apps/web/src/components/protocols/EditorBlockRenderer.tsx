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
import type { ImagingOrderItem, LabOrderItem, OrderUrgency, LabSampleType } from '@rezeta/shared'

type SectionBlock = Extract<ProtocolBlock, { type: 'section' }>

const EDITABLE_BLOCK_TYPES = new Set([
  'text',
  'alert',
  'checklist',
  'steps',
  'decision',
  'dosage_table',
  'imaging_order',
  'lab_order',
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
      className={cn('bg-n-0 border border-n-200 rounded mb-3', nested && 'ml-6')}
    >
      {/* Section header with 2px teal left rule */}
      <div className="relative flex items-center gap-2 bg-n-25 border-b border-n-100 pl-[18px] pr-4 py-3 rounded-t before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[2px] before:bg-p-500 before:rounded-tl-sm">
        <i className="ph ph-dots-six-vertical text-[16px] text-n-300 cursor-grab shrink-0" />
        <span className="text-[10.5px] font-mono uppercase tracking-[0.05em] text-p-700 bg-p-50 border border-p-100 px-2 py-1 rounded-sm shrink-0">
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
          <div className="ml-6 border-l border-n-200">
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
      <div className="relative flex items-center gap-2 bg-n-25 border-b border-n-100 pl-[18px] pr-4 py-3 rounded-t before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[2px] before:bg-p-500 before:rounded-tl-sm">
        <i className="ph ph-dots-six-vertical text-[16px] text-n-300 cursor-grab shrink-0" />
        <span className="text-[10.5px] font-mono uppercase tracking-[0.05em] text-p-700 bg-p-50 border border-p-100 px-2 py-1 rounded-sm shrink-0">
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
    return <DosageTableEditor id={block.id} title={block.title ?? ''} rows={block.rows} />
  }
  if (block.type === 'imaging_order') {
    return <ImagingOrderBlockEditor id={block.id} title={block.title ?? ''} orders={block.orders} />
  }
  if (block.type === 'lab_order') {
    return <LabOrderBlockEditor id={block.id} title={block.title ?? ''} orders={block.orders} />
  }
  return null
}

// ── ImagingOrderBlockEditor ───────────────────────────────────────────────────

const URGENCY_OPTIONS: { value: OrderUrgency; label: string }[] = [
  { value: 'routine', label: 'Rutina' },
  { value: 'urgent', label: 'Urgente' },
  { value: 'stat', label: 'STAT' },
]

function ImagingOrderBlockEditor({
  id,
  title,
  orders,
}: {
  id: string
  title?: string
  orders: ImagingOrderItem[]
}): JSX.Element {
  const [draftTitle, setDraftTitle] = useState(title ?? '')
  const [draftOrders, setDraftOrders] = useState<ImagingOrderItem[]>(orders)
  const updateBlock = useEditorStore((s) => s.updateBlock)
  const selectBlock = useEditorStore((s) => s.selectBlock)

  const addOrder = () => {
    setDraftOrders((prev) => [
      ...prev,
      {
        id: `img_${crypto.randomUUID().slice(0, 8)}`,
        study_type: '',
        indication: '',
        urgency: 'routine' as OrderUrgency,
        contrast: false,
        fasting_required: false,
      },
    ])
  }

  const updateOrder = (orderId: string, patch: Partial<ImagingOrderItem>) => {
    setDraftOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...patch } : o)))
  }

  const removeOrder = (orderId: string) => {
    setDraftOrders((prev) => prev.filter((o) => o.id !== orderId))
  }

  const commit = () => {
    updateBlock(id, (b) => {
      if (b.type !== 'imaging_order') return b
      const trimmed = draftTitle.trim()
      return { ...b, orders: draftOrders, ...(trimmed ? { title: trimmed } : {}) }
    })
    selectBlock(null)
  }

  return (
    <div className="p-4 flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-[12px] font-sans font-medium text-n-600">Título (opcional)</label>
        <input
          type="text"
          className="h-[34px] px-3 text-[13px] font-sans border border-n-300 rounded-sm focus:outline-none focus:border-p-500"
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          placeholder="Ej. Estudios de imagen cardíaca"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[12px] font-sans font-medium text-n-600">Estudios</label>
        {draftOrders.map((order, idx) => (
          <div key={order.id} className="border border-n-200 rounded-sm p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-n-400 shrink-0">{idx + 1}.</span>
              <input
                type="text"
                className="flex-1 h-[30px] px-2 text-[13px] font-sans border border-n-300 rounded-sm focus:outline-none focus:border-p-500"
                value={order.study_type}
                onChange={(e) => updateOrder(order.id, { study_type: e.target.value })}
                placeholder="Tipo de estudio (ej. Radiografía de tórax PA)"
                autoFocus={idx === draftOrders.length - 1 && order.study_type === ''}
              />
              <button
                onClick={() => removeOrder(order.id)}
                disabled={draftOrders.length === 1}
                className="w-6 h-6 flex items-center justify-center text-n-400 hover:text-danger-text disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <i className="ph ph-x text-[12px]" />
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 h-[30px] px-2 text-[13px] font-sans border border-n-300 rounded-sm focus:outline-none focus:border-p-500"
                value={order.indication}
                onChange={(e) => updateOrder(order.id, { indication: e.target.value })}
                placeholder="Indicación clínica"
              />
              <select
                className="h-[30px] px-2 text-[13px] font-sans border border-n-300 rounded-sm focus:outline-none focus:border-p-500 bg-n-0"
                value={order.urgency}
                onChange={(e) => updateOrder(order.id, { urgency: e.target.value as OrderUrgency })}
              >
                {URGENCY_OPTIONS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={order.contrast}
                  onChange={(e) => updateOrder(order.id, { contrast: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-[12px] font-sans text-n-600">Con contraste</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={order.fasting_required}
                  onChange={(e) => updateOrder(order.id, { fasting_required: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-[12px] font-sans text-n-600">Requiere ayuno</span>
              </label>
            </div>
          </div>
        ))}
        <button
          onClick={addOrder}
          className="mt-1 text-[12px] font-sans text-p-500 hover:text-p-700 self-start"
        >
          + Añadir estudio
        </button>
      </div>

      <div className="flex items-center gap-2 justify-end">
        <button
          onClick={() => selectBlock(null)}
          className="h-[28px] px-3 text-[12.5px] font-sans border border-n-300 rounded-sm text-n-700 hover:bg-n-50"
        >
          {strings.EDITOR_BLOCK_CANCEL}
        </button>
        <button
          onClick={commit}
          disabled={draftOrders.length === 0}
          className="h-[28px] px-3 text-[12.5px] font-sans bg-p-500 text-white rounded-sm hover:bg-p-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {strings.EDITOR_BLOCK_APPLY}
        </button>
      </div>
    </div>
  )
}

// ── LabOrderBlockEditor ───────────────────────────────────────────────────────

const SAMPLE_TYPE_OPTIONS: { value: LabSampleType; label: string }[] = [
  { value: 'blood', label: 'Sangre' },
  { value: 'urine', label: 'Orina' },
  { value: 'stool', label: 'Heces' },
  { value: 'other', label: 'Otro' },
]

function LabOrderBlockEditor({
  id,
  title,
  orders,
}: {
  id: string
  title?: string
  orders: LabOrderItem[]
}): JSX.Element {
  const [draftTitle, setDraftTitle] = useState(title ?? '')
  const [draftOrders, setDraftOrders] = useState<LabOrderItem[]>(orders)
  const updateBlock = useEditorStore((s) => s.updateBlock)
  const selectBlock = useEditorStore((s) => s.selectBlock)

  const addOrder = () => {
    setDraftOrders((prev) => [
      ...prev,
      {
        id: `lab_${crypto.randomUUID().slice(0, 8)}`,
        test_name: '',
        indication: '',
        urgency: 'routine' as OrderUrgency,
        fasting_required: false,
        sample_type: 'blood' as LabSampleType,
      },
    ])
  }

  const updateOrder = (orderId: string, patch: Partial<LabOrderItem>) => {
    setDraftOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...patch } : o)))
  }

  const removeOrder = (orderId: string) => {
    setDraftOrders((prev) => prev.filter((o) => o.id !== orderId))
  }

  const commit = () => {
    updateBlock(id, (b) => {
      if (b.type !== 'lab_order') return b
      const trimmed = draftTitle.trim()
      return { ...b, orders: draftOrders, ...(trimmed ? { title: trimmed } : {}) }
    })
    selectBlock(null)
  }

  return (
    <div className="p-4 flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-[12px] font-sans font-medium text-n-600">Título (opcional)</label>
        <input
          type="text"
          className="h-[34px] px-3 text-[13px] font-sans border border-n-300 rounded-sm focus:outline-none focus:border-p-500"
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          placeholder="Ej. Perfil metabólico completo"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[12px] font-sans font-medium text-n-600">Pruebas</label>
        {draftOrders.map((order, idx) => (
          <div key={order.id} className="border border-n-200 rounded-sm p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-n-400 shrink-0">{idx + 1}.</span>
              <input
                type="text"
                className="flex-1 h-[30px] px-2 text-[13px] font-sans border border-n-300 rounded-sm focus:outline-none focus:border-p-500"
                value={order.test_name}
                onChange={(e) => updateOrder(order.id, { test_name: e.target.value })}
                placeholder="Nombre de la prueba (ej. Hemograma completo)"
                autoFocus={idx === draftOrders.length - 1 && order.test_name === ''}
              />
              <button
                onClick={() => removeOrder(order.id)}
                disabled={draftOrders.length === 1}
                className="w-6 h-6 flex items-center justify-center text-n-400 hover:text-danger-text disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <i className="ph ph-x text-[12px]" />
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 h-[30px] px-2 text-[13px] font-sans border border-n-300 rounded-sm focus:outline-none focus:border-p-500"
                value={order.indication}
                onChange={(e) => updateOrder(order.id, { indication: e.target.value })}
                placeholder="Indicación clínica"
              />
              <select
                className="h-[30px] px-2 text-[13px] font-sans border border-n-300 rounded-sm focus:outline-none focus:border-p-500 bg-n-0"
                value={order.urgency}
                onChange={(e) => updateOrder(order.id, { urgency: e.target.value as OrderUrgency })}
              >
                {URGENCY_OPTIONS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
              <select
                className="h-[30px] px-2 text-[13px] font-sans border border-n-300 rounded-sm focus:outline-none focus:border-p-500 bg-n-0"
                value={order.sample_type}
                onChange={(e) =>
                  updateOrder(order.id, { sample_type: e.target.value as LabSampleType })
                }
              >
                {SAMPLE_TYPE_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={order.fasting_required}
                onChange={(e) => updateOrder(order.id, { fasting_required: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-[12px] font-sans text-n-600">Requiere ayuno</span>
            </label>
          </div>
        ))}
        <button
          onClick={addOrder}
          className="mt-1 text-[12px] font-sans text-p-500 hover:text-p-700 self-start"
        >
          + Añadir prueba
        </button>
      </div>

      <div className="flex items-center gap-2 justify-end">
        <button
          onClick={() => selectBlock(null)}
          className="h-[28px] px-3 text-[12.5px] font-sans border border-n-300 rounded-sm text-n-700 hover:bg-n-50"
        >
          {strings.EDITOR_BLOCK_CANCEL}
        </button>
        <button
          onClick={commit}
          disabled={draftOrders.length === 0}
          className="h-[28px] px-3 text-[12.5px] font-sans bg-p-500 text-white rounded-sm hover:bg-p-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {strings.EDITOR_BLOCK_APPLY}
        </button>
      </div>
    </div>
  )
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
    imaging_order: strings.BLOCK_TYPE_IMAGING_ORDER,
    lab_order: strings.BLOCK_TYPE_LAB_ORDER,
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
    case 'imaging_order':
      return (
        block.title ??
        `${block.orders.length} estudio${block.orders.length !== 1 ? 's' : ''} de imagen`
      )
    case 'lab_order':
      return (
        block.title ??
        `${block.orders.length} prueba${block.orders.length !== 1 ? 's' : ''} de laboratorio`
      )
    default:
      return strings.BLOCK_TYPE_UNKNOWN
  }
}
