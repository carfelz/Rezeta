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
  // When true, leaf blocks render their inner content directly, without the
  // ProtocolBlock chrome (header chip + title). Used by EditorBlockRenderer's
  // unselected leaf card, which already renders its own typed header — the
  // ProtocolBlock chrome there would otherwise duplicate it.
  chromeless?: boolean
}

export function BlockRenderer({
  block,
  nested = false,
  chromeless = false,
}: BlockRendererProps): JSX.Element | null {
  const b = block as ProtocolBlock

  switch (b.type) {
    case 'section': {
      const content =
        b.blocks.length > 0 ? (
          <div className="flex flex-col gap-0">
            {b.blocks.map((child) => (
              <BlockRenderer key={child.id} block={child} nested />
            ))}
          </div>
        ) : null
      if (chromeless) return content
      return (
        <ProtocolBlock type={typeLabel('section')} title={b.title} nested={nested}>
          {content}
        </ProtocolBlock>
      )
    }

    case 'text': {
      const content = (
        <p className="text-sm font-sans text-n-700 leading-prose whitespace-pre-wrap">
          {b.content}
        </p>
      )
      if (chromeless) return content
      return (
        <ProtocolBlock type={typeLabel('text')} title={blockTypeStrings.text} nested={nested}>
          {content}
        </ProtocolBlock>
      )
    }

    case 'checklist': {
      const content = <ProtocolChecklist items={b.items} />
      if (chromeless) return content
      return (
        <ProtocolBlock
          type={typeLabel('checklist')}
          title={b.title ?? blockTypeStrings.checklist}
          nested={nested}
        >
          {content}
        </ProtocolBlock>
      )
    }

    case 'steps': {
      const content = <ProtocolSteps steps={b.steps} />
      if (chromeless) return content
      return (
        <ProtocolBlock
          type={typeLabel('steps')}
          title={b.title ?? blockTypeStrings.steps}
          nested={nested}
        >
          {content}
        </ProtocolBlock>
      )
    }

    case 'decision': {
      const content = <ProtocolDecision condition={b.condition} branches={b.branches} />
      if (chromeless) return content
      return (
        <ProtocolBlock
          type={typeLabel('decision')}
          title={b.condition || blockTypeStrings.decision}
          nested={nested}
        >
          {content}
        </ProtocolBlock>
      )
    }

    case 'dosage_table': {
      if (chromeless) return <ProtocolDosageTable rows={b.rows} />
      return (
        <ProtocolBlock
          type={typeLabel('dosage_table')}
          title={b.title ?? blockTypeStrings.dosageTable}
          nested={nested}
        >
          <ProtocolDosageTable rows={b.rows} {...(b.title ? { title: b.title } : {})} />
        </ProtocolBlock>
      )
    }

    case 'alert': {
      if (chromeless) return <ProtocolAlert severity={b.severity} content={b.content} />
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
    }

    case 'imaging_order': {
      const content = (
        <div className="flex flex-col gap-2">
          {b.orders.map((o) => (
            <div key={o.id} className="text-sm font-sans text-n-700">
              <span className="font-medium">{o.study_type}</span>
              {o.indication && <span className="text-n-500"> · {o.indication}</span>}
            </div>
          ))}
        </div>
      )
      if (chromeless) return content
      return (
        <ProtocolBlock
          type={typeLabel('imaging_order')}
          title={b.title ?? blockTypeStrings.imagingOrder}
          nested={nested}
        >
          {content}
        </ProtocolBlock>
      )
    }

    case 'lab_order': {
      const content = (
        <div className="flex flex-col gap-2">
          {b.orders.map((o) => (
            <div key={o.id} className="text-sm font-sans text-n-700">
              <span className="font-medium">{o.test_name}</span>
              {o.indication && <span className="text-n-500"> · {o.indication}</span>}
            </div>
          ))}
        </div>
      )
      if (chromeless) return content
      return (
        <ProtocolBlock
          type={typeLabel('lab_order')}
          title={b.title ?? blockTypeStrings.labOrder}
          nested={nested}
        >
          {content}
        </ProtocolBlock>
      )
    }

    case 'vitals': {
      const content = <VitalsBlock fields={b.fields} readOnly />
      if (chromeless) return content
      return (
        <ProtocolBlock
          type={typeLabel('vitals')}
          {...(b.title ? { title: b.title } : {})}
          nested={nested}
        >
          {content}
        </ProtocolBlock>
      )
    }

    case 'clinical_notes': {
      const content = (
        <ClinicalNotesBlock
          label={b.label}
          content={b.content}
          {...(b.required !== undefined ? { required: b.required } : {})}
          readOnly
        />
      )
      if (chromeless) return content
      return (
        <ProtocolBlock type={typeLabel('clinical_notes')} nested={nested}>
          {content}
        </ProtocolBlock>
      )
    }

    default:
      return null
  }
}
