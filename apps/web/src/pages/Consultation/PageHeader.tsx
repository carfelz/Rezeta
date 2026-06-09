import { Button } from '@/components/ui'
import { SaveBadge, type SaveStatus } from '@/components/consultations/SaveBadge'
import { cn } from '@/lib/utils'
import { formatKicker } from './helpers'

export interface PageHeaderProps {
  consultedAt: string
  locationName: string
  patientName: string
  doctorName: string
  patientAllergies?: string[]
  patientChronicConditions?: string[]
  pageTitle: string
  saveStatus: SaveStatus
  savedAt?: Date
  isSigned: boolean
  onAmend: () => void
  onRetry: () => void
  onSignClick: () => void
}

export function PageHeader({
  consultedAt,
  locationName,
  patientName,
  doctorName,
  patientAllergies,
  patientChronicConditions,
  pageTitle,
  saveStatus,
  savedAt,
  isSigned,
  onAmend,
  onRetry,
  onSignClick,
}: PageHeaderProps): JSX.Element {
  return (
    <div className="flex items-start justify-between gap-6 mb-6">
      <div className="min-w-0">
        <div className="text-[11.5px] font-mono uppercase tracking-[0.08em] text-n-400 mb-1">
          {formatKicker(consultedAt, locationName)}
        </div>
        <h1
          className={cn(
            'text-[28px] font-serif font-medium tracking-[-0.01em] leading-tight mb-1',
            pageTitle === 'Nueva consulta' ? 'text-n-400' : 'text-n-900',
          )}
        >
          {pageTitle}
        </h1>
        <p className="text-[13px] font-sans text-n-500">
          {patientName} · {doctorName}
        </p>
        {((patientAllergies && patientAllergies.length > 0) ||
          (patientChronicConditions && patientChronicConditions.length > 0)) && (
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            {patientAllergies && patientAllergies.length > 0 && patientAllergies.map((allergy) => (
              <span
                key={allergy}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-danger-bg border border-danger-border text-danger-text text-xs font-medium"
              >
                <i className="ph ph-warning text-danger-text" />
                {allergy}
              </span>
            ))}
            {patientChronicConditions && patientChronicConditions.length > 0 && patientChronicConditions.map((condition) => (
              <span
                key={condition}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-warning-bg border border-warning-border text-warning-text text-xs font-medium"
              >
                <i className="ph ph-heart-break text-warning-text" />
                {condition}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0 pt-1">
        <SaveBadge
          status={saveStatus}
          {...(savedAt !== undefined ? { savedAt } : {})}
          onRetry={onRetry}
        />
        {isSigned ? (
          <Button variant="secondary" size="sm" onClick={onAmend}>
            <i className="ph ph-pencil-simple mr-1" />
            Enmienda
          </Button>
        ) : (
          <Button variant="primary" size="sm" onClick={onSignClick}>
            <i className="ph ph-check mr-1" />
            Firmar y cerrar
          </Button>
        )}
      </div>
    </div>
  )
}
