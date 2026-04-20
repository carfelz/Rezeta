import { ProtocolBlock, ProtocolChecklist, ProtocolSteps, ProtocolDecision, ProtocolDosageTable, ProtocolAlert } from '@/components/ui/ProtocolBlock'
import { strings } from '@/lib/strings'

// Typed shapes matching ProtocolContentSchema (read from Zod types)
interface BaseBlock { id: string; type: string }
interface SectionBlock extends BaseBlock { type: 'section'; title: string; description?: string; collapsed_by_default?: boolean; blocks: ProtocolBlock[] }
interface TextBlock extends BaseBlock { type: 'text'; content: string }
interface ChecklistBlock extends BaseBlock { type: 'checklist'; title?: string; items: Array<{ id: string; text: string; critical?: boolean }> }
interface StepsBlock extends BaseBlock { type: 'steps'; title?: string; steps: Array<{ id: string; order: number; title: string; detail?: string }> }
interface DecisionBlock extends BaseBlock { type: 'decision'; condition: string; branches: Array<{ id: string; label: string; action: string }> }
interface DosageTableBlock extends BaseBlock { type: 'dosage_table'; title?: string; columns: readonly string[]; rows: Array<{ id: string; drug: string; dose: string; route: string; frequency: string; notes: string }> }
interface AlertBlock extends BaseBlock { type: 'alert'; severity: 'info' | 'warning' | 'danger' | 'success'; title?: string; content: string }

export type ProtocolBlock =
  | SectionBlock
  | TextBlock
  | ChecklistBlock
  | StepsBlock
  | DecisionBlock
  | DosageTableBlock
  | AlertBlock

const BLOCK_TYPE_LABELS: Record<string, string> = {
  section: strings.BLOCK_TYPE_SECTION,
  text: strings.BLOCK_TYPE_TEXT,
  checklist: strings.BLOCK_TYPE_CHECKLIST,
  steps: strings.BLOCK_TYPE_STEPS,
  decision: strings.BLOCK_TYPE_DECISION,
  dosage_table: strings.BLOCK_TYPE_DOSAGE_TABLE,
  alert: strings.BLOCK_TYPE_ALERT,
}

function typeLabel(type: string): string {
  return BLOCK_TYPE_LABELS[type] ?? strings.BLOCK_TYPE_UNKNOWN
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
        <ProtocolBlock type={typeLabel('text')} title={strings.BLOCK_TYPE_TEXT} nested={nested}>
          <p className="text-[13.5px] font-sans text-n-700 leading-[1.55] whitespace-pre-wrap">
            {b.content}
          </p>
        </ProtocolBlock>
      )

    case 'checklist':
      return (
        <ProtocolBlock type={typeLabel('checklist')} title={b.title ?? strings.BLOCK_TYPE_CHECKLIST} nested={nested}>
          <ProtocolChecklist items={b.items} />
        </ProtocolBlock>
      )

    case 'steps':
      return (
        <ProtocolBlock type={typeLabel('steps')} title={b.title ?? strings.BLOCK_TYPE_STEPS} nested={nested}>
          <ProtocolSteps steps={b.steps} />
        </ProtocolBlock>
      )

    case 'decision':
      return (
        <ProtocolBlock type={typeLabel('decision')} title={b.condition || strings.BLOCK_TYPE_DECISION} nested={nested}>
          <ProtocolDecision condition={b.condition} branches={b.branches} />
        </ProtocolBlock>
      )

    case 'dosage_table':
      return (
        <ProtocolBlock type={typeLabel('dosage_table')} title={b.title ?? strings.BLOCK_TYPE_DOSAGE_TABLE} nested={nested}>
          <ProtocolDosageTable rows={b.rows} {...(b.title ? { title: b.title } : {})} />
        </ProtocolBlock>
      )

    case 'alert':
      return (
        <ProtocolBlock type={typeLabel('alert')} title={b.title ?? strings.BLOCK_TYPE_ALERT} nested={nested}>
          <ProtocolAlert severity={b.severity} content={b.content} {...(b.title ? { title: b.title } : {})} />
        </ProtocolBlock>
      )

    default:
      return null
  }
}
