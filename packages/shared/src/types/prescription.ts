export type PrescriptionStatus = 'draft' | 'signed'

export interface PrescriptionItem {
  drug: string
  dose: string
  route: string
  frequency: string
  duration: string | null
  instructions: string | null
}

export interface Prescription {
  id: string
  tenantId: string
  patientId: string
  doctorUserId: string
  consultationId: string | null
  status: PrescriptionStatus
  items: PrescriptionItem[]
  notes: string | null
  signedAt: string | null
  signedByUserId: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}
