import type { ConsultationWithDetails } from '@rezeta/shared'
import { OrderQueuePanel } from '@/components/consultations/OrderQueuePanel'
import { ConsultationSidebar } from '@/components/consultations/ConsultationSidebar'
import { useNavigate } from 'react-router-dom'
import { formatDate } from './helpers'
import { usePatient } from '@/hooks/patients/use-patients'
import { usePatientConsultations } from '@/hooks/consultations/use-consultations'

interface OrdersRailProps {
  consultation: ConsultationWithDetails
  readOnly: boolean
}

export function OrdersRail({ consultation, readOnly }: OrdersRailProps): JSX.Element {
  const navigate = useNavigate()
  const { data: patient } = usePatient(consultation.patientId)
  const { data: prevConsultations = [] } = usePatientConsultations(consultation.patientId)
  const prevList = prevConsultations
    .filter((c) => c.id !== consultation.id)
    .slice(0, 4)
    .map((c) => ({
      id: c.id,
      consultedAt: c.startedAt,
      chiefComplaint: c.protocolUsages[0]?.protocolTitle ?? null,
    }))

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        <ConsultationSidebar
          consultationId={consultation.id}
          isSigned={readOnly}
          hasProtocols={consultation.protocolUsages.length > 0}
          patient={patient ?? null}
          prevList={prevList}
          onAddProtocol={() => undefined}
          onPrevClick={(prevId) => void navigate(`/consultas/${prevId}`)}
          formatDate={formatDate}
        />
        <OrderQueuePanel consultationId={consultation.id} isSigned={readOnly} />
      </div>
    </div>
  )
}
