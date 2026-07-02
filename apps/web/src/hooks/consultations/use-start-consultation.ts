import { useNavigate } from 'react-router-dom'
import type { AppointmentWithDetails } from '@rezeta/shared'
import { useCreateConsultation } from './use-consultations'

/**
 * Shared start/continue logic for an appointment's consultation.
 * If the appointment already has a consultation, navigate to it; otherwise
 * create one (linked to the appointment) and navigate to the new consultation.
 * Used by the Schedule agenda and the Dashboard upcoming-appointments rows.
 */
export function useStartConsultation(): {
  start: (appt: AppointmentWithDetails) => void
  isStarting: boolean
} {
  const navigate = useNavigate()
  const createConsultation = useCreateConsultation()

  return {
    start: (appt) => {
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
        // The mutation's onError already toasts; swallow the rejection so it
        // doesn't surface as an unhandled promise rejection. Navigation simply
        // doesn't happen on failure.
        .catch(() => undefined)
    },
    isStarting: createConsultation.isPending,
  }
}
