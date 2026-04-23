export type ProtocolStatus = 'draft' | 'active' | 'archived'
export type BlockType = 'section' | 'text' | 'checklist' | 'steps' | 'decision' | 'dosage_table' | 'alert'
export type AlertSeverity = 'info' | 'warning' | 'danger' | 'success'

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
}

export interface DosageRow {
  id: string
  drug: string
  dose: string
  route: string
  frequency: string
  notes: string
}

export type ProtocolBlock =
  | { id: string; type: 'section'; title: string; description?: string; collapsed_by_default?: boolean; blocks: ProtocolBlock[] }
  | { id: string; type: 'text'; content: string }
  | { id: string; type: 'checklist'; title?: string; items: ChecklistItem[] }
  | { id: string; type: 'steps'; title?: string; steps: Step[] }
  | { id: string; type: 'decision'; condition: string; branches: DecisionBranch[] }
  | { id: string; type: 'dosage_table'; title?: string; columns: string[]; rows: DosageRow[] }
  | { id: string; type: 'alert'; severity: AlertSeverity; title?: string; content: string }

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
  tags: string[]
  status: ProtocolStatus
  currentVersionId: string | null
  isFavorite: boolean
  createdBy: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
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
