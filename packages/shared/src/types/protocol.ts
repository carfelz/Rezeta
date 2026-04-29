export type ProtocolStatus = 'draft' | 'active' | 'archived'
export type ProtocolUsageStatus = 'in_progress' | 'completed' | 'abandoned'
export type BlockType =
  | 'section'
  | 'text'
  | 'checklist'
  | 'steps'
  | 'decision'
  | 'dosage_table'
  | 'alert'
  | 'imaging_order'
  | 'lab_order'
export type AlertSeverity = 'info' | 'warning' | 'danger' | 'success'
export type OrderUrgency = 'routine' | 'urgent' | 'stat'
export type LabSampleType = 'blood' | 'urine' | 'stool' | 'other'

export interface ChecklistItem {
  id: string
  text: string
  critical?: boolean
}

export interface Step {
  id: string
  order: number
  title: string
  detail?: string
}

export interface DecisionBranch {
  id: string
  label: string
  action: string
  linked_protocol_id?: string
  auto_launch?: boolean
}

export interface DosageRow {
  id: string
  drug: string
  dose: string
  route: string
  frequency: string
  notes: string
}

export interface ImagingOrderItem {
  id: string
  study_type: string
  indication: string
  urgency: OrderUrgency
  contrast: boolean
  fasting_required: boolean
  special_instructions?: string
}

export interface LabOrderItem {
  id: string
  test_name: string
  test_code?: string
  indication: string
  urgency: OrderUrgency
  fasting_required: boolean
  sample_type: LabSampleType
  special_instructions?: string
}

export type ProtocolBlock =
  | {
      id: string
      type: 'section'
      title: string
      description?: string
      collapsed_by_default?: boolean
      blocks: ProtocolBlock[]
    }
  | { id: string; type: 'text'; content: string }
  | { id: string; type: 'checklist'; title?: string; items: ChecklistItem[] }
  | { id: string; type: 'steps'; title?: string; steps: Step[] }
  | { id: string; type: 'decision'; condition: string; branches: DecisionBranch[] }
  | { id: string; type: 'dosage_table'; title?: string; columns: string[]; rows: DosageRow[] }
  | { id: string; type: 'alert'; severity: AlertSeverity; title?: string; content: string }
  | { id: string; type: 'imaging_order'; title?: string; orders: ImagingOrderItem[] }
  | { id: string; type: 'lab_order'; title?: string; orders: LabOrderItem[] }

export interface ProtocolContent {
  version: string
  template_version?: string
  blocks: ProtocolBlock[]
}

export interface Protocol {
  id: string
  tenantId: string
  typeId: string
  title: string
  description: string | null
  specialty: string | null
  tags: string[]
  status: ProtocolStatus
  visibility: string
  currentVersionId: string | null
  isFavorite: boolean
  metadata: { auto_generated?: boolean; source_protocol_id?: string } | null
  createdBy: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface ProtocolSuggestion {
  id: string
  protocolId: string
  protocolVersionId: string
  tenantId: string
  patternType: string
  patternData: Record<string, unknown>
  suggestedChanges: Record<string, unknown>
  impactSummary: string
  occurrenceCount: number
  totalUses: number
  occurrencePercentage: number
  status: 'pending' | 'applied' | 'dismissed'
  appliedAt: string | null
  dismissedAt: string | null
  createdAt: string
}

export interface ProtocolVersion {
  id: string
  protocolId: string
  versionNumber: number
  content: ProtocolContent
  changeSummary: string | null
  authorUserId: string
  createdAt: string
}

export interface VersionListItem {
  id: string
  versionNumber: number
  changeSummary: string | null
  createdAt: string
  isCurrent: boolean
}

export interface VersionDetailResponse {
  id: string
  versionNumber: number
  content: ProtocolContent
  changeSummary: string | null
  createdAt: string
}

export interface ProtocolTemplate {
  id: string
  tenantId: string
  isSeeded: boolean
  name: string
  description: string | null
  suggestedSpecialty: string | null
  schema: ProtocolContent
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface ProtocolType {
  id: string
  tenantId: string
  templateId: string
  name: string
  isSeeded: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}
