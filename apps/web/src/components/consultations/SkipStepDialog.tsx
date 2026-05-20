import { useState } from 'react'
import { Button, DialogCard, RadioCard } from '@/components/ui'
import { skipStepStrings } from './strings'

const PRESET_REASONS = [
  { value: 'no_coop', label: skipStepStrings.reasonNoCoop },
  { value: 'not_relevant', label: skipStepStrings.reasonNotRelevant },
  { value: 'already_done', label: skipStepStrings.reasonAlreadyDone },
  { value: 'other', label: skipStepStrings.reasonOther },
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
      overline={skipStepStrings.overline}
      overlineTone="warning"
      title={`¿Por qué saltar ${stepTitle}?`}
      description={skipStepStrings.description}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            {skipStepStrings.cancelButton}
          </Button>
          <Button
            variant="warning"
            size="sm"
            disabled={!canConfirm}
            onClick={() => onConfirm(finalReason())}
          >
            {isPending ? skipStepStrings.savingButton : skipStepStrings.skipButton}
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
            placeholder={skipStepStrings.otherPlaceholder}
            rows={2}
            className="mt-1 w-full px-3 py-2 text-[13px] font-sans text-n-700 placeholder:text-n-300 border border-n-300 rounded-sm focus:outline-none focus:border-p-500 bg-n-0 resize-none"
          />
        )}
      </div>
    </DialogCard>
  )
}
