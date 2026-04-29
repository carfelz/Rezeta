import type { ProtocolContent, ProtocolUsageStatus } from './protocol.js'

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
  content: ProtocolContent
  modifications: ProtocolUsageModifications
  modificationSummary: string | null
  parentUsageId: string | null
  triggerBlockId: string | null
  depth: number
  status: ProtocolUsageStatus
  checkedState: Record<string, boolean>
  completedAt: string | null
  notes: string | null
  appliedAt: string
  protocolTitle: string
  protocolTypeName: string
  versionNumber: number
  childUsages?: Array<{
    id: string
    protocolId: string
    protocolTitle: string
    depth: number
    status: ProtocolUsageStatus
  }>
}

export interface MedicationChange {
  block_id: string
  row_id: string
  field: 'drug' | 'dose' | 'route' | 'frequency' | 'notes'
  original_value: string
  modified_value: string
  timestamp: string
}

export interface MedicationAdded {
  block_id: string
  row_id: string
  drug: string
  dose: string
  route: string
  frequency: string
  notes?: string
  timestamp: string
}

export interface MedicationRemoved {
  block_id: string
  row_id: string
  drug: string
  timestamp: string
}

export interface StepEvent {
  step_id: string
  timestamp: string
}

export interface ChecklistItemEvent {
  item_id: string
  checked: boolean
  timestamp: string
}

export interface DecisionBranchSelected {
  decision_id: string
  branch_id: string
  linked_protocol_launched: boolean
  timestamp: string
}

export interface ImagingOrderQueued {
  order_id: string
  study_type: string
  timestamp: string
}

export interface ImagingOrderModified {
  order_id: string
  field: string
  original_value: string
  modified_value: string
  timestamp: string
}

export interface ImagingOrderRemoved {
  order_id: string
  study_type: string
  timestamp: string
}

export interface LabOrderQueued {
  order_id: string
  test_name: string
  timestamp: string
}

export interface LabOrderModified {
  order_id: string
  field: string
  original_value: string
  modified_value: string
  timestamp: string
}

export interface LabOrderRemoved {
  order_id: string
  test_name: string
  timestamp: string
}

export interface TextBlockEdited {
  block_id: string
  original_content: string
  modified_content: string
  timestamp: string
}

export interface ProtocolUsageModifications {
  medication_changes?: MedicationChange[]
  medications_added?: MedicationAdded[]
  medications_removed?: MedicationRemoved[]
  steps_completed?: StepEvent[]
  steps_skipped?: StepEvent[]
  checklist_items?: ChecklistItemEvent[]
  decision_branches?: DecisionBranchSelected[]
  imaging_orders_queued?: ImagingOrderQueued[]
  imaging_orders_modified?: ImagingOrderModified[]
  imaging_orders_removed?: ImagingOrderRemoved[]
  lab_orders_queued?: LabOrderQueued[]
  lab_orders_modified?: LabOrderModified[]
  lab_orders_removed?: LabOrderRemoved[]
  text_blocks_edited?: TextBlockEdited[]
}

export interface PrescriptionItemDto {
  drug: string
  dose: string
  route: string
  frequency: string
  duration: string
  notes?: string
  source?: string
}

export interface ImagingOrderDto {
  study_type: string
  indication: string
  urgency: 'routine' | 'urgent' | 'stat'
  contrast: boolean
  fasting_required: boolean
  special_instructions?: string
  source?: string
}

export interface LabOrderDto {
  test_name: string
  test_code?: string
  indication: string
  urgency: 'routine' | 'urgent' | 'stat'
  fasting_required: boolean
  sample_type: 'blood' | 'urine' | 'stool' | 'other'
  special_instructions?: string
  source?: string
}

export interface GeneratedPrescription {
  prescriptionId: string
  pdfUrl: string
  groupTitle: string | null
  groupOrder: number
}

export interface GeneratedImagingOrder {
  imagingOrderId: string
  pdfUrl: string
  groupTitle: string | null
  groupOrder: number
}

export interface GeneratedLabOrder {
  labOrderId: string
  pdfUrl: string
  groupTitle: string | null
  groupOrder: number
}

export interface ConsultationWithDetails extends Consultation {
  patientName: string
  locationName: string
  doctorName: string
  amendments: ConsultationAmendment[]
  protocolUsages: ConsultationProtocolUsage[]
}
