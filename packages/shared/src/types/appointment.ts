export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show'

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
}
