import {
  ProtocolBlock,
  ProtocolChecklist,
  ProtocolSteps,
  ProtocolDecision,
  ProtocolDosageTable,
  ProtocolAlert,
} from '@/components/ui/ProtocolBlock'
import type { ImagingOrderItem, LabOrderItem } from '@rezeta/shared'
import { VitalsBlock } from './blocks/VitalsBlock'
import { ClinicalNotesBlock } from './blocks/ClinicalNotesBlock'
import { blockTypeStrings } from './strings'

// Typed shapes matching ProtocolContentSchema (read from Zod types)
interface BaseBlock {
  id: string
  type: string
}
interface SectionBlock extends BaseBlock {
  type: 'section'
  title: string
  description?: string
  collapsed_by_default?: boolean
  blocks: ProtocolBlock[]
}
interface TextBlock extends BaseBlock {
  type: 'text'
  content: string
}
interface ChecklistBlock extends BaseBlock {
  type: 'checklist'
  title?: string
  items: Array<{ id: string; text: string; critical?: boolean }>
}
interface StepsBlock extends BaseBlock {
  type: 'steps'
  title?: string
  steps: Array<{ id: string; order: number; title: string; detail?: string }>
}
interface DecisionBlock extends BaseBlock {
  type: 'decision'
  condition: string
  branches: Array<{ id: string; label: string; action: string }>
}
interface DosageTableBlock extends BaseBlock {
  type: 'dosage_table'
  title?: string
  columns: readonly string[]
  rows: Array<{
    id: string
    drug: string
    dose: string
    route: string
    frequency: string
    notes: string
  }>
}
interface AlertBlock extends BaseBlock {
  type: 'alert'
  severity: 'info' | 'warning' | 'danger' | 'success'
  title?: string
  content: string
}
interface ImagingOrderBlock extends BaseBlock {
  type: 'imaging_order'
  title?: string
  orders: ImagingOrderItem[]
}
interface LabOrderBlock extends BaseBlock {
  type: 'lab_order'
  title?: string
  orders: LabOrderItem[]
}
interface VitalsField {
  id: string
  label: string
  unit?: string
  input_type: 'text' | 'number' | 'computed'
  formula?: string
}
interface VitalsBlockType extends BaseBlock {
  type: 'vitals'
  title?: string
  fields: VitalsField[]
}
interface ClinicalNotesBlockType extends BaseBlock {
  type: 'clinical_notes'
  label: string
  content: string
  required?: boolean
}

export type ProtocolBlock =
  | SectionBlock
  | TextBlock
  | ChecklistBlock
  | StepsBlock
  | DecisionBlock
  | DosageTableBlock
  | AlertBlock
  | ImagingOrderBlock
  | LabOrderBlock
  | VitalsBlockType
  | ClinicalNotesBlockType

const BLOCK_TYPE_LABELS: Record<string, string> = {
  section: blockTypeStrings.section,
  text: blockTypeStrings.text,
  checklist: blockTypeStrings.checklist,
  steps: blockTypeStrings.steps,
  decision: blockTypeStrings.decision,
  dosage_table: blockTypeStrings.dosageTable,
  alert: blockTypeStrings.alert,
  imaging_order: blockTypeStrings.imagingOrder,
  lab_order: blockTypeStrings.labOrder,
  vitals: blockTypeStrings.vitals,
  clinical_notes: blockTypeStrings.clinicalNotes,
}

function typeLabel(type: string): string {
  return BLOCK_TYPE_LABELS[type] ?? blockTypeStrings.unknown
}

interface BlockRendererProps {
  block: unknown
  nested?: boolean
}

export function BlockRenderer({ block, nested = false }: BlockRendererProps): JSX.Element | null {
  const b = block as ProtocolBlock

  switch (b.type) {
    case 'section':
      return (
        <ProtocolBlock type={typeLabel('section')} title={b.title} nested={nested}>
          {b.blocks.length > 0 ? (
            <div className="flex flex-col gap-0">
              {b.blocks.map((child) => (
                <BlockRenderer key={child.id} block={child} nested />
              ))}
            </div>
          ) : null}
        </ProtocolBlock>
      )

    case 'text':
      return (
        <ProtocolBlock type={typeLabel('text')} title={blockTypeStrings.text} nested={nested}>
          <p className="text-[13.5px] font-sans text-n-700 leading-[1.55] whitespace-pre-wrap">
            {b.content}
          </p>
        </ProtocolBlock>
      )

    case 'checklist':
      return (
        <ProtocolBlock
          type={typeLabel('checklist')}
          title={b.title ?? blockTypeStrings.checklist}
          nested={nested}
        >
          <ProtocolChecklist items={b.items} />
        </ProtocolBlock>
      )

    case 'steps':
      return (
        <ProtocolBlock
          type={typeLabel('steps')}
          title={b.title ?? blockTypeStrings.steps}
          nested={nested}
        >
          <ProtocolSteps steps={b.steps} />
        </ProtocolBlock>
      )

    case 'decision':
      return (
        <ProtocolBlock
          type={typeLabel('decision')}
          title={b.condition || blockTypeStrings.decision}
          nested={nested}
        >
          <ProtocolDecision condition={b.condition} branches={b.branches} />
        </ProtocolBlock>
      )

    case 'dosage_table':
      return (
        <ProtocolBlock
          type={typeLabel('dosage_table')}
          title={b.title ?? blockTypeStrings.dosageTable}
          nested={nested}
        >
          <ProtocolDosageTable rows={b.rows} {...(b.title ? { title: b.title } : {})} />
        </ProtocolBlock>
      )

    case 'alert':
      return (
        <ProtocolBlock
          type={typeLabel('alert')}
          title={b.title ?? blockTypeStrings.alert}
          nested={nested}
        >
          <ProtocolAlert
            severity={b.severity}
            content={b.content}
            {...(b.title ? { title: b.title } : {})}
          />
        </ProtocolBlock>
      )

    case 'imaging_order':
      return (
        <ProtocolBlock
          type={typeLabel('imaging_order')}
          title={b.title ?? blockTypeStrings.imagingOrder}
          nested={nested}
        >
          <div className="flex flex-col gap-2">
            {b.orders.map((o) => (
              <div key={o.id} className="text-[13px] font-sans text-n-700">
                <span className="font-medium">{o.study_type}</span>
                {o.indication && <span className="text-n-500"> · {o.indication}</span>}
              </div>
            ))}
          </div>
        </ProtocolBlock>
      )

    case 'lab_order':
      return (
        <ProtocolBlock
          type={typeLabel('lab_order')}
          title={b.title ?? blockTypeStrings.labOrder}
          nested={nested}
        >
          <div className="flex flex-col gap-2">
            {b.orders.map((o) => (
              <div key={o.id} className="text-[13px] font-sans text-n-700">
                <span className="font-medium">{o.test_name}</span>
                {o.indication && <span className="text-n-500"> · {o.indication}</span>}
              </div>
            ))}
          </div>
        </ProtocolBlock>
      )

    case 'vitals':
      return (
        <ProtocolBlock
          type={typeLabel('vitals')}
          title={b.title ?? blockTypeStrings.vitals}
          nested={nested}
        >
          <VitalsBlock fields={b.fields} readOnly />
        </ProtocolBlock>
      )

    case 'clinical_notes':
      return (
        <ProtocolBlock
          type={typeLabel('clinical_notes')}
          title={b.label}
          nested={nested}
        >
          <ClinicalNotesBlock
            label={b.label}
            content={b.content}
            {...(b.required !== undefined ? { required: b.required } : {})}
            readOnly
          />
        </ProtocolBlock>
      )

    default:
      return null
  }
}
