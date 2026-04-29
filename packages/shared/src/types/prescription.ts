export type PrescriptionStatus = 'draft' | 'signed'

export interface PrescriptionItem {
  drug: string
  dose: string
  route: string
  frequency: string
  duration: string | null
  instructions: string | null
}

export interface PrescriptionItemRow {
  id: string
  prescriptionId: string
  drug: string
  dose: string
  route: string
  frequency: string
  duration: string
  notes: string | null
  source: string | null
  sortOrder: number
  createdAt: string
}

export interface Prescription {
  id: string
  tenantId: string
  patientId: string
  doctorUserId: string
  consultationId: string | null
  groupTitle: string | null
  groupOrder: number
  status: PrescriptionStatus
  items: PrescriptionItem[]
  prescriptionItems: PrescriptionItemRow[]
  pdfUrl: string | null
  notes: string | null
  signedAt: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface ImagingOrder {
  id: string
  tenantId: string
  consultationId: string
  patientId: string
  doctorUserId: string
  groupTitle: string | null
  groupOrder: number
  studyType: string
  indication: string
  urgency: 'routine' | 'urgent' | 'stat'
  contrast: boolean
  fastingRequired: boolean
  specialInstructions: string | null
  source: string | null
  status: 'draft' | 'signed'
  signedAt: string | null
  pdfUrl: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface LabOrder {
  id: string
  tenantId: string
  consultationId: string
  patientId: string
  doctorUserId: string
  groupTitle: string | null
  groupOrder: number
  testName: string
  testCode: string | null
  indication: string
  urgency: 'routine' | 'urgent' | 'stat'
  fastingRequired: boolean
  sampleType: 'blood' | 'urine' | 'stool' | 'other'
  specialInstructions: string | null
  source: string | null
  status: 'draft' | 'signed'
  signedAt: string | null
  pdfUrl: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}
