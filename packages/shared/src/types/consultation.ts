export type ConsultationStatus = 'draft' | 'signed'

export interface Vitals {
  bloodPressureSystolic?: number
  bloodPressureDiastolic?: number
  heartRate?: number
  respiratoryRate?: number
  temperatureCelsius?: number
  oxygenSaturation?: number
  weightKg?: number
  heightCm?: number
}

export interface Consultation {
  id: string
  tenantId: string
  patientId: string
  doctorUserId: string
  locationId: string
  appointmentId: string | null
  status: ConsultationStatus
  chiefComplaint: string | null
  subjective: string | null
  objective: string | null
  assessment: string | null
  plan: string | null
  vitals: Vitals | null
  diagnoses: string[]
  signedAt: string | null
  signedByUserId: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface ConsultationAmendment {
  id: string
  consultationId: string
  amendedByUserId: string
  reason: string
  changes: Record<string, unknown>
  createdAt: string
}
