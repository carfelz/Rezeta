import { Button, NativeSelect, Input } from '@/components/ui'
import type { ProtocolBlock } from '@/components/protocols/BlockRenderer'
import type { HistoriaMapping } from '@rezeta/shared'
import { RECORD_SECTION_TITLES, RECORD_SECTION_KEYS } from '@rezeta/shared'
import { protocolEditorStrings as s } from './strings'

// The schema-level restriction on HistoriaMappingEntry.section (excludes
// ficha_identificacion/enmiendas/plan_tratamiento — see
// packages/shared/src/schemas/protocol.ts) drives this type; keep both in sync.
type SelectableSection = NonNullable<HistoriaMapping[string]['section']>

// Fixed destination: fed from signed order records, never mappable.
const LOCKED_TYPES = new Set(['dosage_table', 'lab_order', 'imaging_order'])
// Reference material only (spec §6): never included in the historia, so the
// toggle is locked off — clicking it can never write a no-op mapping entry.
const EXCLUDED_BY_DEFAULT = new Set(['alert', 'text'])
const DEFAULT_SECTION: Record<string, SelectableSection> = {
  vitals: 'examen_fisico',
  checklist: 'evolucion',
  steps: 'evolucion',
  decision: 'evolucion',
  clinical_notes: 'evolucion', // display default; real routing label-matches at generation time
}
const SELECTABLE_SECTIONS = RECORD_SECTION_KEYS.filter(
  (k): k is SelectableSection =>
    k !== 'ficha_identificacion' && k !== 'enmiendas' && k !== 'plan_tratamiento',
)

interface Props {
  blocks: ProtocolBlock[]
  mapping: HistoriaMapping | undefined
  onChange: (next: HistoriaMapping) => void
}

function flatten(blocks: ProtocolBlock[]): ProtocolBlock[] {
  return blocks.flatMap((b) =>
    (b as { type: string }).type === 'section'
      ? flatten((b as unknown as { blocks?: ProtocolBlock[] }).blocks ?? [])
      : [b],
  )
}

function blockName(block: ProtocolBlock): string {
  const b = block as unknown as { label?: string; title?: string }
  return b.label ?? b.title ?? block.type
}

function blockTypeCaption(block: ProtocolBlock): string {
  const b = block as unknown as {
    items?: unknown[]
    steps?: unknown[]
    branches?: unknown[]
    fields?: { label: string }[]
  }
  if (block.type === 'checklist' && b.items) {
    return `${block.type} · ${s.historiaCaptionItems(b.items.length)}`
  }
  if (block.type === 'steps' && b.steps) {
    return `${block.type} · ${s.historiaCaptionSteps(b.steps.length)}`
  }
  if (block.type === 'decision' && b.branches) {
    return `${block.type} · ${s.historiaCaptionBranches(b.branches.length)}`
  }
  if (block.type === 'vitals' && b.fields) {
    return `${block.type} · ${b.fields.map((f) => f.label).join(', ')}`
  }
  return block.type
}

