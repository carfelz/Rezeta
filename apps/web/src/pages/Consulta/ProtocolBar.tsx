import { Button, Row } from '@/components/ui'
import { ProtocolPills } from '@/components/consultations/ProtocolPills'
import { ProtocolStrip } from '@/components/consultations/ProtocolStrip'
import { collectUsageCheckableIds } from '@/lib/consultation/usage'
import type { ConsultationProtocolUsage, ConsultationWithDetails } from '@rezeta/shared'
import type { ConsultationViewMode } from '@/store/ui.store'

export interface ProtocolBarProps {
  consultation: ConsultationWithDetails
  activeUsage: ConsultationProtocolUsage | undefined
  isSigned: boolean
  viewMode: ConsultationViewMode
  onViewModeChange: (mode: ConsultationViewMode) => void
  onSelectUsage: (id: string) => void
  onAddProtocol: () => void
  onSwitchProtocol: () => void
  onAddOffProtocolNote: () => void
}

export function ProtocolBar({
  consultation,
  activeUsage,
  isSigned,
  viewMode,
  onViewModeChange,
  onSelectUsage,
  onAddProtocol,
  onSwitchProtocol,
  onAddOffProtocolNote,
}: ProtocolBarProps): JSX.Element {
  return (
    <>
      {consultation.protocolUsages.length > 1 && activeUsage && (
        <div className="-mx-12">
          <ProtocolPills
            pills={consultation.protocolUsages.map((u) => {
              const ids = collectUsageCheckableIds(u)
              const checked = ids.filter((cid) => (u.checkedState ?? {})[cid]).length
              return {
                id: u.id,
                title: u.protocolTitle,
                completed: checked,
                total: ids.length,
                isActive: u.id === activeUsage.id,
              }
            })}
            onSelect={onSelectUsage}
            onAdd={onAddProtocol}
            showAdd={!isSigned}
          />
        </div>
      )}

      {activeUsage && (
        <div className="-mx-12 mb-5">
          {!isSigned ? (
            <ProtocolStrip
              key={activeUsage.id}
              usage={activeUsage}
              isSigned={isSigned}
              onChangePicker={onSwitchProtocol}
              viewMode={viewMode}
              onViewModeChange={onViewModeChange}
            />
          ) : (
            <ProtocolStrip
              key={activeUsage.id}
              usage={activeUsage}
              isSigned={isSigned}
              onChangePicker={onSwitchProtocol}
            />
          )}
        </div>
      )}

      {activeUsage && !isSigned && (
        <Row justify="end" className="mb-3">
          <Button variant="secondary" size="sm" onClick={onAddOffProtocolNote}>
            <i className="ph ph-pencil-simple text-[12px]" />
            Añadir nota fuera de protocolo
          </Button>
        </Row>
      )}
    </>
  )
}
