export type ProtocolStatus = 'draft' | 'active' | 'archived'

export const PROTOCOL_USAGE_STATUSES = [
  'in_progress',
  'completed',
  'abandoned',
  'switched',
] as const
export type ProtocolUsageStatus = (typeof PROTOCOL_USAGE_STATUSES)[number]

/**
 * Where a recommendation came from. Surfaced to the UI so per-patient claims
 * (e.g. "Última: hace 3 meses", "MÁS PROBABLE") only render when the entry
 * actually has prior use with the current patient.
 *  - 'patient-history': prior usage with this specific patient
 *  - 'doctor-history':  doctor's overall usage frequency, no per-patient signal
 *  - 'fallback':        tenant-active protocols, no usage signal at all
 */
export type ProtocolRecommendationSource = 'patient-history' | 'doctor-history' | 'fallback'

/**
 * Patient-history-based protocol recommendation, used to rank cards on the
 * consultation gate. Sources: prior usages of this protocol with the same
 * patient (recency + frequency) and the doctor's overall usage frequency.
 */
export interface ProtocolRecommendation {
  protocolId: string
  title: string
  typeId: string
  typeName: string
  currentVersionNumber: number | null
  /** ISO timestamp of the most recent prior usage with this patient. Null
   * unless `source === 'patient-history'`. */
  lastUsedAt: string | null
  /** Number of prior usages with this patient. Zero unless
   * `source === 'patient-history'`. */
  usageCount: number
  /** True only for the top entry when its `source === 'patient-history'`. */
  isMostProbable: boolean
  source: ProtocolRecommendationSource
}
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

export type ComparisonOp = '<' | '<=' | '>' | '>=' | '==' | '!='

export type ConditionalRule =
  | { kind: 'cmp'; field: string; op: ComparisonOp; value: number | string | boolean }
  | { kind: 'and'; rules: ConditionalRule[] }
  | { kind: 'or'; rules: ConditionalRule[] }
  | { kind: 'not'; rule: ConditionalRule }

interface BlockBase {
  id: string
  conditional_rule?: ConditionalRule
  conditional_label?: string
}

export type ProtocolBlock =
  | (BlockBase & {
      type: 'section'
      title: string
      description?: string
      collapsed_by_default?: boolean
      blocks: ProtocolBlock[]
    })
  | (BlockBase & { type: 'text'; content: string })
  | (BlockBase & { type: 'checklist'; title?: string; items: ChecklistItem[] })
  | (BlockBase & { type: 'steps'; title?: string; steps: Step[] })
  | (BlockBase & { type: 'decision'; condition: string; branches: DecisionBranch[] })
  | (BlockBase & { type: 'dosage_table'; title?: string; columns: string[]; rows: DosageRow[] })
  | (BlockBase & { type: 'alert'; severity: AlertSeverity; title?: string; content: string })
  | (BlockBase & { type: 'imaging_order'; title?: string; orders: ImagingOrderItem[] })
  | (BlockBase & { type: 'lab_order'; title?: string; orders: LabOrderItem[] })

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