export function HistoriaMappingTab({ blocks, mapping, onChange }: Props): JSX.Element {
  const rows = flatten(blocks)
  const current = mapping ?? {}

  function setEntry(blockId: string, entry: HistoriaMapping[string] | null): void {
    const next = { ...current }
    if (entry === null || Object.keys(entry).length === 0) delete next[blockId]
    else next[blockId] = entry
    onChange(next)
  }

  return (
    <div className="bg-n-0 border border-n-200 rounded-md">
      <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-n-100">
        <div>
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-n-400">
            {s.historiaTabLabel}
          </span>
          <h3 className="font-serif font-medium text-[18px] text-n-900 mt-[2px] mb-1">
            {s.historiaMapTitle}
          </h3>
          <p className="text-[13px] text-n-500 max-w-[56ch]">{s.historiaMapDescription}</p>
        </div>
        <Button variant="secondary" onClick={() => onChange({})}>
          <i className="ph ph-arrow-counter-clockwise" />
          {s.historiaMapRestore}
        </Button>
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="text-left font-mono text-[11px] uppercase tracking-[0.08em] font-regular text-n-400 bg-n-25 px-4 py-[10px] border-b border-n-100 w-[34%]">
              {s.historiaColBlock}
            </th>
            <th className="text-left font-mono text-[11px] uppercase tracking-[0.08em] font-regular text-n-400 bg-n-25 px-4 py-[10px] border-b border-n-100 w-[8%]">
              {s.historiaColInclude}
            </th>
            <th className="text-left font-mono text-[11px] uppercase tracking-[0.08em] font-regular text-n-400 bg-n-25 px-4 py-[10px] border-b border-n-100 w-[26%]">
              {s.historiaColSection}
            </th>
            <th className="text-left font-mono text-[11px] uppercase tracking-[0.08em] font-regular text-n-400 bg-n-25 px-4 py-[10px] border-b border-n-100 w-[22%]">
              {s.historiaColLabel}
            </th>
            <th className="text-left font-mono text-[11px] uppercase tracking-[0.08em] font-regular text-n-400 bg-n-25 px-4 py-[10px] border-b border-n-100 w-[10%]">
              {s.historiaColOrigin}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((block) => {
            const entry = current[block.id]
            const excludedByDefault = EXCLUDED_BY_DEFAULT.has(block.type)
            const locked = LOCKED_TYPES.has(block.type) || excludedByDefault
            const included = entry?.include !== undefined ? entry.include : !excludedByDefault
            const isCustom = Boolean(entry)
            const sectionValue =
              entry?.section ?? DEFAULT_SECTION[block.type] ?? SELECTABLE_SECTIONS[0]

            return (
              <tr key={block.id} className={!included ? 'text-n-400' : undefined}>
                <td className="px-4 py-[10px] border-b border-n-100 align-middle">
                  <div
                    className={`flex items-center gap-[10px] pl-[10px] border-l-2 ${
                      included ? 'border-p-500' : 'border-n-200'
                    }`}
                  >
                    <div>
                      <span
                        className={`block font-medium ${included ? 'text-n-800' : 'text-n-400'}`}
                      >
                        {blockName(block)}
                      </span>
                      <span className="block font-mono text-[10.5px] text-n-400">
                        {blockTypeCaption(block)}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-[10px] border-b border-n-100 align-middle">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={included}
                    aria-label={s.historiaColInclude}
                    disabled={locked}
                    onClick={() => setEntry(block.id, { ...entry, include: !included })}
                    className={`w-8 h-[18px] rounded-full relative shrink-0 transition-colors duration-[100ms] ${
                      included ? 'bg-p-500' : 'bg-n-200'
                    } ${locked ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span
                      className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-n-0 transition-[left] duration-[100ms] ${
                        included ? 'left-4' : 'left-[2px]'
                      }`}
                    />
                  </button>
                </td>
                <td className="px-4 py-[10px] border-b border-n-100 align-middle">
                  {LOCKED_TYPES.has(block.type) ? (
                    <span className="text-[13px] text-n-400">{s.historiaLockedPlan}</span>
                  ) : locked || !included ? (
                    <span className="text-[13px] text-n-400">{s.historiaNotIncluded}</span>
                  ) : (
                    <NativeSelect
                      value={sectionValue}
                      onChange={(e) =>
                        setEntry(block.id, {
                          ...entry,
                          section: e.target.value as SelectableSection,
                        })
                      }
                    >
                      {SELECTABLE_SECTIONS.map((key) => (
                        <option key={key} value={key}>
                          {RECORD_SECTION_TITLES[key]}
                        </option>
                      ))}
                    </NativeSelect>
                  )}
                </td>
                <td className="px-4 py-[10px] border-b border-n-100 align-middle">
                  {locked || !included ? (
                    <span className="text-[13px] text-n-400">—</span>
                  ) : (
                    <Input
                      value={entry?.label ?? ''}
                      placeholder={s.historiaLabelPlaceholder}
                      onChange={(e) => setEntry(block.id, { ...entry, label: e.target.value })}
                    />
                  )}
                </td>
                <td className="px-4 py-[10px] border-b border-n-100 align-middle">
                  <span
                    className={`inline-flex items-center font-mono text-[10px] uppercase tracking-[0.05em] px-[6px] py-[2px] rounded-sm border whitespace-nowrap ${
                      isCustom
                        ? 'border-p-100 text-p-500 bg-p-50'
                        : 'border-n-200 text-n-400 bg-n-25'
                    }`}
                  >
                    {isCustom ? s.historiaOriginCustom : s.historiaOriginAuto}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="flex items-center gap-2 px-6 py-[14px] text-n-500 text-[12.5px] bg-n-25 border-t border-n-100 rounded-b-md">
        <i className="ph ph-info text-[14px] text-n-400 shrink-0" />
        {s.historiaFootnote}
      </div>
    </div>
  )
}
