import { Caption, Chip, SelectableCard } from '@/components/ui'
import type { ConsultationWithDetails } from '@rezeta/shared'

export function ConsultationListItem({
  consultation,
  onClick,
}: {
  consultation: ConsultationWithDetails
  onClick: () => void
}): JSX.Element {
  const date = new Date(consultation.consultedAt).toLocaleDateString('es-DO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  const isSigned = consultation.status === 'signed'

  return (
    <SelectableCard density="compact" onClick={onClick}>
      <i className="ph ph-notepad text-[16px] text-n-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-n-800 truncate">
          {consultation.chiefComplaint ?? 'Sin motivo registrado'}
        </div>
        <Caption tone="neutral" size="sm" as="div" className="mt-1">
          {date} · {consultation.locationName}
        </Caption>
      </div>
      <Chip tone={isSigned ? 'primarySolid' : 'neutral'} size="sm">
        {isSigned ? 'Firmada' : 'Borrador'}
      </Chip>
      <i className="ph ph-caret-right text-[13px] text-n-300 shrink-0" />
    </SelectableCard>
  )
}
