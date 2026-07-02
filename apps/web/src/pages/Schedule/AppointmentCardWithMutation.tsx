import { useNavigate } from 'react-router-dom'
import { useUpdateAppointmentStatus } from '@/hooks/appointments/use-appointments'
import { useCreateConsultation } from '@/hooks/consultations/use-consultations'
import type { AppointmentWithDetails } from '@rezeta/shared'
import { AppointmentCard } from './AppointmentCard'

export interface AppointmentCardWithMutationProps {
  appt: AppointmentWithDetails
  onEdit: () => void
  onDelete: () => void
}

export function AppointmentCardWithMutation({
  appt,
  onEdit,
  onDelete,
}: AppointmentCardWithMutationProps): JSX.Element {
  const navigate = useNavigate()
  const statusMutation = useUpdateAppointmentStatus(appt.id)
  const createConsultation = useCreateConsultation()

  const handleStartConsultation = (): void => {
    if (appt.consultationId) {
      void navigate(`/consultas/${appt.consultationId}`)
      return
    }
    void createConsultation
      .mutateAsync({
        patientId: appt.patientId,
        locationId: appt.locationId,
        appointmentId: appt.id,
      })
      .then((c) => navigate(`/consultas/${c.id}`))
  }

  return (
    <AppointmentCard
      appt={appt}
      onEdit={onEdit}
      onDelete={onDelete}
      onStatusChange={(status) => {
        void statusMutation.mutateAsync({ status })
      }}
      isUpdatingStatus={statusMutation.isPending}
      onStartConsultation={handleStartConsultation}
      isStartingConsultation={createConsultation.isPending}
    />
  )
}
