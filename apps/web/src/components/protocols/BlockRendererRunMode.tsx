import {
  ProtocolBlock,
  ProtocolChecklist,
  ProtocolDosageTable,
  ProtocolAlert,
} from '@/components/ui/ProtocolBlock'
import { cn } from '@/lib/utils'
import { useOrderQueueStore } from '@/store/order-queue.store'
import type { ProtocolBlock as Block } from './BlockRenderer'
import type { ImagingOrderItem, LabOrderItem } from '@rezeta/shared'

export interface RunModeProps {
  checkedState: Record<string, boolean>
  onCheck: (id: string, checked: boolean) => void
  onLaunchLinkedProtocol?: (protocolId: string, triggerBlockId: string) => void
}

interface BlockRunModeProps {
  block: unknown
  nested?: boolean
  runMode: RunModeProps
}

function StepsRunMode({
  steps,
  checkedState,
  onCheck,
}: {
  steps: Array<{ id: string; order: number; title: string; detail?: string }>
  checkedState: Record<string, boolean>
  onCheck: (id: string, checked: boolean) => void
}): JSX.Element {
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((step) => {
        const done = checkedState[step.id] ?? false
        return (
          <li
            key={step.id}
            className={cn('flex gap-3 cursor-pointer group', done && 'opacity-60')}
            onClick={() => onCheck(step.id, !done)}
          >
            <input
              type="checkbox"
              checked={done}
              onChange={() => onCheck(step.id, !done)}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4 rounded-sm border-n-400 text-p-500 cursor-pointer shrink-0 mt-1"
            />
            <div className="flex-1">
              <div
                className={cn(
                  'text-[13.5px] font-sans font-semibold text-n-800',
                  done && 'line-through text-n-400',
                )}
              >
                <span className="font-mono text-[12px] text-p-700 mr-1.5">{step.order}.</span>
                {step.title}
              </div>
              {step.detail && (
                <div className="text-[12.5px] font-sans text-n-500 mt-0.5 leading-[1.4]">
                  {step.detail}
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function DecisionRunMode({
  blockId,
  condition,
  branches,
  checkedState,
  onCheck,
  onLaunchLinkedProtocol,
}: {
  blockId: string
  condition: string
  branches: Array<{ id: string; label: string; action: string; linked_protocol_id?: string }>
  checkedState: Record<string, boolean>
  onCheck: (id: string, checked: boolean) => void
  onLaunchLinkedProtocol?: (protocolId: string, triggerBlockId: string) => void
}): JSX.Element {
  const selectedId = branches.find((b) => checkedState[b.id])?.id ?? null
  return (
    <div>
      <div className="text-[13px] font-sans font-semibold text-n-800 mb-3 pb-3 border-b border-n-100">
        {condition}
      </div>
      <div className="flex flex-col gap-2">
        {branches.map((branch) => {
          const selected = checkedState[branch.id] ?? false
          return (
            <div key={branch.id} className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => {
                  branches.forEach((b) => {
                    if (b.id !== branch.id && checkedState[b.id]) onCheck(b.id, false)
                  })
                  onCheck(branch.id, !selected)
                }}
                className={cn(
                  'flex gap-3 text-left w-full px-3 py-2.5 rounded border transition-colors duration-[100ms]',
                  selected
                    ? 'bg-p-50 border-p-300 text-n-800'
                    : 'bg-n-0 border-n-200 text-n-600 hover:bg-n-25',
                )}
              >
                <span
                  className={cn(
                    'text-[11.5px] font-mono font-medium px-2 py-0.5 rounded-sm shrink-0 h-fit mt-0.5',
                    selected
                      ? 'bg-p-500 text-white border border-p-500'
                      : 'bg-p-50 text-p-700 border border-p-100',
                  )}
                >
                  {branch.label}
                </span>
                <div className="text-[13px] font-sans leading-[1.45]">{branch.action}</div>
              </button>
              {selected && branch.linked_protocol_id && onLaunchLinkedProtocol && (
                <button
                  type="button"
                  onClick={() => onLaunchLinkedProtocol(branch.linked_protocol_id!, blockId)}
                  className="ml-3 flex items-center gap-1.5 text-[12px] font-sans text-p-700 hover:text-p-500 transition-colors"
                >
                  <i className="ph ph-arrow-square-out text-[14px]" />
                  Abrir protocolo vinculado
                </button>
              )}
            </div>
          )
        })}
      </div>
      {selectedId && (
        <button
          type="button"
          onClick={() => branches.forEach((b) => onCheck(b.id, false))}
          className="mt-2 text-[11.5px] font-mono text-n-400 hover:text-n-700 transition-colors"
        >
          Limpiar selección
        </button>
      )}
    </div>
  )
}

function ImagingOrderRunMode({ orders }: { orders: ImagingOrderItem[] }): JSX.Element {
  const queueImagingOrder = useOrderQueueStore((s) => s.queueImagingOrder)
  return (
    <div className="flex flex-col gap-2">
      {orders.map((order) => (
        <div
          key={order.id}
          className="flex items-start justify-between gap-3 px-3 py-2.5 border border-n-200 rounded bg-n-0"
        >
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-sans font-semibold text-n-800">{order.study_type}</div>
            <div className="text-[12px] font-sans text-n-500 mt-0.5">{order.indication}</div>
            {order.urgency !== 'routine' && (
              <span className="text-[11px] font-mono uppercase text-warning-text bg-warning-bg border border-warning-border px-1.5 py-0.5 rounded-sm mt-1 inline-block">
                {order.urgency}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() =>
              queueImagingOrder({
                study_type: order.study_type,
                indication: order.indication,
                urgency: order.urgency,
                contrast: order.contrast,
                fasting_required: order.fasting_required,
                special_instructions: order.special_instructions,
                source: `protocol:${order.id}`,
              })
            }
            className="shrink-0 text-[12px] font-sans text-p-700 border border-p-300 bg-p-50 hover:bg-p-100 px-2.5 py-1 rounded-sm transition-colors"
          >
            + Añadir a órdenes
          </button>
        </div>
      ))}
    </div>
  )
}

function LabOrderRunMode({ orders }: { orders: LabOrderItem[] }): JSX.Element {
  const queueLabOrder = useOrderQueueStore((s) => s.queueLabOrder)
  return (
    <div className="flex flex-col gap-2">
      {orders.map((order) => (
        <div
          key={order.id}
          className="flex items-start justify-between gap-3 px-3 py-2.5 border border-n-200 rounded bg-n-0"
        >
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-sans font-semibold text-n-800">{order.test_name}</div>
            <div className="text-[12px] font-sans text-n-500 mt-0.5">{order.indication}</div>
            {order.urgency !== 'routine' && (
              <span className="text-[11px] font-mono uppercase text-warning-text bg-warning-bg border border-warning-border px-1.5 py-0.5 rounded-sm mt-1 inline-block">
                {order.urgency}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() =>
              queueLabOrder({
                test_name: order.test_name,
                test_code: order.test_code,
                indication: order.indication,
                urgency: order.urgency,
                fasting_required: order.fasting_required,
                sample_type: order.sample_type,
                special_instructions: order.special_instructions,
                source: `protocol:${order.id}`,
              })
            }
            className="shrink-0 text-[12px] font-sans text-p-700 border border-p-300 bg-p-50 hover:bg-p-100 px-2.5 py-1 rounded-sm transition-colors"
          >
            + Añadir a órdenes
          </button>
        </div>
      ))}
    </div>
  )
}

export function BlockRendererRunMode({
  block,
  nested = false,
  runMode,
}: BlockRunModeProps): JSX.Element | null {
  const b = block as Block
  const { checkedState, onCheck, onLaunchLinkedProtocol } = runMode

  switch (b.type) {
    case 'section':
      return (
        <ProtocolBlock type="Sección" title={b.title} nested={nested}>
          {b.blocks.length > 0 ? (
            <div className="flex flex-col gap-0">
              {b.blocks.map((child) => (
                <BlockRendererRunMode key={child.id} block={child} nested runMode={runMode} />
              ))}
            </div>
          ) : null}
        </ProtocolBlock>
      )

    case 'text':
      return (
        <ProtocolBlock type="Texto" title="Texto" nested={nested}>
          <p className="text-[13.5px] font-sans text-n-700 leading-[1.55] whitespace-pre-wrap">
            {b.content}
          </p>
        </ProtocolBlock>
      )

    case 'checklist':
      return (
        <ProtocolBlock type="Lista" title={b.title ?? 'Lista de verificación'} nested={nested}>
          <ProtocolChecklist
            items={b.items.map((item) => ({ ...item, done: checkedState[item.id] ?? false }))}
            onToggle={(id) => onCheck(id, !(checkedState[id] ?? false))}
          />
        </ProtocolBlock>
      )

    case 'steps':
      return (
        <ProtocolBlock type="Pasos" title={b.title ?? 'Pasos'} nested={nested}>
          <StepsRunMode steps={b.steps} checkedState={checkedState} onCheck={onCheck} />
        </ProtocolBlock>
      )

    case 'decision':
      return (
        <ProtocolBlock type="Decisión" title={b.condition || 'Decisión'} nested={nested}>
          <DecisionRunMode
            blockId={b.id}
            condition={b.condition}
            branches={b.branches}
            checkedState={checkedState}
            onCheck={onCheck}
            onLaunchLinkedProtocol={onLaunchLinkedProtocol}
          />
        </ProtocolBlock>
      )

    case 'dosage_table':
      return (
        <ProtocolBlock type="Tabla" title={b.title ?? 'Tabla de dosis'} nested={nested}>
          <ProtocolDosageTable rows={b.rows} {...(b.title ? { title: b.title } : {})} />
        </ProtocolBlock>
      )

    case 'alert':
      return (
        <ProtocolBlock type="Alerta" title={b.title ?? 'Alerta'} nested={nested}>
          <ProtocolAlert
            severity={b.severity}
            content={b.content}
            {...(b.title ? { title: b.title } : {})}
          />
        </ProtocolBlock>
      )

    case 'imaging_order': {
      const imgBlock = b as unknown as { title?: string; orders: ImagingOrderItem[] }
      return (
        <ProtocolBlock type="Imagen" title={imgBlock.title ?? 'Estudios de imagen'} nested={nested}>
          <ImagingOrderRunMode orders={imgBlock.orders} />
        </ProtocolBlock>
      )
    }

    case 'lab_order': {
      const labBlock = b as unknown as { title?: string; orders: LabOrderItem[] }
      return (
        <ProtocolBlock
          type="Laboratorio"
          title={labBlock.title ?? 'Estudios de laboratorio'}
          nested={nested}
        >
          <LabOrderRunMode orders={labBlock.orders} />
        </ProtocolBlock>
      )
    }

    default:
      return null
  }
}
