import { Button } from '@/components/ui'
import { AsideCard } from './AsideCard'
import { OrderQueuePanel } from './OrderQueuePanel'
import { consultationSidebarStrings } from './strings'

interface PatientLite {
  allergies: string[]
  chronicConditions: string[]
}

interface PrevConsultation {
  id: string
  consultedAt: string
  chiefComplaint: string | null
}

export interface ConsultationSidebarProps {
  consultationId: string
  isSigned: boolean
  hasProtocols: boolean
  patient: PatientLite | null | undefined
  prevList: PrevConsultation[]
  onAddProtocol: () => void
  onPrevClick: (id: string) => void
  formatDate: (iso: string) => string
  /**
   * Active consultation view mode. In canvas mode the protocol step spine is
   * rendered in the body, so the sidebar hides Consultas previas to reduce
   * noise. ALERTAS and ÓRDENES stay visible in both modes.
   */
  viewMode?: 'soap' | 'canvas'
}

/**
 * Page-level sidebar shown alongside both SOAP and canvas views in the
 * consultation page. Composes alerts, the protocols empty-state card,
 * the previous-consultations list, and the orders queue panel.
 */
export function ConsultationSidebar({
  consultationId,
  isSigned,
  hasProtocols,
  patient,
  prevList,
  onAddProtocol,
  onPrevClick,
  formatDate,
  viewMode = 'soap',
}: ConsultationSidebarProps): JSX.Element {
  const isCanvas = viewMode === 'canvas'
  return (
    <div className="flex flex-col gap-4">
      {patient && (patient.allergies.length > 0 || patient.chronicConditions.length > 0) && (
        <AsideCard title={consultationSidebarStrings.patientAlertsTitle}>
          <div className="flex flex-col gap-2">
            {patient.allergies.map((a) => (
              <div
                key={a}
                className="flex gap-3 px-3 py-3 bg-danger-bg border border-danger-border rounded text-[12.5px] text-danger-text leading-[1.4]"
              >
                <i className="ph ph-x-circle text-[16px] shrink-0 mt-1" />
                <div>
                  <strong>{consultationSidebarStrings.allergyPrefix}</strong> · {a}
                </div>
              </div>
            ))}
            {patient.chronicConditions.map((c) => (
              <div
                key={c}
                className="flex gap-3 px-3 py-3 bg-warning-bg border border-warning-border rounded text-[12.5px] text-warning-text leading-[1.4]"
              >
                <i className="ph ph-warning-circle text-[16px] shrink-0 mt-1" />
                <div>{c}</div>
              </div>
            ))}
          </div>
        </AsideCard>
      )}

      {!hasProtocols && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-mono uppercase tracking-[0.06em] text-n-400">
              {consultationSidebarStrings.protocolsLabel}
            </span>
            {!isSigned && (
              <Button variant="secondary" size="sm" onClick={onAddProtocol}>
                <i className="ph ph-plus text-[12px]" />
                {consultationSidebarStrings.addProtocolButton}
              </Button>
            )}
          </div>
          <div className="flex flex-col items-center gap-2 py-6 border border-dashed border-n-200 rounded-md text-center">
            <i className="ph ph-stack text-[22px] text-n-400" />
            <p className="text-[12.5px] text-n-400">
              {isSigned
                ? consultationSidebarStrings.noProtocolsSigned
                : consultationSidebarStrings.noProtocolsUnsigned}
            </p>
          </div>
        </div>
      )}

      {!isCanvas && prevList.length > 0 && (
        <AsideCard title={consultationSidebarStrings.prevConsultationsTitle}>
          <div className="flex flex-col gap-1">
            {prevList.map((c) => (
              <Button
                key={c.id}
                variant="item"
                size="sm"
                onClick={() => onPrevClick(c.id)}
                className="flex items-center justify-between w-full text-left py-2"
              >
                <span className="truncate flex-1 text-left">
                  {c.chiefComplaint ?? consultationSidebarStrings.noChiefComplaint}
                </span>
                <span className="font-mono text-n-400 text-[11px] shrink-0 ml-2">
                  {formatDate(c.consultedAt)}
                </span>
              </Button>
            ))}
          </div>
        </AsideCard>
      )}

      <OrderQueuePanel consultationId={consultationId} isSigned={isSigned} />
    </div>
  )
}
