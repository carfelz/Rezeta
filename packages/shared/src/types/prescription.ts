export type PrescriptionStatus = 'queued' | 'signed'

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
  createdAt: string
}

export interface ImagingOrderItemRow {
  id: string
  imagingOrderId: string
  studyType: string
  indication: string
  urgency: 'routine' | 'urgent' | 'stat'
  contrast: boolean
  fastingRequired: boolean
  specialInstructions: string | null
  source: string | null
  createdAt: string
}

export interface LabOrderItemRow {
  id: string
  labOrderId: string
  testName: string
  indication: string
  urgency: 'routine' | 'urgent' | 'stat'
  fastingRequired: boolean
  sampleType: 'blood' | 'urine' | 'stool' | 'csf' | 'other'
  specialInstructions: string | null
  source: string | null
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
  prescriptionItems: PrescriptionItemRow[]
  pdfUrl: string | null
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
  status: 'queued' | 'signed'
  signedAt: string | null
  pdfUrl: string | null
  items: ImagingOrderItemRow[]
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
  status: 'queued' | 'signed'
  signedAt: string | null
  pdfUrl: string | null
  items: LabOrderItemRow[]
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}
