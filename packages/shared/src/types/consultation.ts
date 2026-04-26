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
  consultedAt: string
  signedAt: string | null
  signedByUserId: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface ConsultationAmendment {
  id: string
  consultationId: string
  amendmentNumber: number
  amendedByUserId: string
  reason: string
  content: Record<string, unknown>
  amendedAt: string
  signedAt: string | null
}

export interface ConsultationProtocolUsage {
  id: string
  tenantId: string
  consultationId: string
  protocolId: string
  protocolVersionId: string
  checkedState: Record<string, boolean>
  completedAt: string | null
  notes: string | null
  appliedAt: string
  protocolTitle: string
  protocolTypeName: string
  versionNumber: number
}

export interface ConsultationWithDetails extends Consultation {
  patientName: string
  locationName: string
  doctorName: string
  amendments: ConsultationAmendment[]
  protocolUsages: ConsultationProtocolUsage[]
}
