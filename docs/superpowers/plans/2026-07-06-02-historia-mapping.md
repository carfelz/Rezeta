# Historia Médica — Phase 2: Per-Protocol Mapping Overrides Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a doctor customize, per protocol, which blocks feed the historia médica and into which section — via an optional `historia_mapping` object inside the protocol content JSON and a "Historia médica" tab in the protocol editor.

**Architecture:** `historia_mapping` lives inside `ProtocolVersion.content` (`{ [blockId]: { section?, include?, label? } }`), so it versions with the protocol and snapshots into `ProtocolUsage.content` automatically — zero new tables, zero migration. The shared mapper consults it before its type-based defaults. The protocol editor gets a mapping table (mockup screen 1).

**Tech Stack:** Zod, React, Vitest. No DB or API surface changes.

**Spec:** `docs/superpowers/specs/2026-07-06-historia-medica-design.md` §6 · Mockups screen 1: `docs/superpowers/specs/2026-07-06-historia-medica-mockups.html`

**Prerequisite:** Phase 1 plan (`2026-07-06-01-historia-core.md`) fully merged.

## Global Constraints

Same as phase 1 (see `2026-07-06-01-historia-core.md`): 2-space indent, Spanish UI strings colocated, token-only Tailwind classes, no TODO comments, commitlint lower-case subject, `pnpm lint` + package tests green per task, 95% per-file coverage at the end.

---

### Task 1: Shared — `historia_mapping` schema + mapper support

**Files:**
- Modify: `packages/shared/src/schemas/protocol.ts` (add `HistoriaMappingSchema`, accept `historia_mapping` in protocol content)
- Modify: `packages/shared/src/record/generate-record-sections.ts` (consume the mapping)
- Modify: `packages/shared/src/__tests__/generate-record-sections.spec.ts` (new cases)
- Test: `packages/shared/src/schemas/__tests__/historia-mapping.spec.ts`

**Interfaces:**
- Produces:

```typescript
// schemas/protocol.ts
export const HistoriaMappingEntrySchema = z.object({
  section: z.enum(RECORD_SECTION_KEYS).optional(),
  include: z.boolean().optional(),
  label: z.string().max(200).optional(),
})
export const HistoriaMappingSchema = z.record(z.string(), HistoriaMappingEntrySchema)
export type HistoriaMapping = z.infer<typeof HistoriaMappingSchema>

// generate-record-sections.ts — RecordUsageInput gains:
export interface RecordUsageInput {
  blocks: ProtocolBlock[]
  historiaMapping?: HistoriaMapping   // from usage content JSON, optional
  modifications: { /* unchanged */ }
}
```

Mapping semantics (spec §6): `include: false` drops the block entirely; `section` overrides the destination for `clinical_notes`, `vitals`, `checklist`, `steps`, `decision`; `label` prefixes the emitted text (`"{label}: …"`) for non-notes blocks and replaces the label-matching input for `clinical_notes`. `dosage_table`/`lab_order`/`imaging_order`/`alert`/`text` ignore mapping entries (legally locked / never included).

- [ ] **Step 1: Write the failing tests**

`packages/shared/src/schemas/__tests__/historia-mapping.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { HistoriaMappingSchema } from '../protocol.js'

describe('HistoriaMappingSchema', () => {
  it('accepts a valid mapping', () => {
    const result = HistoriaMappingSchema.safeParse({
      blk_1: { section: 'examen_fisico', label: 'Hallazgos cardiovasculares' },
      blk_2: { include: false },
    })
    expect(result.success).toBe(true)
  })

  it('rejects an unknown section key', () => {
    const result = HistoriaMappingSchema.safeParse({ blk_1: { section: 'notas' } })
    expect(result.success).toBe(false)
  })
})
```

Add to `packages/shared/src/__tests__/generate-record-sections.spec.ts`:

```typescript
describe('historia_mapping overrides', () => {
  it('redirects a clinical_notes block to the mapped section', () => {
    const blocks: ProtocolBlock[] = [
      { id: 'b1', type: 'clinical_notes', label: 'Notas', content: 'Hallazgo dirigido.' } as ProtocolBlock,
    ]
    const out = generateRecordSections(
      makeInput({
        usages: [{ blocks, modifications: {}, historiaMapping: { b1: { section: 'examen_fisico' } } }],
      }),
    )
    expect(section(out, 'examen_fisico')?.content).toContain('Hallazgo dirigido.')
    expect(section(out, 'evolucion')?.content ?? '').not.toContain('Hallazgo dirigido.')
  })

  it('excludes a block with include=false', () => {
    const blocks: ProtocolBlock[] = [
      { id: 'b1', type: 'clinical_notes', label: 'Motivo', content: 'Nunca sale.' } as ProtocolBlock,
    ]
    const out = generateRecordSections(
      makeInput({ usages: [{ blocks, modifications: {}, historiaMapping: { b1: { include: false } } }] }),
    )
    expect(out.map((s) => s.content).join('\n')).not.toContain('Nunca sale.')
  })

  it('prefixes a custom label on non-notes blocks', () => {
    const blocks: ProtocolBlock[] = [
      {
        id: 'ck1',
        type: 'checklist',
        title: 'Adherencia',
        items: [{ id: 'i1', text: 'Dieta', checked: true }],
      } as unknown as ProtocolBlock,
    ]
    const out = generateRecordSections(
      makeInput({
        usages: [{ blocks, modifications: {}, historiaMapping: { ck1: { label: 'Hábitos del paciente' } } }],
      }),
    )
    expect(section(out, 'evolucion')?.content).toContain('Hábitos del paciente: Dieta')
  })

  it('ignores mapping entries on legally locked block types', () => {
    const blocks: ProtocolBlock[] = [
      {
        id: 'dt1',
        type: 'dosage_table',
        rows: [{ id: 'r1', drug: 'X', dose: '1', route: 'VO', frequency: 'od', notes: '' }],
      } as unknown as ProtocolBlock,
    ]
    const out = generateRecordSections(
      makeInput({
        usages: [{ blocks, modifications: {}, historiaMapping: { dt1: { section: 'evolucion' } } }],
      }),
    )
    expect(section(out, 'evolucion')?.content ?? '').toBe('')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @rezeta/shared test -- historia-mapping generate-record-sections`
Expected: FAIL — `HistoriaMappingSchema` not exported; override cases fail

- [ ] **Step 3: Implement**

In `packages/shared/src/schemas/protocol.ts`, add near the content schema (import `RECORD_SECTION_KEYS` from `../types/consultation-record.js`):

```typescript
export const HistoriaMappingEntrySchema = z.object({
  section: z.enum(RECORD_SECTION_KEYS).optional(),
  include: z.boolean().optional(),
  label: z.string().max(200).optional(),
})
export const HistoriaMappingSchema = z.record(z.string(), HistoriaMappingEntrySchema)
export type HistoriaMapping = z.infer<typeof HistoriaMappingSchema>
```

and wherever the protocol content object schema is defined (the one validating `{ version, blocks }`), add `historia_mapping: HistoriaMappingSchema.optional()`.

In `generate-record-sections.ts`:
- Add `historiaMapping?: HistoriaMapping` to `RecordUsageInput` (import the type from `../schemas/protocol.js`).
- In `walkBlocks`, resolve the entry first:

```typescript
    const mapping = usage.historiaMapping?.[block.id]
    if (mapping?.include === false) continue
```

