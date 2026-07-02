export type AppointmentStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'

export type AppointmentConsultationStatus = 'open' | 'signed' | 'amended'

export interface Appointment {
  id: string
  tenantId: string
  patientId: string
  doctorUserId: string
  locationId: string
  status: AppointmentStatus
  startsAt: string
  endsAt: string
  reason: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface AppointmentWithDetails extends Appointment {
  patientName: string
  patientDocumentNumber: string | null
  locationName: string
  /** Latest live consultation linked to this appointment (null = none). */
  consultationId: string | null
  consultationStatus: AppointmentConsultationStatus | null
}
