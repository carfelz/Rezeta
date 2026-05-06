import { useState } from 'react'
import { Button, DialogCard, RadioCard } from '@/components/ui'

const PRESET_REASONS = [
  { value: 'no_coop', label: 'Paciente no cooperaba' },
  { value: 'not_relevant', label: 'No clínicamente relevante hoy' },
  { value: 'already_done', label: 'Paso ya documentado en visita reciente' },
  { value: 'other', label: 'Otro…' },
] as const

type ReasonValue = (typeof PRESET_REASONS)[number]['value']

export interface SkipStepDialogProps {
  stepTitle: string
  onConfirm: (reason: string) => void
  onClose: () => void
  isPending?: boolean
}

export function SkipStepDialog({
  stepTitle,
  onConfirm,
  onClose,
  isPending = false,
}: SkipStepDialogProps): JSX.Element {
  const [selected, setSelected] = useState<ReasonValue | null>('not_relevant')
  const [otherText, setOtherText] = useState('')

  const isOther = selected === 'other'
  const canConfirm = !isPending && selected !== null && (!isOther || otherText.trim().length > 0)

  const finalReason = (): string => {
    if (isOther) return otherText.trim()
    const found = PRESET_REASONS.find((r) => r.value === selected)
    return found?.label ?? ''
  }

  return (
    <DialogCard
      width="md"
      overline="Saltar paso"
      overlineTone="warning"
      title={`¿Por qué saltar ${stepTitle}?`}
      description="Quedará registrado en la consulta. El protocolo seguirá marcado como completo parcialmente."
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="warning"
            size="sm"
            disabled={!canConfirm}
            onClick={() => onConfirm(finalReason())}
          >
            {isPending ? 'Guardando…' : 'Saltar paso'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        {PRESET_REASONS.map((r) => (
          <RadioCard
            key={r.value}
            selected={selected === r.value}
            onClick={() => setSelected(r.value)}
          >
            <span className="text-[13px] text-n-800">{r.label}</span>
          </RadioCard>
        ))}
        {isOther && (
          <textarea
            value={otherText}
            onChange={(e) => setOtherText(e.target.value)}
            placeholder="Describe el motivo…"
            rows={2}
            className="mt-1 w-full px-3 py-2 text-[13px] font-sans text-n-700 placeholder:text-n-300 border border-n-300 rounded-sm focus:outline-none focus:border-p-500 bg-n-0 resize-none"
          />
        )}
      </div>
    </DialogCard>
  )
}