- For `clinical_notes`: destination is `mapping?.section ?? matchNotesSection(mapping?.label ?? String(block.label ?? ''), kind)`.
- For `vitals`: destination `mapping?.section ?? 'examen_fisico'`; when `mapping?.label` is set, emit `` `${mapping.label}: ${parts.join(' · ')}` ``.
- For `checklist` / `steps` / `decision`: destination `mapping?.section ?? narrativeSection(kind)` (the phase-1 helper — evolución on follow-ups, enfermedad actual on first visits); when `mapping?.label` is set, use it in place of the block title (`checklist`/`steps`) or prefix the decision line.
- `section` blocks recurse as before (mapping applies to inner blocks by their own ids); locked types ignore mapping entirely (no change needed — their cases don't read it).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @rezeta/shared test`
Expected: PASS (all shared tests including phase-1 mapper cases)

- [ ] **Step 5: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): historia_mapping overrides in record section generator"
```

---

### Task 2: API — thread the mapping from usage content into the mapper

**Files:**
- Modify: `apps/api/src/modules/consultation-records/consultation-records.service.ts` (`buildGenerationInput`)
- Modify: `apps/api/src/modules/consultation-records/__tests__/consultation-records.service.spec.ts`

**Interfaces:**
- Consumes: `HistoriaMapping` (Task 1). No endpoint changes — the mapping arrives inside `ProtocolUsage.content.historia_mapping` (snapshotted from `ProtocolVersion.content` when the protocol is added to a consultation; the snapshot mechanism already exists).

- [ ] **Step 1: Write the failing test**

Add to the service spec:

```typescript
  it('passes historia_mapping from usage content into the generator', async () => {
    mockRepo.findLatest.mockResolvedValue(null)
    mockPrisma.consultation.findFirst.mockResolvedValue(
      makeConsultationRow({
        protocolUsages: [
          {
            content: {
              blocks: [{ id: 'b1', type: 'clinical_notes', label: 'Notas', content: 'Dirigido.' }],
              historia_mapping: { b1: { section: 'examen_fisico' } },
            },
            modifications: {},
          },
        ],
      }),
    )
    mockPrisma.consultation.count.mockResolvedValue(1)
    mockRepo.create.mockImplementation((data) => Promise.resolve(makeRecord({ sections: data.sections })))
    const result = await svc.ensureDraft('c1', 't1')
    const examen = result.sections.find((s) => s.key === 'examen_fisico')
    expect(examen?.content).toContain('Dirigido.')
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @rezeta/api test -- consultation-records.service`
Expected: FAIL — content lands in `evolucion`, not `examen_fisico`

- [ ] **Step 3: Implement**

In `buildGenerationInput`, extend the usages projection:

```typescript
      usages: c.protocolUsages.map((u) => {
        const content = u.content as {
          blocks?: ProtocolBlock[]
          historia_mapping?: HistoriaMapping
        } | null
        return {
          blocks: (content?.blocks ?? []) as ProtocolBlock[],
          ...(content?.historia_mapping ? { historiaMapping: content.historia_mapping } : {}),
          modifications: (u.modifications ?? {}) as GenerateRecordSectionsInput['usages'][number]['modifications'],
        }
      }),
```

(import `HistoriaMapping` from `@rezeta/shared`.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @rezeta/api test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat(api): apply historia_mapping overrides when generating records"
```

---

### Task 3: Protocol editor — "Historia médica" tab

**Files:**
- Create: `apps/web/src/pages/ProtocolEditor/HistoriaMappingTab.tsx`
- Modify: `apps/web/src/pages/ProtocolEditor/index.tsx` (register the tab — inspect how existing editor tabs/sections are registered and mirror it)
- Modify: `apps/web/src/pages/ProtocolEditor/strings.ts`
- Test: `apps/web/src/pages/ProtocolEditor/__tests__/HistoriaMappingTab.test.tsx`

**Interfaces:**
- Consumes: the protocol editor's draft-content state (the object holding `blocks` that the editor already mutates and saves — find the state hook/store in `apps/web/src/pages/ProtocolEditor/` and reuse its update mechanism; the mapping is one more key on the same content object, so it rides the existing save/versioning path). `RECORD_SECTION_TITLES`, `RECORD_SECTION_KEYS`, `HistoriaMapping` from `@rezeta/shared`.
- Produces: `<HistoriaMappingTab blocks={ProtocolBlock[]} mapping={HistoriaMapping | undefined} onChange={(next: HistoriaMapping) => void} />` — a controlled component; the parent editor owns persistence.

Visual reference: mockup screen 1 — table with columns Bloque / Incluir / Sección destino / Etiqueta / Origen; teal 2px rule on block names; `Auto` vs `Personalizado` badge; "Restaurar automático" clears all overrides; `dosage_table`/`lab_order`/`imaging_order` rows locked ("fijo por ley" hint); `alert`/`text` rows default to excluded.

- [ ] **Step 1: Add strings**

In `apps/web/src/pages/ProtocolEditor/strings.ts` add:

```typescript
  historiaTabLabel: 'Historia médica',
  historiaMapTitle: 'Mapeo a secciones',
  historiaMapDescription:
    'Al firmar la consulta, el contenido de cada bloque se coloca en la sección indicada del borrador de la historia. La ficha de identificación y el plan de medicamentos se completan automáticamente.',
  historiaMapRestore: 'Restaurar automático',
  historiaColBlock: 'Bloque',
  historiaColInclude: 'Incluir',
  historiaColSection: 'Sección destino',
  historiaColLabel: 'Etiqueta en historia',
  historiaColOrigin: 'Origen',
  historiaOriginAuto: 'Auto',
  historiaOriginCustom: 'Personalizado',
  historiaLockedPlan: 'Fijo por ley — desde recetas firmadas',
  historiaNotIncluded: 'No se incluye',
  historiaLabelPlaceholder: '— usa el título del bloque —',
  historiaFootnote:
    'Las secciones requeridas por el Reglamento siempre aparecen en la historia, aunque ningún bloque las alimente.',
```

- [ ] **Step 2: Write the failing tests**

`apps/web/src/pages/ProtocolEditor/__tests__/HistoriaMappingTab.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HistoriaMappingTab } from '../HistoriaMappingTab'
import type { ProtocolBlock } from '@rezeta/shared'

const blocks = [
  { id: 'b1', type: 'clinical_notes', label: 'Motivo de consulta', content: '' },
  { id: 'v1', type: 'vitals', fields: [], values: {} },
  { id: 'dt1', type: 'dosage_table', rows: [] },
  { id: 'a1', type: 'alert', severity: 'info', content: 'ref' },
] as unknown as ProtocolBlock[]

describe('HistoriaMappingTab', () => {
  it('renders one row per block with Auto badge by default', () => {
    render(<HistoriaMappingTab blocks={blocks} mapping={undefined} onChange={vi.fn()} />)
    expect(screen.getByText('Motivo de consulta')).toBeInTheDocument()
    expect(screen.getAllByText('Auto').length).toBeGreaterThanOrEqual(3)
  })

  it('locks dosage_table rows (no section select)', () => {
    render(<HistoriaMappingTab blocks={blocks} mapping={undefined} onChange={vi.fn()} />)
    expect(screen.getByText('Fijo por ley — desde recetas firmadas')).toBeInTheDocument()
  })

  it('emits an override when the destination changes', () => {
    const onChange = vi.fn()
    render(<HistoriaMappingTab blocks={blocks} mapping={undefined} onChange={onChange} />)
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'examen_fisico' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ b1: { section: 'examen_fisico' } }))
  })

  it('shows Personalizado on overridden rows and clears them on restore', () => {
    const onChange = vi.fn()
    render(
      <HistoriaMappingTab blocks={blocks} mapping={{ b1: { section: 'evolucion' } }} onChange={onChange} />,
    )
    expect(screen.getByText('Personalizado')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Restaurar automático/ }))
    expect(onChange).toHaveBeenCalledWith({})
  })

  it('toggling include=false emits the exclusion', () => {
    const onChange = vi.fn()
    render(<HistoriaMappingTab blocks={blocks} mapping={undefined} onChange={onChange} />)
    fireEvent.click(screen.getAllByRole('switch')[0])
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ b1: { include: false } }))
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter @rezeta/web test -- HistoriaMappingTab`
Expected: FAIL — cannot find module

- [ ] **Step 4: Implement the component**

`apps/web/src/pages/ProtocolEditor/HistoriaMappingTab.tsx` — flatten blocks (recursing into `section` blocks), one table row per mappable block. Skeleton:

```tsx
import { Button } from '@/components/ui'
import type { ProtocolBlock, HistoriaMapping, RecordSectionKey } from '@rezeta/shared'
import { RECORD_SECTION_TITLES, RECORD_SECTION_KEYS } from '@rezeta/shared'
import { protocolEditorStrings as s } from './strings'

const LOCKED_TYPES = new Set(['dosage_table', 'lab_order', 'imaging_order'])
const EXCLUDED_BY_DEFAULT = new Set(['alert', 'text'])
const DEFAULT_SECTION: Record<string, RecordSectionKey> = {
  vitals: 'examen_fisico',
  checklist: 'evolucion',
  steps: 'evolucion',
  decision: 'evolucion',
  clinical_notes: 'evolucion', // display default; real routing label-matches at generation time
}
const SELECTABLE_SECTIONS = RECORD_SECTION_KEYS.filter(
  (k) => k !== 'ficha_identificacion' && k !== 'enmiendas' && k !== 'plan_tratamiento',
)

interface Props {
  blocks: ProtocolBlock[]
  mapping: HistoriaMapping | undefined
  onChange: (next: HistoriaMapping) => void
}

function flatten(blocks: ProtocolBlock[]): ProtocolBlock[] {
  return blocks.flatMap((b) =>
    (b as { type: string }).type === 'section'
      ? flatten(((b as unknown as { blocks?: ProtocolBlock[] }).blocks ?? []))
      : [b],
  )
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

  // …render header (s.historiaMapTitle, s.historiaMapDescription, restore button
  //   calling onChange({})), then a table: for each row —
  //   name cell: block title/label + mono type, left border-l-2 border-p-500
  //   include cell: switch (role="switch"), checked = entry?.include !== false
  //     && !(EXCLUDED_BY_DEFAULT.has(type) && entry?.include !== true)
  //   section cell: LOCKED_TYPES → text s.historiaLockedPlan; excluded → s.historiaNotIncluded;
  //     otherwise <select role="combobox"> over SELECTABLE_SECTIONS with
  //     RECORD_SECTION_TITLES labels, value = entry?.section ?? DEFAULT_SECTION[type],
  //     onChange → setEntry(id, { ...entry, section: value })
  //   label cell: text input, placeholder s.historiaLabelPlaceholder,
  //     value = entry?.label ?? '', onChange → setEntry(id, { ...entry, label })
  //   origin cell: badge — entry ? s.historiaOriginCustom : s.historiaOriginAuto
  //   footer note: s.historiaFootnote
}
```

Write the full JSX following the mockup (table classes: `border-b border-n-100`, header cells `font-mono text-[11px] uppercase tracking-[0.08em] text-n-400 bg-n-25`). Keep every color/spacing a token class.

- [ ] **Step 5: Register the tab in the editor**

In `apps/web/src/pages/ProtocolEditor/index.tsx`, locate the existing tab/section navigation (the rail shown in the mockup: Contenido / Detalles / Historial de versiones) and add `s.historiaTabLabel` rendering `<HistoriaMappingTab>` wired to the editor's draft content state:

```tsx
<HistoriaMappingTab
  blocks={draftContent.blocks}
  mapping={draftContent.historia_mapping}
  onChange={(next) =>
    setDraftContent({
      ...draftContent,
      ...(Object.keys(next).length > 0 ? { historia_mapping: next } : {}),
    })
  }
/>
```

Adapt the exact state accessor names to what the editor actually uses (read `index.tsx` first); the mapping must ride the same save path that persists `blocks` so it lands in the next `ProtocolVersion.content`. When clearing, delete the `historia_mapping` key from the content object rather than saving `{}`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter @rezeta/web test -- HistoriaMappingTab && pnpm --filter @rezeta/web test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web
git commit -m "feat(web): historia mapping tab in protocol editor"
```

---

### Task 4: Changelog + full verification

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Prepend the changelog entry**

```markdown
## [YYYY-MM-DD] Historia médica — mapeo por protocolo (fase 2)

### Added

- `historia_mapping` opcional en el contenido del protocolo: por bloque, sección destino, inclusión y etiqueta personalizada; viaja con `ProtocolVersion.content` y se congela en cada `ProtocolUsage`.
- Pestaña «Historia médica» en el editor de protocolo (`HistoriaMappingTab`): tabla de mapeo con Auto/Personalizado y «Restaurar automático».

### Changed

- `generateRecordSections` respeta los overrides de `historia_mapping`; los bloques `dosage_table`/`lab_order`/`imaging_order` permanecen fijos (mínimo legal desde órdenes firmadas).
```

(replace `YYYY-MM-DD` with the actual completion date)

- [ ] **Step 2: Run the full gates**

Run: `pnpm lint && pnpm -r typecheck && pnpm test && pnpm test:coverage`
Expected: PASS, ≥95% per-file

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: changelog for historia medica phase 2"
```
