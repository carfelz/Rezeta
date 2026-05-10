import { Button, Caption, Chip, Overline, StepCircle, TextLink } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { ConsultationProtocolUsage, ProtocolBlock } from '@rezeta/shared'

// ─── Step collection ──────────────────────────────────────────────────────────

interface StepItem {
  id: string
  label: string
  sectionTitle?: string
  checkableIds: string[]
  body?: string
  isNew?: boolean
}

function collectSteps(blocks: ProtocolBlock[]): StepItem[] {
  const items: StepItem[] = []
  for (const block of blocks) {
    if (block.type === 'section') {
      const sectionLabel = block.title
      for (const child of block.blocks) {
        if (child.type === 'checklist') {
          for (const item of child.items) {
            items.push({
              id: item.id,
              label: item.text,
              sectionTitle: sectionLabel,
              checkableIds: [item.id],
            })
          }
        } else if (child.type === 'steps') {
          for (const step of child.steps) {
            const item: StepItem = {
              id: step.id,
              label: step.title,
              sectionTitle: sectionLabel,
              checkableIds: [step.id],
            }
            if (step.detail !== undefined) item.body = step.detail
            items.push(item)
          }
        }
      }
    } else if (block.type === 'checklist') {
      for (const item of block.items) {
        items.push({ id: item.id, label: item.text, checkableIds: [item.id] })
      }
    } else if (block.type === 'steps') {
      for (const step of block.steps) {
        const item: StepItem = {
          id: step.id,
          label: step.title,
          checkableIds: [step.id],
        }
        if (step.detail !== undefined) item.body = step.detail
        items.push(item)
      }
    }
  }
  return items
}

export interface CanvasViewSoapState {
  chiefComplaint: string
  subjective: string
  objective: string
  assessment: string
  plan: string
}

export interface CanvasViewProps {
  usage: ConsultationProtocolUsage
  soap: CanvasViewSoapState
  onSoapChange: (field: keyof CanvasViewSoapState, value: string) => void
  onToggleStep: (stepId: string, checked: boolean) => void
  onSkipStep?: (step: { id: string; title: string }) => void
  isSigned: boolean
  /**
   * Invoked from the empty-protocol card when the doctor chooses to drop the
   * protocol and continue the consultation without a guide.
   */
  onContinueWithoutProtocol?: () => void
  /**
   * Invoked from the empty-protocol card when the doctor wants to add blocks
   * to the protocol now.
   */
  onEditProtocol?: () => void
}

export function CanvasView({
  usage,
  soap,
  onSoapChange,
  onToggleStep,
  onSkipStep,
  isSigned,
  onContinueWithoutProtocol,
  onEditProtocol,
}: CanvasViewProps): JSX.Element {
  const blocks = usage.content?.blocks ?? []
  const steps = collectSteps(blocks)
  const checkedState = usage.checkedState ?? {}

  void soap
  void onSoapChange

  const activeIndex = steps.findIndex((s) => !s.checkableIds.every((id) => checkedState[id]))

  if (steps.length === 0) {
    return (
      <div className="bg-n-0 border border-dashed border-n-200 rounded-md px-8 py-12 text-center flex flex-col items-center gap-3">
        <Overline tone="warning" size="md">
          Protocolo sin pasos
        </Overline>
        <h2 className="font-serif font-medium text-[24px] text-n-900 leading-tight tracking-[-0.01em] m-0">
          Este protocolo todavía no tiene pasos.
        </h2>
        <p className="text-[13px] text-n-500 max-w-[440px] leading-snug">
          Sus secciones existen (Motivo, Ruta de decisión) pero aún no contienen bloques. Puedes
          editarlo ahora o seguir con la consulta en blanco.
        </p>
        {(onContinueWithoutProtocol || onEditProtocol) && (
          <div className="flex items-center gap-2 mt-2">
            {onContinueWithoutProtocol && (
              <Button variant="ghost" size="sm" onClick={onContinueWithoutProtocol}>
                Continuar sin protocolo
              </Button>
            )}
            {onEditProtocol && (
              <Button variant="primary" size="sm" onClick={onEditProtocol}>
                Editar protocolo
              </Button>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {steps.map((step, i) => {
        const isComplete = step.checkableIds.every((id) => checkedState[id])
        const isActive = !isComplete && i === activeIndex
        return (
          <ProtoStep
            key={step.id}
            step={step}
            index={i}
            isComplete={isComplete}
            isActive={isActive}
            isSigned={isSigned}
            onToggle={(checked) => onToggleStep(step.id, checked)}
            {...(onSkipStep
              ? { onSkip: () => onSkipStep({ id: step.id, title: step.label }) }
              : {})}
          />
        )
      })}
    </div>
  )
}

// ─── Single ProtoStep card ─────────────────────────────────────────────────────

function ProtoStep({
  step,
  index,
  isComplete,
  isActive,
  isSigned,
  onToggle,
  onSkip,
}: {
  step: StepItem
  index: number
  isComplete: boolean
  isActive: boolean
  isSigned: boolean
  onToggle: (checked: boolean) => void
  onSkip?: () => void
}): JSX.Element {
  const stepNum = index + 1
  const status = isComplete ? 'done' : isActive ? 'active' : 'pending'

  return (
    <div className="relative flex gap-4 px-5 py-4 bg-n-0 border border-n-200 rounded-md transition-colors">
      {isActive && (
        <div
          className="absolute left-0 top-3 bottom-3 bg-p-500 rounded-full"
          style={{ width: '2px' }}
        />
      )}

      <StepCircle
        status={status}
        number={stepNum}
        size="md"
        disabled={isSigned}
        onClick={() => onToggle(!isComplete)}
        aria-label={isComplete ? 'Marcar como pendiente' : 'Marcar como completado'}
        className="mt-px"
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <span className="font-mono text-[10.5px] text-n-400 mt-px">
            {String(stepNum).padStart(2, '0')}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3
                className={cn(
                  'font-serif font-medium text-[16px] leading-tight',
                  isComplete ? 'text-n-700' : 'text-n-900',
                )}
              >
                {step.label}
              </h3>
              {isActive && (
                <Chip tone="primarySolid" size="xs">
                  En curso
                </Chip>
              )}
              {step.isNew && (
                <Chip tone="warning" size="xs">
                  Nuevo
                </Chip>
              )}
            </div>
            {step.sectionTitle && (
              <Caption tone="muted" size="sm" as="div" className="mt-px">
                {step.sectionTitle}
              </Caption>
            )}
            {step.body && (
              <div
                className={cn(
                  'text-[13px] mt-2 leading-snug',
                  isComplete ? 'text-n-600' : 'text-n-700',
                )}
              >
                {step.body}
              </div>
            )}
          </div>

          {isComplete && !isSigned && (
            <TextLink size="sm" onClick={() => onToggle(false)}>
              Editar
            </TextLink>
          )}
          {isActive && !isSigned && onSkip && (
            <TextLink size="sm" tone="warning" onClick={onSkip}>
              Saltar
            </TextLink>
          )}
        </div>
      </div>
    </div>
  )
}
