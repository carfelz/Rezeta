import { useUpdateAppointmentStatus } from '@/hooks/appointments/use-appointments'
import { useStartConsultation } from '@/hooks/consultations/use-start-consultation'
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
  const statusMutation = useUpdateAppointmentStatus(appt.id)
  const { start, isStarting } = useStartConsultation()

  return (
    <AppointmentCard
      appt={appt}
      onEdit={onEdit}
      onDelete={onDelete}
      onStatusChange={(status) => {
        void statusMutation.mutateAsync({ status })
      }}
      isUpdatingStatus={statusMutation.isPending}
      onStartConsultation={() => start(appt)}
      isStartingConsultation={isStarting}
    />
  )
}
