import { Button, Row } from '@/components/ui'
import { ProtocolPills } from '@/components/consultations/ProtocolPills'
import { collectUsageCheckableIds, deriveCheckedState } from '@/lib/consultation/usage'
import type { ConsultationProtocolUsage, ConsultationWithDetails } from '@rezeta/shared'

export interface ProtocolBarProps {
  consultation: ConsultationWithDetails
  activeUsage: ConsultationProtocolUsage | undefined
  isSigned: boolean
  onSelectUsage: (id: string) => void
  onAddProtocol: () => void
  onAddOffProtocolNote: () => void
}

export function ProtocolBar({
  consultation,
  activeUsage,
  isSigned,
  onSelectUsage,
  onAddProtocol,
  onAddOffProtocolNote,
}: ProtocolBarProps): JSX.Element {
  return (
    <>
      {consultation.protocolUsages.length > 1 && activeUsage && (
        <div className="-mx-6">
          <ProtocolPills
            pills={consultation.protocolUsages.map((u) => {
              const ids = collectUsageCheckableIds(u)
              const checkedState = deriveCheckedState(u)
              const checked = ids.filter((cid) => checkedState[cid]).length
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
