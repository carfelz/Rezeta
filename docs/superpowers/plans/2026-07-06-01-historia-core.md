# Historia Médica — Phase 1: Core Record Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate a DR-compliant "historia médica" draft from a signed consultation's protocol content, let the doctor edit it per section, sign it (freeze), and download it as a PDF.

**Architecture:** A new `ConsultationRecord` model (append-only versions per consultation) stores structured sections derived by a pure mapper in `packages/shared` (block type → legal section). A new NestJS module owns the record lifecycle (`GET/PATCH/POST` under `/v1/consultations/:id/record`); the existing consultation sign flow additionally creates the draft (non-fatal, reported as `recordOutcome`). The PDF is rendered on demand with PDFKit and streamed, mirroring the order-PDF endpoints.

**Tech Stack:** Prisma/PostgreSQL, NestJS, Zod, PDFKit, React + TanStack Query, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-06-historia-medica-design.md` · Mockups: `docs/superpowers/specs/2026-07-06-historia-medica-mockups.html`

## Global Constraints

- Monorepo packages: `@rezeta/shared`, `@rezeta/db`, `@rezeta/api`, `@rezeta/web`. 2-space indent, `snake_case` DB columns, `camelCase` TS.
- Error codes live in the closed enum `packages/shared/src/errors.ts`.
- Repository layer always filters by `tenant_id`. Soft deletes (`deleted_at`) — never hard-delete.
- User-facing strings in Spanish, colocated in `strings.ts` files. No raw hex/px in components — Tailwind token classes only (`text-n-700`, `bg-p-500`, `border-n-200`, `rounded-sm`).
- No `TODO`/`FIXME` comments (ESLint `no-warning-comments` fails CI).
- Every task ends green: `pnpm lint` and the touched package's tests pass. Final task runs `pnpm test:coverage` (95% per-file gate).
- Commit messages: conventional commits, **lower-case subject** (commitlint enforces `subject-case`).
- API response envelope is `{ data: ... }` (the web `apiClient` unwraps `body['data']`).

---

### Task 1: Shared contracts — types, error codes, edit schema

**Files:**
- Create: `packages/shared/src/types/consultation-record.ts`
- Create: `packages/shared/src/schemas/consultation-record.ts`
- Create: `packages/shared/src/schemas/__tests__/consultation-record.spec.ts`
- Modify: `packages/shared/src/types/index.ts` (add export)
- Modify: `packages/shared/src/schemas/index.ts` (add export)
- Modify: `packages/shared/src/types/consultation.ts` (extend `SignConsultationResponse`)
- Modify: `packages/shared/src/errors.ts` (new section)

**Interfaces:**
- Produces: `RECORD_SECTION_KEYS`, `RecordSectionKey`, `RecordSection`, `ConsultationRecordKind`, `ConsultationRecordStatus`, `ConsultationRecordDto`, `RecordOutcome`, `UpdateRecordSectionsSchema`, `UpdateRecordSectionsDto`, error codes `RECORD_NOT_FOUND | RECORD_NOT_DRAFT | RECORD_ALREADY_SIGNED | RECORD_REQUIRED_SECTIONS_MISSING | RECORD_CONSULTATION_NOT_SIGNED`. All later tasks import these from `@rezeta/shared`.

- [ ] **Step 1: Write the failing schema test**

`packages/shared/src/schemas/__tests__/consultation-record.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { UpdateRecordSectionsSchema } from '../consultation-record.js'

describe('UpdateRecordSectionsSchema', () => {
  it('accepts a valid section edit', () => {
    const result = UpdateRecordSectionsSchema.safeParse({
      sections: [{ key: 'motivo_consulta', content: 'Control de HTA.' }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects an unknown section key', () => {
    const result = UpdateRecordSectionsSchema.safeParse({
      sections: [{ key: 'notas_libres', content: 'x' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects an empty sections array', () => {
    const result = UpdateRecordSectionsSchema.safeParse({ sections: [] })
    expect(result.success).toBe(false)
  })

  it('rejects content over 20000 chars', () => {
    const result = UpdateRecordSectionsSchema.safeParse({
      sections: [{ key: 'evolucion', content: 'x'.repeat(20_001) }],
    })
    expect(result.success).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @rezeta/shared test -- consultation-record`
Expected: FAIL — `Cannot find module '../consultation-record.js'`

- [ ] **Step 3: Write the types file**

`packages/shared/src/types/consultation-record.ts`:

```typescript
/**
 * Historia médica (consultation record) — DR Reglamento Técnico del
 * Expediente Clínico (MISPAS 2023). Section keys are the fixed legal
 * skeleton (§6.3); order in RECORD_SECTION_KEYS is the render order.
 */
export const RECORD_SECTION_KEYS = [
  'ficha_identificacion',
  'motivo_consulta',
  'antecedentes',
  'enfermedad_actual',
  'examen_fisico',
  'evolucion',
  'resultados_estudios',
  'diagnosticos',
  'plan_tratamiento',
  'enmiendas',
] as const

export type RecordSectionKey = (typeof RECORD_SECTION_KEYS)[number]

export type ConsultationRecordKind = 'first_visit' | 'evolution'
export type ConsultationRecordStatus = 'draft' | 'signed'

export interface RecordSection {
  key: RecordSectionKey
  title: string
  content: string
  /** 'edited' once the doctor has touched the text after generation. */
  source: 'generated' | 'edited'
  /** Required sections must be non-empty to sign the record. */
  required: boolean
}

export interface ConsultationRecordDto {
  id: string
  consultationId: string
  patientId: string
  versionNumber: number
  kind: ConsultationRecordKind
  status: ConsultationRecordStatus
  sections: RecordSection[]
  generatedAt: string
  signedAt: string | null
  signedBy: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Outcome of the auto-draft attempt when a consultation is signed. Draft
 * failure never fails the sign — the response reports what happened.
 */
export type RecordOutcome = { status: 'created'; recordId: string } | { status: 'failed' }
```

- [ ] **Step 4: Write the Zod schema**

`packages/shared/src/schemas/consultation-record.ts`:

```typescript
import { z } from 'zod'
import { RECORD_SECTION_KEYS } from '../types/consultation-record.js'

export const UpdateRecordSectionsSchema = z.object({
  sections: z
    .array(
      z.object({
        key: z.enum(RECORD_SECTION_KEYS),
        content: z.string().max(20_000),
      }),
    )
    .min(1),
})

export type UpdateRecordSectionsDto = z.infer<typeof UpdateRecordSectionsSchema>
```

- [ ] **Step 5: Wire exports, error codes, and the sign response**

In `packages/shared/src/types/index.ts` add (alongside the existing exports):

```typescript
export * from './consultation-record.js'
```

In `packages/shared/src/schemas/index.ts` add:

```typescript
export * from './consultation-record.js'
```

In `packages/shared/src/errors.ts`, after the `// ── Consultation ──` block, add:

```typescript
  // ── Consultation Record (historia médica) ──────────────────
  RECORD_NOT_FOUND: 'RECORD_NOT_FOUND',
  RECORD_NOT_DRAFT: 'RECORD_NOT_DRAFT',
  RECORD_ALREADY_SIGNED: 'RECORD_ALREADY_SIGNED',
  RECORD_REQUIRED_SECTIONS_MISSING: 'RECORD_REQUIRED_SECTIONS_MISSING',
  RECORD_CONSULTATION_NOT_SIGNED: 'RECORD_CONSULTATION_NOT_SIGNED',
```

In `packages/shared/src/types/consultation.ts`, import the outcome type at the top:

```typescript
import type { RecordOutcome } from './consultation-record.js'
```

and extend the sign response:

```typescript
export interface SignConsultationResponse extends ConsultationWithDetails {
  invoiceOutcome: InvoiceOutcome
  recordOutcome: RecordOutcome
}
```

- [ ] **Step 6: Run tests and typecheck**

Run: `pnpm --filter @rezeta/shared test -- consultation-record`
Expected: PASS (4 tests)

Run: `pnpm -r typecheck`
Expected: `apps/api` **fails** — `consultations.service.ts` returns `SignConsultationResponse` without `recordOutcome`. That is expected until Task 7; to keep the workspace green (pre-commit typechecks the whole workspace), add a temporary failed outcome in `apps/api/src/modules/consultations/consultations.service.ts` `sign()` (Task 7 replaces it):

```typescript
    return { ...consultation, invoiceOutcome, recordOutcome: { status: 'failed' as const } }
```

Also update the sign-response fixture in `apps/web` if the typecheck flags any test helper constructing `SignConsultationResponse` (add `recordOutcome: { status: 'failed' }`).

Run: `pnpm -r typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/shared apps/api apps/web
git commit -m "feat(shared): consultation record types, edit schema, and error codes"
```

---

### Task 2: Shared mapper — `generateRecordSections`

**Files:**
- Create: `packages/shared/src/record/generate-record-sections.ts`
- Create: `packages/shared/src/__tests__/generate-record-sections.spec.ts`
- Modify: `packages/shared/src/index.ts` (add export)

**Interfaces:**
- Consumes: `RecordSection`, `RecordSectionKey`, `ConsultationRecordKind`, `RECORD_SECTION_KEYS` (Task 1); `ProtocolBlock` from `packages/shared/src/types/protocol.ts`.
- Produces:

```typescript
export interface RecordPatientInput {
  firstName: string
  lastName: string
  dateOfBirth: string | null
  sex: string | null
  documentType: string | null
  documentNumber: string | null
  phone: string | null
  address: string | null
  allergies: string[]
  chronicConditions: string[]
}
export interface RecordUsageInput {
  blocks: ProtocolBlock[]
  modifications: {
    steps_completed?: Array<{ step_id: string }>
    steps_skipped?: Array<{ step_id: string; reason?: string }>
    decision_branches?: Array<Record<string, unknown>>
  }
}
export interface RecordOrdersInput {
  prescriptionItems: Array<{ drug: string; dose: string; route: string; frequency: string; duration: string }>
  labTests: string[]
  imagingStudies: string[]
}
export interface GenerateRecordSectionsInput {
  kind: ConsultationRecordKind
  patient: RecordPatientInput
  usages: RecordUsageInput[]
  orders: RecordOrdersInput
  amendments: Array<{ reason: string; amendedAt: string }>
}
export const RECORD_SECTION_TITLES: Record<RecordSectionKey, string>
export function generateRecordSections(input: GenerateRecordSectionsInput): RecordSection[]
```

- [ ] **Step 1: Write the failing tests**

`packages/shared/src/__tests__/generate-record-sections.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { generateRecordSections } from '../record/generate-record-sections.js'
import type { GenerateRecordSectionsInput } from '../record/generate-record-sections.js'
import type { ProtocolBlock } from '../types/protocol.js'

const patient = {
  firstName: 'María',
  lastName: 'Peña',
  dateOfBirth: '1972-03-15',
  sex: 'female',
  documentType: 'cedula',
  documentNumber: '001-1234567-8',
  phone: '809-555-0101',
  address: 'C/ El Sol 12, Santiago',
  allergies: ['penicilina'],
  chronicConditions: ['hipertensión'],
}

const emptyOrders = { prescriptionItems: [], labTests: [], imagingStudies: [] }

function makeInput(overrides: Partial<GenerateRecordSectionsInput> = {}): GenerateRecordSectionsInput {
  return {
    kind: 'evolution',
    patient,
    usages: [],
    orders: emptyOrders,
    amendments: [],
    ...overrides,
  }
}

function section(sections: ReturnType<typeof generateRecordSections>, key: string) {
  return sections.find((s) => s.key === key)
}

describe('generateRecordSections', () => {
  it('always emits ficha_identificacion with patient data', () => {
    const out = generateRecordSections(makeInput())
    const ficha = section(out, 'ficha_identificacion')
    expect(ficha?.content).toContain('María Peña')
    expect(ficha?.content).toContain('001-1234567-8')
    expect(ficha?.content).toContain('Alergias: penicilina')
    expect(ficha?.source).toBe('generated')
  })

  it('emits required-but-empty sections for evolution kind', () => {
    const out = generateRecordSections(makeInput())
    for (const key of ['motivo_consulta', 'examen_fisico', 'evolucion', 'diagnosticos', 'plan_tratamiento']) {
      const s = section(out, key)
      expect(s?.required).toBe(true)
    }
    expect(section(out, 'enfermedad_actual')).toBeUndefined()
    expect(section(out, 'antecedentes')?.required ?? false).toBe(false)
  })

  it('requires antecedentes on first_visit and routes unmatched notes to enfermedad_actual', () => {
    const blocks: ProtocolBlock[] = [
      { id: 'b1', type: 'clinical_notes', label: 'Notas generales', content: 'Dolor torácico atípico.' } as ProtocolBlock,
    ]
    const out = generateRecordSections(
      makeInput({ kind: 'first_visit', usages: [{ blocks, modifications: {} }] }),
    )
    expect(section(out, 'antecedentes')?.required).toBe(true)
    expect(section(out, 'enfermedad_actual')?.content).toContain('Dolor torácico atípico.')
    expect(section(out, 'evolucion')).toBeUndefined()
  })

  it('maps clinical_notes by normalized label (accents/case ignored)', () => {
    const blocks: ProtocolBlock[] = [
      { id: 'b1', type: 'clinical_notes', label: 'MOTIVO DE CONSULTA', content: 'Cefalea.' } as ProtocolBlock,
      { id: 'b2', type: 'clinical_notes', label: 'Diagnóstico presuntivo', content: 'HTA esencial.' } as ProtocolBlock,
      { id: 'b3', type: 'clinical_notes', label: 'Exploración dirigida', content: 'RsCsRs sin soplos.' } as ProtocolBlock,
    ]
    const out = generateRecordSections(makeInput({ usages: [{ blocks, modifications: {} }] }))
    expect(section(out, 'motivo_consulta')?.content).toBe('Cefalea.')
    expect(section(out, 'diagnosticos')?.content).toBe('HTA esencial.')
    expect(section(out, 'examen_fisico')?.content).toContain('RsCsRs sin soplos.')
  })

  it('formats vitals values into examen_fisico and skips empty vitals', () => {
    const blocks: ProtocolBlock[] = [
      {
        id: 'v1',
        type: 'vitals',
        fields: [
          { id: 'bp', label: 'PA', unit: 'mmHg', input_type: 'text' },
          { id: 'hr', label: 'FC', unit: 'lpm', input_type: 'number' },
          { id: 'temp', label: 'Temp', unit: '°C', input_type: 'number' },
        ],
        values: { bp: '148/92', hr: 76 },
      } as unknown as ProtocolBlock,
    ]
    const out = generateRecordSections(makeInput({ usages: [{ blocks, modifications: {} }] }))
    expect(section(out, 'examen_fisico')?.content).toContain('PA 148/92 mmHg · FC 76 lpm')
    expect(section(out, 'examen_fisico')?.content).not.toContain('Temp')
  })

  it('summarizes checklist checked items, steps, and decisions into evolucion', () => {
    const blocks: ProtocolBlock[] = [
      {
        id: 'ck1',
        type: 'checklist',
        title: 'Adherencia',
        items: [
          { id: 'i1', text: 'Toma dosis nocturna', checked: false },
          { id: 'i2', text: 'Dieta hiposódica', checked: true },
        ],
      } as unknown as ProtocolBlock,
      {
        id: 'st1',
        type: 'steps',
        title: 'Manejo',
        steps: [
          { id: 's1', order: 1, title: 'Medir PA en ambos brazos' },
          { id: 's2', order: 2, title: 'Fondo de ojo' },
        ],
      } as unknown as ProtocolBlock,
      {
        id: 'd1',
        type: 'decision',
        condition: '¿PA ≥ 160/100?',
        branches: [
          { id: 'br1', label: 'Sí', action: 'Referir' },
          { id: 'br2', label: 'No', action: 'Continuar' },
        ],
      } as unknown as ProtocolBlock,
    ]
    const out = generateRecordSections(
      makeInput({
        usages: [
          {
            blocks,
            modifications: {
              steps_completed: [{ step_id: 's1' }],
              steps_skipped: [{ step_id: 's2', reason: 'sin oftalmoscopio' }],
              decision_branches: [{ block_id: 'd1', branch_id: 'br2', branch_label: 'No' }],
            },
          },
        ],
      }),
    )
    const evo = section(out, 'evolucion')?.content ?? ''
    expect(evo).toContain('Adherencia: Dieta hiposódica')
    expect(evo).not.toContain('Toma dosis nocturna')
    expect(evo).toContain('Medir PA en ambos brazos')
    expect(evo).toContain('omitido')
    expect(evo).toContain('¿PA ≥ 160/100? → No')
  })

  it('composes plan_tratamiento from order records, never from blocks', () => {
    const blocks: ProtocolBlock[] = [
      {
        id: 'dt1',
        type: 'dosage_table',
        rows: [{ id: 'r1', drug: 'NuncaRecetado', dose: '1', route: 'VO', frequency: 'od', notes: '' }],
      } as unknown as ProtocolBlock,
    ]
    const out = generateRecordSections(
      makeInput({
        usages: [{ blocks, modifications: {} }],
        orders: {
          prescriptionItems: [{ drug: 'Losartán', dose: '100 mg', route: 'VO', frequency: 'cada 24 h', duration: '30 días' }],
          labTests: ['Perfil lipídico', 'Creatinina'],
          imagingStudies: ['Rx de tórax'],
        },
      }),
    )
    const plan = section(out, 'plan_tratamiento')?.content ?? ''
    expect(plan).toContain('Losartán 100 mg VO cada 24 h — 30 días')
    expect(plan).toContain('Laboratorio: Perfil lipídico, Creatinina')
    expect(plan).toContain('Imágenes: Rx de tórax')
    expect(plan).not.toContain('NuncaRecetado')
  })

  it('recurses into section blocks and ignores alert/text blocks', () => {
    const blocks: ProtocolBlock[] = [
      {
        id: 'sec1',
        type: 'section',
        title: 'Evaluación',
        blocks: [
          { id: 'n1', type: 'clinical_notes', label: 'Motivo', content: 'Anidado.' },
          { id: 'a1', type: 'alert', severity: 'danger', content: 'Nunca sale.' },
          { id: 't1', type: 'text', content: 'Tampoco.' },
        ],
      } as unknown as ProtocolBlock,
    ]
    const out = generateRecordSections(makeInput({ usages: [{ blocks, modifications: {} }] }))
    expect(section(out, 'motivo_consulta')?.content).toBe('Anidado.')
    const all = out.map((s) => s.content).join('\n')
    expect(all).not.toContain('Nunca sale.')
    expect(all).not.toContain('Tampoco.')
  })

  it('adds enmiendas section only when amendments exist', () => {
    const without = generateRecordSections(makeInput())
    expect(section(without, 'enmiendas')).toBeUndefined()
    const withAmendment = generateRecordSections(
      makeInput({ amendments: [{ reason: 'Dosis corregida', amendedAt: '2026-07-01T10:00:00Z' }] }),
    )
    expect(section(withAmendment, 'enmiendas')?.content).toContain('Dosis corregida')
    expect(section(withAmendment, 'enmiendas')?.required).toBe(false)
  })

  it('orders sections by the legal skeleton order', () => {
    const out = generateRecordSections(makeInput())
    const keys = out.map((s) => s.key)
    expect(keys.indexOf('motivo_consulta')).toBeLessThan(keys.indexOf('examen_fisico'))
    expect(keys.indexOf('diagnosticos')).toBeLessThan(keys.indexOf('plan_tratamiento'))
    expect(keys[0]).toBe('ficha_identificacion')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @rezeta/shared test -- generate-record-sections`
Expected: FAIL — `Cannot find module '../record/generate-record-sections.js'`

- [ ] **Step 3: Implement the mapper**

`packages/shared/src/record/generate-record-sections.ts`:

```typescript
import type {
  ConsultationRecordKind,
  RecordSection,
  RecordSectionKey,
} from '../types/consultation-record.js'
import { RECORD_SECTION_KEYS } from '../types/consultation-record.js'
import type { ProtocolBlock } from '../types/protocol.js'

export const RECORD_SECTION_TITLES: Record<RecordSectionKey, string> = {
  ficha_identificacion: 'Ficha de identificación',
  motivo_consulta: 'Motivo de consulta',
  antecedentes: 'Antecedentes',
  enfermedad_actual: 'Enfermedad actual',
  examen_fisico: 'Examen físico',
  evolucion: 'Evolución',
  resultados_estudios: 'Resultados de estudios',
  diagnosticos: 'Diagnósticos',
  plan_tratamiento: 'Plan de tratamiento',
  enmiendas: 'Enmiendas',
}

const REQUIRED_BY_KIND: Record<ConsultationRecordKind, readonly RecordSectionKey[]> = {
  first_visit: ['motivo_consulta', 'antecedentes', 'examen_fisico', 'diagnosticos', 'plan_tratamiento'],
  evolution: ['motivo_consulta', 'examen_fisico', 'evolucion', 'diagnosticos', 'plan_tratamiento'],
}

/** Sections that never render for a given kind (spec §5 table "—" cells). */
const EXCLUDED_BY_KIND: Record<ConsultationRecordKind, readonly RecordSectionKey[]> = {
  first_visit: ['evolucion'],
  evolution: ['enfermedad_actual'],
}

export interface RecordPatientInput {
  firstName: string
  lastName: string
  dateOfBirth: string | null
  sex: string | null
  documentType: string | null
  documentNumber: string | null
  phone: string | null
  address: string | null
  allergies: string[]
  chronicConditions: string[]
}

export interface RecordUsageInput {
  blocks: ProtocolBlock[]
  modifications: {
    steps_completed?: Array<{ step_id: string }>
    steps_skipped?: Array<{ step_id: string; reason?: string }>
    decision_branches?: Array<Record<string, unknown>>
  }
}

export interface RecordOrdersInput {
  prescriptionItems: Array<{
    drug: string
    dose: string
    route: string
    frequency: string
    duration: string
  }>
  labTests: string[]
  imagingStudies: string[]
}

export interface GenerateRecordSectionsInput {
  kind: ConsultationRecordKind
  patient: RecordPatientInput
  usages: RecordUsageInput[]
  orders: RecordOrdersInput
  amendments: Array<{ reason: string; amendedAt: string }>
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/** Free-narrative destination: evolución on follow-ups, enfermedad actual on first visits. */
function narrativeSection(kind: ConsultationRecordKind): RecordSectionKey {
  return kind === 'first_visit' ? 'enfermedad_actual' : 'evolucion'
}

function matchNotesSection(label: string, kind: ConsultationRecordKind): RecordSectionKey {
  const n = normalize(label)
  if (n.includes('motivo')) return 'motivo_consulta'
  if (n.includes('antecedente')) return 'antecedentes'
  if (n.includes('examen') || n.includes('fisic') || n.includes('exploracion')) return 'examen_fisico'
  if (n.includes('diagnostic')) return 'diagnosticos'
  if (n.includes('plan') || n.includes('tratamiento')) return 'plan_tratamiento'
  if (n.includes('evolucion')) return 'evolucion'
  if (n.includes('resultado') || n.includes('estudio')) return 'resultados_estudios'
  return narrativeSection(kind)
}

function calcAgeYears(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) return null
  const ms = Date.now() - new Date(dateOfBirth).getTime()
  return Math.floor(ms / (365.25 * 24 * 60 * 60 * 1000))
}

const SEX_LABELS: Record<string, string> = { male: 'Masculino', female: 'Femenino', other: 'Otro' }

function buildFicha(patient: RecordPatientInput): string {
  const lines: string[] = []
  const age = calcAgeYears(patient.dateOfBirth)
  const idBits = [
    `${patient.firstName} ${patient.lastName}`.trim(),
    age != null ? `${age} años` : null,
    patient.sex ? (SEX_LABELS[patient.sex] ?? patient.sex) : null,
  ].filter(Boolean)
  lines.push(idBits.join(' · '))
  if (patient.documentNumber) {
    lines.push(`${(patient.documentType ?? 'doc').toUpperCase()}: ${patient.documentNumber}`)
  }
  if (patient.phone) lines.push(`Teléfono: ${patient.phone}`)
  if (patient.address) lines.push(`Dirección: ${patient.address}`)
  if (patient.allergies.length > 0) lines.push(`Alergias: ${patient.allergies.join(', ')}`)
  if (patient.chronicConditions.length > 0) {
    lines.push(`Condiciones crónicas: ${patient.chronicConditions.join(', ')}`)
  }
  return lines.join('\n')
}

type Bucket = Map<RecordSectionKey, string[]>

function push(bucket: Bucket, key: RecordSectionKey, text: string): void {
  if (!text.trim()) return
  const arr = bucket.get(key) ?? []
  arr.push(text.trim())
  bucket.set(key, arr)
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function walkBlocks(
  blocks: ProtocolBlock[],
  usage: RecordUsageInput,
  kind: ConsultationRecordKind,
  bucket: Bucket,
): void {
  for (const raw of blocks) {
    const block = raw as any
    switch (block.type) {
      case 'section':
        walkBlocks((block.blocks ?? []) as ProtocolBlock[], usage, kind, bucket)
        break
      case 'clinical_notes': {
        const content = String(block.content ?? '')
        if (content.trim()) push(bucket, matchNotesSection(String(block.label ?? ''), kind), content)
        break
      }
      case 'vitals': {
        const values = (block.values ?? {}) as Record<string, string | number>
        const fields = (block.fields ?? []) as Array<{ id: string; label: string; unit?: string }>
        const parts = fields
          .filter((f) => values[f.id] !== undefined && values[f.id] !== '')
          .map((f) => `${f.label} ${String(values[f.id])}${f.unit ? ` ${f.unit}` : ''}`)
        if (parts.length > 0) push(bucket, 'examen_fisico', parts.join(' · '))
        break
      }
      case 'checklist': {
        const items = (block.items ?? []) as Array<{ text: string; checked?: boolean }>
        const checked = items.filter((i) => i.checked === true).map((i) => i.text)
        if (checked.length > 0) {
          push(bucket, narrativeSection(kind), `${String(block.title ?? 'Verificación')}: ${checked.join(', ')}`)
        }
        break
      }
      case 'steps': {
        const steps = (block.steps ?? []) as Array<{ id: string; title: string }>
        const completedIds = new Set((usage.modifications.steps_completed ?? []).map((s) => s.step_id))
        const skipped = new Map(
          (usage.modifications.steps_skipped ?? []).map((s) => [s.step_id, s.reason]),
        )
        const parts: string[] = []
        for (const step of steps) {
          if (completedIds.has(step.id)) parts.push(step.title)
          else if (skipped.has(step.id)) {
            const reason = skipped.get(step.id)
            parts.push(`${step.title} (omitido${reason ? `: ${reason}` : ''})`)
          }
        }
        if (parts.length > 0) {
          push(bucket, narrativeSection(kind), `${String(block.title ?? 'Pasos')}: ${parts.join(' · ')}`)
        }
        break
      }
      case 'decision': {
        const chosen = (usage.modifications.decision_branches ?? []).find(
          (d) => d['block_id'] === block.id,
        )
        if (chosen) {
          const branches = (block.branches ?? []) as Array<{ id: string; label: string }>
          const label =
            (chosen['branch_label'] as string | undefined) ??
            branches.find((b) => b.id === chosen['branch_id'])?.label ??
            ''
          if (label) push(bucket, narrativeSection(kind), `Decisión: ${String(block.condition ?? '')} → ${label}`)
        }
        break
      }
      // dosage_table / lab_order / imaging_order: plan comes from order records.
      // alert / text: reference material, never part of the historia.
      default:
        break
    }
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function buildPlan(orders: RecordOrdersInput): string {
  const lines: string[] = []
  for (const item of orders.prescriptionItems) {
    lines.push(`${item.drug} ${item.dose} ${item.route} ${item.frequency} — ${item.duration}`)
  }
  if (orders.labTests.length > 0) lines.push(`Laboratorio: ${orders.labTests.join(', ')}`)
  if (orders.imagingStudies.length > 0) lines.push(`Imágenes: ${orders.imagingStudies.join(', ')}`)
  return lines.join('\n')
}

export function generateRecordSections(input: GenerateRecordSectionsInput): RecordSection[] {
  const bucket: Bucket = new Map()
  push(bucket, 'ficha_identificacion', buildFicha(input.patient))
  for (const usage of input.usages) walkBlocks(usage.blocks, usage, input.kind, bucket)
  push(bucket, 'plan_tratamiento', buildPlan(input.orders))
  for (const amendment of input.amendments) {
    push(bucket, 'enmiendas', `${amendment.amendedAt.slice(0, 10)}: ${amendment.reason}`)
  }

  const required = new Set(REQUIRED_BY_KIND[input.kind])
  const excluded = new Set(EXCLUDED_BY_KIND[input.kind])

  const sections: RecordSection[] = []
  for (const key of RECORD_SECTION_KEYS) {
    if (excluded.has(key)) continue
    const content = (bucket.get(key) ?? []).join('\n\n')
    const isRequired = required.has(key)
    // ficha always renders; optional sections render only when they have content
    if (!content && !isRequired && key !== 'ficha_identificacion') continue
    sections.push({
      key,
      title: RECORD_SECTION_TITLES[key],
      content,
      source: 'generated',
      required: isRequired,
    })
  }
  return sections
}
```

- [ ] **Step 4: Export from the package index**

In `packages/shared/src/index.ts` add:

```typescript
export * from './record/generate-record-sections.js'
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @rezeta/shared test -- generate-record-sections`
Expected: PASS (10 tests)

Run: `pnpm --filter @rezeta/shared test`
Expected: PASS (no regressions)

- [ ] **Step 6: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): generate historia medica sections from protocol content"
```

---

### Task 3: Prisma model + migration

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create (generated): `packages/db/prisma/migrations/<timestamp>_consultation_records/migration.sql`

**Interfaces:**
- Produces: Prisma model `ConsultationRecord` (client accessor `prisma.consultationRecord`) with back-relations `Consultation.records` and `Tenant.consultationRecords`.

- [ ] **Step 1: Add the model**

In `packages/db/prisma/schema.prisma`, after the `ConsultationAmendment` model, add:

```prisma
model ConsultationRecord {
  id             String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId       String    @map("tenant_id") @db.Uuid
  consultationId String    @map("consultation_id") @db.Uuid
  patientId      String    @map("patient_id") @db.Uuid
  versionNumber  Int       @map("version_number")
  kind           String    @db.VarChar(20) // first_visit | evolution
  status         String    @default("draft") @db.VarChar(20) // draft | signed
  sections       Json      @db.JsonB
  generatedAt    DateTime  @map("generated_at")
  signedAt       DateTime? @map("signed_at")
  signedBy       String?   @map("signed_by") @db.Uuid
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")
  deletedAt      DateTime? @map("deleted_at")

  tenant       Tenant       @relation(fields: [tenantId], references: [id])
  consultation Consultation @relation(fields: [consultationId], references: [id])

  @@unique([consultationId, versionNumber])
  @@index([tenantId, patientId])
  @@map("consultation_records")
}
```

Add the back-relations:
- In `model Consultation`: `records ConsultationRecord[]`
- In `model Tenant`: `consultationRecords ConsultationRecord[]`

- [ ] **Step 2: Generate the migration and client**

Run: `pnpm --filter @rezeta/db migrate:dev -- --name consultation_records`
Expected: migration created, `Your database is now in sync`, client regenerated.

Run: `pnpm -r typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/db
git commit -m "feat(db): consultation_records table for historia medica"
```

---

### Task 4: API repository

**Files:**
- Create: `apps/api/src/modules/consultation-records/consultation-records.repository.ts`
- Test: `apps/api/src/modules/consultation-records/__tests__/consultation-records.repository.spec.ts`

**Interfaces:**
- Consumes: `PrismaService` (`apps/api/src/lib/prisma.service.ts`), `ConsultationRecordDto`, `RecordSection` (Task 1).
- Produces:

```typescript
class ConsultationRecordsRepository {
  findLatest(consultationId: string, tenantId: string): Promise<ConsultationRecordDto | null>
  create(data: {
    tenantId: string; consultationId: string; patientId: string
    versionNumber: number; kind: ConsultationRecordKind
    sections: RecordSection[]; generatedAt: Date
  }): Promise<ConsultationRecordDto>
  replaceSections(id: string, tenantId: string, sections: RecordSection[]): Promise<ConsultationRecordDto | null> // draft-only
  sign(id: string, tenantId: string, userId: string): Promise<ConsultationRecordDto | null>                       // draft-only
}
```

- [ ] **Step 1: Write the failing tests**

`apps/api/src/modules/consultation-records/__tests__/consultation-records.repository.spec.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConsultationRecordsRepository } from '../consultation-records.repository.js'
import type { PrismaService } from '../../../lib/prisma.service.js'

const now = new Date('2026-07-06T10:42:00Z')

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rec1',
    tenantId: 't1',
    consultationId: 'c1',
    patientId: 'p1',
    versionNumber: 1,
    kind: 'evolution',
    status: 'draft',
    sections: [
      { key: 'motivo_consulta', title: 'Motivo de consulta', content: 'Control.', source: 'generated', required: true },
    ],
    generatedAt: now,
    signedAt: null,
    signedBy: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  }
}

const mockPrisma = {
  consultationRecord: {
    findFirst: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
}

const repo = new ConsultationRecordsRepository(mockPrisma as unknown as PrismaService)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ConsultationRecordsRepository', () => {
  it('findLatest filters by tenant, excludes soft-deleted, orders by version desc', async () => {
    mockPrisma.consultationRecord.findFirst.mockResolvedValue(makeRow())
    const result = await repo.findLatest('c1', 't1')
    expect(mockPrisma.consultationRecord.findFirst).toHaveBeenCalledWith({
      where: { consultationId: 'c1', tenantId: 't1', deletedAt: null },
      orderBy: { versionNumber: 'desc' },
    })
    expect(result?.generatedAt).toBe(now.toISOString())
  })

  it('findLatest returns null when no record exists', async () => {
    mockPrisma.consultationRecord.findFirst.mockResolvedValue(null)
    expect(await repo.findLatest('c1', 't1')).toBeNull()
  })

  it('create persists the draft', async () => {
    mockPrisma.consultationRecord.create.mockResolvedValue(makeRow())
    const dto = await repo.create({
      tenantId: 't1',
      consultationId: 'c1',
      patientId: 'p1',
      versionNumber: 1,
      kind: 'evolution',
      sections: [],
      generatedAt: now,
    })
    expect(mockPrisma.consultationRecord.create).toHaveBeenCalled()
    expect(dto.status).toBe('draft')
  })

  it('replaceSections only touches drafts and re-reads the row', async () => {
    mockPrisma.consultationRecord.updateMany.mockResolvedValue({ count: 1 })
    mockPrisma.consultationRecord.findFirst.mockResolvedValue(makeRow())
    const result = await repo.replaceSections('rec1', 't1', [])
    expect(mockPrisma.consultationRecord.updateMany).toHaveBeenCalledWith({
      where: { id: 'rec1', tenantId: 't1', status: 'draft', deletedAt: null },
      data: { sections: [] },
    })
    expect(result).not.toBeNull()
  })

  it('replaceSections returns null when the record is not a draft', async () => {
    mockPrisma.consultationRecord.updateMany.mockResolvedValue({ count: 0 })
    expect(await repo.replaceSections('rec1', 't1', [])).toBeNull()
    expect(mockPrisma.consultationRecord.findFirst).not.toHaveBeenCalled()
  })

  it('sign stamps signedAt/signedBy on drafts only', async () => {
    mockPrisma.consultationRecord.updateMany.mockResolvedValue({ count: 1 })
    mockPrisma.consultationRecord.findFirst.mockResolvedValue(
      makeRow({ status: 'signed', signedAt: now, signedBy: 'u1' }),
    )
    const result = await repo.sign('rec1', 't1', 'u1')
    const call = mockPrisma.consultationRecord.updateMany.mock.calls[0][0]
    expect(call.where).toEqual({ id: 'rec1', tenantId: 't1', status: 'draft', deletedAt: null })
    expect(call.data.status).toBe('signed')
    expect(call.data.signedBy).toBe('u1')
    expect(result?.status).toBe('signed')
  })

  it('sign returns null when already signed', async () => {
    mockPrisma.consultationRecord.updateMany.mockResolvedValue({ count: 0 })
    expect(await repo.sign('rec1', 't1', 'u1')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @rezeta/api test -- consultation-records.repository`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement the repository**

`apps/api/src/modules/consultation-records/consultation-records.repository.ts`:

```typescript
import { Injectable, Inject } from '@nestjs/common'
import type {
  ConsultationRecordDto,
  ConsultationRecordKind,
  ConsultationRecordStatus,
  RecordSection,
} from '@rezeta/shared'
import { PrismaService } from '../../lib/prisma.service.js'

type RecordRow = {
  id: string
  consultationId: string
  patientId: string
  versionNumber: number
  kind: string
  status: string
  sections: unknown
  generatedAt: Date
  signedAt: Date | null
  signedBy: string | null
  createdAt: Date
  updatedAt: Date
}

function toDto(row: RecordRow): ConsultationRecordDto {
  return {
    id: row.id,
    consultationId: row.consultationId,
    patientId: row.patientId,
    versionNumber: row.versionNumber,
    kind: row.kind as ConsultationRecordKind,
    status: row.status as ConsultationRecordStatus,
    sections: row.sections as RecordSection[],
    generatedAt: row.generatedAt.toISOString(),
    signedAt: row.signedAt?.toISOString() ?? null,
    signedBy: row.signedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

@Injectable()
export class ConsultationRecordsRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async findLatest(consultationId: string, tenantId: string): Promise<ConsultationRecordDto | null> {
    const row = await this.prisma.consultationRecord.findFirst({
      where: { consultationId, tenantId, deletedAt: null },
      orderBy: { versionNumber: 'desc' },
    })
    return row ? toDto(row) : null
  }

  async create(data: {
    tenantId: string
    consultationId: string
    patientId: string
    versionNumber: number
    kind: ConsultationRecordKind
    sections: RecordSection[]
    generatedAt: Date
  }): Promise<ConsultationRecordDto> {
    const row = await this.prisma.consultationRecord.create({
      data: {
        tenantId: data.tenantId,
        consultationId: data.consultationId,
        patientId: data.patientId,
        versionNumber: data.versionNumber,
        kind: data.kind,
        status: 'draft',
        sections: data.sections as unknown as object,
        generatedAt: data.generatedAt,
      },
    })
    return toDto(row)
  }

  /** Draft-only. Returns null (no throw) when the record is not an editable draft. */
  async replaceSections(
    id: string,
    tenantId: string,
    sections: RecordSection[],
  ): Promise<ConsultationRecordDto | null> {
    const { count } = await this.prisma.consultationRecord.updateMany({
      where: { id, tenantId, status: 'draft', deletedAt: null },
      data: { sections: sections as unknown as object },
    })
    if (count === 0) return null
    const row = await this.prisma.consultationRecord.findFirst({
      where: { id, tenantId, deletedAt: null },
    })
    return row ? toDto(row) : null
  }

  /** Draft-only. Returns null when the record was not a draft (already signed). */
  async sign(id: string, tenantId: string, userId: string): Promise<ConsultationRecordDto | null> {
    const { count } = await this.prisma.consultationRecord.updateMany({
      where: { id, tenantId, status: 'draft', deletedAt: null },
      data: { status: 'signed', signedAt: new Date(), signedBy: userId },
    })
    if (count === 0) return null
    const row = await this.prisma.consultationRecord.findFirst({
      where: { id, tenantId, deletedAt: null },
    })
    return row ? toDto(row) : null
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @rezeta/api test -- consultation-records.repository`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/consultation-records
git commit -m "feat(api): consultation records repository"
```

---

### Task 5: API service — draft lifecycle

**Files:**
- Create: `apps/api/src/modules/consultation-records/consultation-records.service.ts`
- Test: `apps/api/src/modules/consultation-records/__tests__/consultation-records.service.spec.ts`

**Interfaces:**
- Consumes: `ConsultationRecordsRepository` (Task 4), `generateRecordSections` (Task 2), `PrismaService`, `AuditLogService` (`apps/api/src/common/audit-log/audit-log.service.js`), `httpAuditContextStore`.
- Produces:

```typescript
class ConsultationRecordsService {
  getLatest(consultationId: string, tenantId: string): Promise<ConsultationRecordDto>            // throws RECORD_NOT_FOUND
  ensureDraft(consultationId: string, tenantId: string): Promise<ConsultationRecordDto>          // creates v1 if none; returns existing otherwise
  regenerate(consultationId: string, tenantId: string): Promise<ConsultationRecordDto>           // rebuild draft / new version post-amendment
  updateSections(consultationId: string, tenantId: string, dto: UpdateRecordSectionsDto): Promise<ConsultationRecordDto>
  sign(consultationId: string, tenantId: string, userId: string): Promise<ConsultationRecordDto>
}
```

- [ ] **Step 1: Write the failing tests**

`apps/api/src/modules/consultation-records/__tests__/consultation-records.service.spec.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConsultationRecordsService } from '../consultation-records.service.js'
import type { ConsultationRecordsRepository } from '../consultation-records.repository.js'
import type { PrismaService } from '../../../lib/prisma.service.js'
import type { AuditLogService } from '../../../common/audit-log/audit-log.service.js'
import type { ConsultationRecordDto, RecordSection } from '@rezeta/shared'

const now = new Date('2026-07-06T10:42:00Z')

function makeSections(overrides: Partial<RecordSection>[] = []): RecordSection[] {
  const base: RecordSection[] = [
    { key: 'ficha_identificacion', title: 'Ficha de identificación', content: 'María Peña', source: 'generated', required: false },
    { key: 'motivo_consulta', title: 'Motivo de consulta', content: 'Control.', source: 'generated', required: true },
    { key: 'examen_fisico', title: 'Examen físico', content: 'PA 148/92 mmHg', source: 'generated', required: true },
    { key: 'evolucion', title: 'Evolución', content: 'Estable.', source: 'generated', required: true },
    { key: 'diagnosticos', title: 'Diagnósticos', content: 'HTA.', source: 'generated', required: true },
    { key: 'plan_tratamiento', title: 'Plan de tratamiento', content: 'Losartán 100 mg VO cada 24 h — 30 días', source: 'generated', required: true },
  ]
  for (const o of overrides) {
    const target = base.find((s) => s.key === o.key)
    if (target) Object.assign(target, o)
  }
  return base
}

function makeRecord(overrides: Partial<ConsultationRecordDto> = {}): ConsultationRecordDto {
  return {
    id: 'rec1',
    consultationId: 'c1',
    patientId: 'p1',
    versionNumber: 1,
    kind: 'evolution',
    status: 'draft',
    sections: makeSections(),
    generatedAt: now.toISOString(),
    signedAt: null,
    signedBy: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    ...overrides,
  }
}

function makeConsultationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    tenantId: 't1',
    patientId: 'p1',
    doctorId: 'u1',
    status: 'signed',
    startedAt: now,
    signedAt: now,
    patient: {
      firstName: 'María',
      lastName: 'Peña',
      dateOfBirth: new Date('1972-03-15'),
      sex: 'female',
      documentType: 'cedula',
      documentNumber: '001-1234567-8',
      phone: null,
      address: null,
      allergies: ['penicilina'],
      chronicConditions: [],
    },
    protocolUsages: [
      {
        content: {
          blocks: [
            { id: 'b1', type: 'clinical_notes', label: 'Motivo de consulta', content: 'Control de HTA.' },
          ],
        },
        modifications: {},
      },
    ],
    prescriptions: [
      {
        prescriptionItems: [
          { drug: 'Losartán', dose: '100 mg', route: 'VO', frequency: 'cada 24 h', duration: '30 días' },
        ],
      },
    ],
    labOrders: [{ labOrderItems: [{ testName: 'Creatinina' }] }],
    imagingOrders: [{ imagingOrderItems: [{ studyType: 'Rx de tórax' }] }],
    amendments: [],
    ...overrides,
  }
}

const mockRepo = {
  findLatest: vi.fn(),
  create: vi.fn(),
  replaceSections: vi.fn(),
  sign: vi.fn(),
}

const mockPrisma = {
  consultation: { findFirst: vi.fn(), count: vi.fn() },
}

const mockAudit = { record: vi.fn().mockResolvedValue(undefined) }

const svc = new ConsultationRecordsService(
  mockRepo as unknown as ConsultationRecordsRepository,
  mockPrisma as unknown as PrismaService,
  mockAudit as unknown as AuditLogService,
)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getLatest', () => {
  it('throws RECORD_NOT_FOUND when no record exists', async () => {
    mockRepo.findLatest.mockResolvedValue(null)
    await expect(svc.getLatest('c1', 't1')).rejects.toMatchObject({
      response: { code: 'RECORD_NOT_FOUND' },
    })
  })
})

describe('ensureDraft', () => {
  it('returns the existing record without creating another', async () => {
    mockRepo.findLatest.mockResolvedValue(makeRecord())
    const result = await svc.ensureDraft('c1', 't1')
    expect(result.id).toBe('rec1')
    expect(mockRepo.create).not.toHaveBeenCalled()
  })

  it('rejects when the consultation is not signed', async () => {
    mockRepo.findLatest.mockResolvedValue(null)
    mockPrisma.consultation.findFirst.mockResolvedValue(makeConsultationRow({ status: 'open', signedAt: null }))
    await expect(svc.ensureDraft('c1', 't1')).rejects.toMatchObject({
      response: { code: 'RECORD_CONSULTATION_NOT_SIGNED' },
    })
  })

  it('creates v1 with kind=first_visit when no earlier signed consultation exists', async () => {
    mockRepo.findLatest.mockResolvedValue(null)
    mockPrisma.consultation.findFirst.mockResolvedValue(makeConsultationRow())
    mockPrisma.consultation.count.mockResolvedValue(0)
    mockRepo.create.mockImplementation((data) => Promise.resolve(makeRecord({ kind: data.kind })))
    const result = await svc.ensureDraft('c1', 't1')
    expect(result.kind).toBe('first_visit')
    const created = mockRepo.create.mock.calls[0][0]
    expect(created.versionNumber).toBe(1)
    expect(created.sections.some((s: RecordSection) => s.key === 'motivo_consulta' && s.content === 'Control de HTA.')).toBe(true)
    expect(created.sections.some((s: RecordSection) => s.key === 'plan_tratamiento' && s.content.includes('Losartán'))).toBe(true)
  })

  it('creates kind=evolution when an earlier signed consultation exists', async () => {
    mockRepo.findLatest.mockResolvedValue(null)
    mockPrisma.consultation.findFirst.mockResolvedValue(makeConsultationRow())
    mockPrisma.consultation.count.mockResolvedValue(2)
    mockRepo.create.mockImplementation((data) => Promise.resolve(makeRecord({ kind: data.kind })))
    const result = await svc.ensureDraft('c1', 't1')
    expect(result.kind).toBe('evolution')
    expect(mockPrisma.consultation.count).toHaveBeenCalledWith({
      where: {
        tenantId: 't1',
        patientId: 'p1',
        status: { in: ['signed', 'amended'] },
        signedAt: { lt: now },
        id: { not: 'c1' },
        deletedAt: null,
      },
    })
  })
})

describe('regenerate', () => {
  it('rebuilds the draft in place (same version)', async () => {
    mockRepo.findLatest.mockResolvedValue(makeRecord())
    mockPrisma.consultation.findFirst.mockResolvedValue(makeConsultationRow())
    mockPrisma.consultation.count.mockResolvedValue(1)
    mockRepo.replaceSections.mockResolvedValue(makeRecord())
    await svc.regenerate('c1', 't1')
    expect(mockRepo.replaceSections).toHaveBeenCalled()
    expect(mockRepo.create).not.toHaveBeenCalled()
  })

  it('creates the next version when latest is signed and consultation was amended', async () => {
    mockRepo.findLatest.mockResolvedValue(makeRecord({ status: 'signed', versionNumber: 1 }))
    mockPrisma.consultation.findFirst.mockResolvedValue(
      makeConsultationRow({
        status: 'amended',
        amendments: [{ reason: 'Dosis corregida', amendedAt: now }],
      }),
    )
    mockPrisma.consultation.count.mockResolvedValue(1)
    mockRepo.create.mockImplementation((data) =>
      Promise.resolve(makeRecord({ versionNumber: data.versionNumber })),
    )
    const result = await svc.regenerate('c1', 't1')
    expect(result.versionNumber).toBe(2)
    const created = mockRepo.create.mock.calls[0][0]
    expect(created.sections.some((s: RecordSection) => s.key === 'enmiendas')).toBe(true)
  })

  it('rejects when latest is signed and there is no amendment', async () => {
    mockRepo.findLatest.mockResolvedValue(makeRecord({ status: 'signed' }))
    mockPrisma.consultation.findFirst.mockResolvedValue(makeConsultationRow())
    await expect(svc.regenerate('c1', 't1')).rejects.toMatchObject({
      response: { code: 'RECORD_ALREADY_SIGNED' },
    })
  })
})

describe('updateSections', () => {
  it('merges edited content and flags source=edited', async () => {
    mockRepo.findLatest.mockResolvedValue(makeRecord())
    mockRepo.replaceSections.mockImplementation((_id, _t, sections) =>
      Promise.resolve(makeRecord({ sections })),
    )
    const result = await svc.updateSections('c1', 't1', {
      sections: [{ key: 'diagnosticos', content: 'HTA descontrolada.' }],
    })
    const dx = result.sections.find((s) => s.key === 'diagnosticos')
    expect(dx?.content).toBe('HTA descontrolada.')
    expect(dx?.source).toBe('edited')
    const untouched = result.sections.find((s) => s.key === 'motivo_consulta')
    expect(untouched?.source).toBe('generated')
  })

  it('rejects edits to ficha_identificacion', async () => {
    mockRepo.findLatest.mockResolvedValue(makeRecord())
    await expect(
      svc.updateSections('c1', 't1', { sections: [{ key: 'ficha_identificacion', content: 'x' }] }),
    ).rejects.toMatchObject({ response: { code: 'VALIDATION_ERROR' } })
  })

  it('rejects when the latest record is signed', async () => {
    mockRepo.findLatest.mockResolvedValue(makeRecord({ status: 'signed' }))
    await expect(
      svc.updateSections('c1', 't1', { sections: [{ key: 'evolucion', content: 'x' }] }),
    ).rejects.toMatchObject({ response: { code: 'RECORD_NOT_DRAFT' } })
  })
})

describe('sign', () => {
  it('rejects when a required section is empty', async () => {
    mockRepo.findLatest.mockResolvedValue(
      makeRecord({ sections: makeSections([{ key: 'diagnosticos', content: '' }]) }),
    )
    await expect(svc.sign('c1', 't1', 'u1')).rejects.toMatchObject({
      response: { code: 'RECORD_REQUIRED_SECTIONS_MISSING', details: { missing: ['diagnosticos'] } },
    })
    expect(mockRepo.sign).not.toHaveBeenCalled()
  })

  it('signs a complete draft and audits it', async () => {
    mockRepo.findLatest.mockResolvedValue(makeRecord())
    mockRepo.sign.mockResolvedValue(makeRecord({ status: 'signed', signedBy: 'u1' }))
    const result = await svc.sign('c1', 't1', 'u1')
    expect(result.status).toBe('signed')
    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: 'ConsultationRecord', action: 'update' }),
    )
  })

  it('rejects when already signed', async () => {
    mockRepo.findLatest.mockResolvedValue(makeRecord({ status: 'signed' }))
    await expect(svc.sign('c1', 't1', 'u1')).rejects.toMatchObject({
      response: { code: 'RECORD_ALREADY_SIGNED' },
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @rezeta/api test -- consultation-records.service`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement the service**

`apps/api/src/modules/consultation-records/consultation-records.service.ts`:

```typescript
import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common'
import type {
  ConsultationRecordDto,
  ConsultationRecordKind,
  RecordSection,
  UpdateRecordSectionsDto,
  ProtocolBlock,
} from '@rezeta/shared'
import { ErrorCode, generateRecordSections } from '@rezeta/shared'
import type { GenerateRecordSectionsInput } from '@rezeta/shared'
import { ConsultationRecordsRepository } from './consultation-records.repository.js'
import { PrismaService } from '../../lib/prisma.service.js'
import { AuditLogService } from '../../common/audit-log/audit-log.service.js'
import { httpAuditContextStore } from '../../common/audit-log/audit-context.store.js'

@Injectable()
export class ConsultationRecordsService {
  constructor(
    @Inject(ConsultationRecordsRepository) private repo: ConsultationRecordsRepository,
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(AuditLogService) private auditLog: AuditLogService,
  ) {}

  async getLatest(consultationId: string, tenantId: string): Promise<ConsultationRecordDto> {
    const record = await this.repo.findLatest(consultationId, tenantId)
    if (!record) {
      throw new NotFoundException({
        code: ErrorCode.RECORD_NOT_FOUND,
        message: 'Esta consulta no tiene historia médica generada',
      })
    }
    return record
  }

  /** Creates v1 if the consultation has no record yet; otherwise returns the latest. */
  async ensureDraft(consultationId: string, tenantId: string): Promise<ConsultationRecordDto> {
    const existing = await this.repo.findLatest(consultationId, tenantId)
    if (existing) return existing
    const { input, patientId } = await this.buildGenerationInput(consultationId, tenantId)
    const record = await this.repo.create({
      tenantId,
      consultationId,
      patientId,
      versionNumber: 1,
      kind: input.kind,
      sections: generateRecordSections(input),
      generatedAt: new Date(),
    })
    this.audit(tenantId, record.id, 'create')
    return record
  }

  /**
   * Draft latest → re-derive its sections in place (discards edits).
   * Signed latest + amended consultation → next version with enmiendas.
   * Signed latest, no amendment → conflict.
   */
  async regenerate(consultationId: string, tenantId: string): Promise<ConsultationRecordDto> {
    const latest = await this.repo.findLatest(consultationId, tenantId)
    if (!latest) return this.ensureDraft(consultationId, tenantId)
    const { input, patientId } = await this.buildGenerationInput(consultationId, tenantId)

    if (latest.status === 'draft') {
      const updated = await this.repo.replaceSections(latest.id, tenantId, generateRecordSections(input))
      if (!updated) {
        throw new ConflictException({
          code: ErrorCode.RECORD_NOT_DRAFT,
          message: 'La historia ya no es un borrador',
        })
      }
      this.audit(tenantId, latest.id, 'update')
      return updated
    }

    if (input.amendments.length === 0) {
      throw new ConflictException({
        code: ErrorCode.RECORD_ALREADY_SIGNED,
        message: 'La historia firmada solo puede regenerarse tras una enmienda de la consulta',
      })
    }
    const record = await this.repo.create({
      tenantId,
      consultationId,
      patientId,
      versionNumber: latest.versionNumber + 1,
      kind: latest.kind,
      sections: generateRecordSections({ ...input, kind: latest.kind }),
      generatedAt: new Date(),
    })
    this.audit(tenantId, record.id, 'create')
    return record
  }

  async updateSections(
    consultationId: string,
    tenantId: string,
    dto: UpdateRecordSectionsDto,
  ): Promise<ConsultationRecordDto> {
    if (dto.sections.some((s) => s.key === 'ficha_identificacion')) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'La ficha de identificación se corrige en el expediente del paciente',
      })
    }
    const latest = await this.getLatest(consultationId, tenantId)
    if (latest.status !== 'draft') {
      throw new ConflictException({
        code: ErrorCode.RECORD_NOT_DRAFT,
        message: 'La historia firmada es de solo lectura',
      })
    }
    const edits = new Map(dto.sections.map((s) => [s.key, s.content]))
    const merged: RecordSection[] = latest.sections.map((section) =>
      edits.has(section.key)
        ? { ...section, content: edits.get(section.key) ?? '', source: 'edited' }
        : section,
    )
    const updated = await this.repo.replaceSections(latest.id, tenantId, merged)
    if (!updated) {
      throw new ConflictException({
        code: ErrorCode.RECORD_NOT_DRAFT,
        message: 'La historia firmada es de solo lectura',
      })
    }
    this.audit(tenantId, latest.id, 'update')
    return updated
  }

  async sign(consultationId: string, tenantId: string, userId: string): Promise<ConsultationRecordDto> {
    const latest = await this.getLatest(consultationId, tenantId)
    if (latest.status !== 'draft') {
      throw new ConflictException({
        code: ErrorCode.RECORD_ALREADY_SIGNED,
        message: 'La historia ya está firmada',
      })
    }
    const missing = latest.sections
      .filter((s) => s.required && s.content.trim() === '')
      .map((s) => s.key)
    if (missing.length > 0) {
      throw new BadRequestException({
        code: ErrorCode.RECORD_REQUIRED_SECTIONS_MISSING,
        message: `Faltan ${missing.length} sección(es) requerida(s) antes de firmar`,
        details: { missing },
      })
    }
    const signed = await this.repo.sign(latest.id, tenantId, userId)
    if (!signed) {
      throw new ConflictException({
        code: ErrorCode.RECORD_ALREADY_SIGNED,
        message: 'La historia ya está firmada',
      })
    }
    this.audit(tenantId, latest.id, 'update')
    return signed
  }

  /** Loads everything the mapper needs. Throws if the consultation is missing or unsigned. */
  private async buildGenerationInput(
    consultationId: string,
    tenantId: string,
  ): Promise<{ input: GenerateRecordSectionsInput; patientId: string }> {
    const c = await this.prisma.consultation.findFirst({
      where: { id: consultationId, tenantId, deletedAt: null },
      include: {
        patient: true,
        protocolUsages: { where: { deletedAt: null } },
        prescriptions: { where: { deletedAt: null }, include: { prescriptionItems: true } },
        labOrders: { where: { deletedAt: null }, include: { labOrderItems: true } },
        imagingOrders: { where: { deletedAt: null }, include: { imagingOrderItems: true } },
        amendments: true,
      },
    })
    if (!c) {
      throw new NotFoundException({
        code: ErrorCode.CONSULTATION_NOT_FOUND,
        message: 'Consultation not found',
      })
    }
    if (c.status !== 'signed' && c.status !== 'amended') {
      throw new ConflictException({
        code: ErrorCode.RECORD_CONSULTATION_NOT_SIGNED,
        message: 'La historia se genera al firmar la consulta',
      })
    }

    const priorSigned = await this.prisma.consultation.count({
      where: {
        tenantId,
        patientId: c.patientId,
        status: { in: ['signed', 'amended'] },
        signedAt: { lt: c.signedAt ?? new Date() },
        id: { not: c.id },
        deletedAt: null,
      },
    })
    const kind: ConsultationRecordKind = priorSigned === 0 ? 'first_visit' : 'evolution'

    const input: GenerateRecordSectionsInput = {
      kind,
      patient: {
        firstName: c.patient.firstName,
        lastName: c.patient.lastName,
        dateOfBirth: c.patient.dateOfBirth ? c.patient.dateOfBirth.toISOString() : null,
        sex: c.patient.sex,
        documentType: c.patient.documentType,
        documentNumber: c.patient.documentNumber,
        phone: c.patient.phone,
        address: c.patient.address,
        allergies: (c.patient.allergies as string[] | null) ?? [],
        chronicConditions: (c.patient.chronicConditions as string[] | null) ?? [],
      },
      usages: c.protocolUsages.map((u) => ({
        blocks: ((u.content as { blocks?: ProtocolBlock[] } | null)?.blocks ?? []) as ProtocolBlock[],
        modifications: (u.modifications ?? {}) as GenerateRecordSectionsInput['usages'][number]['modifications'],
      })),
      orders: {
        prescriptionItems: c.prescriptions.flatMap((p) =>
          p.prescriptionItems.map((i) => ({
            drug: i.drug,
            dose: i.dose,
            route: i.route,
            frequency: i.frequency,
            duration: i.duration,
          })),
        ),
        labTests: c.labOrders.flatMap((o) => o.labOrderItems.map((i) => i.testName)),
        imagingStudies: c.imagingOrders.flatMap((o) => o.imagingOrderItems.map((i) => i.studyType)),
      },
      amendments: c.amendments.map((a) => ({
        reason: a.reason,
        amendedAt: a.amendedAt.toISOString(),
      })),
    }
    return { input, patientId: c.patientId }
  }

  /** Non-fatal audit write, mirrors the consultations-service pattern. */
  private audit(tenantId: string, entityId: string, action: 'create' | 'update'): void {
    const httpCtx = httpAuditContextStore.getStore()
    void this.auditLog.record({
      tenantId,
      ...(httpCtx?.actorUserId ? { actorUserId: httpCtx.actorUserId } : {}),
      actorType: httpCtx ? 'user' : 'system',
      category: 'entity',
      action,
      entityType: 'ConsultationRecord',
      entityId,
      status: 'success',
    })
  }
}
```

Note: if `Prisma` relation/field names differ (`prescriptionItems` vs `items`, `amendedAt` vs `createdAt` on `ConsultationAmendment`), check `packages/db/prisma/schema.prisma` and use the schema's exact names — the tests mock rows, so mirror whatever the schema says in both.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @rezeta/api test -- consultation-records.service`
Expected: PASS (13 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/consultation-records
git commit -m "feat(api): consultation record draft lifecycle service"
```

---

### Task 6: Controller + module wiring

**Files:**
- Create: `apps/api/src/modules/consultation-records/consultation-records.controller.ts`
- Create: `apps/api/src/modules/consultation-records/consultation-records.module.ts`
- Create: `apps/api/src/modules/consultation-records/index.ts`
- Test: `apps/api/src/modules/consultation-records/__tests__/consultation-records.controller.spec.ts`
- Modify: `apps/api/src/app.module.ts` (register the module)

**Interfaces:**
- Consumes: `ConsultationRecordsService` (Task 5), `UpdateRecordSectionsSchema` (Task 1). Follow the decorator/pipe/guard conventions of `apps/api/src/modules/consultations/consultations.controller.ts` **exactly** (same `@TenantId()`/`@CurrentUser()` decorators, same Zod validation pipe, same guards).
- Produces routes: `GET /v1/consultations/:consultationId/record`, `POST …/record` (ensure draft), `PATCH …/record`, `POST …/record/regenerate`, `POST …/record/sign`. (The `GET …/record/pdf` route is added in Task 8.)

- [ ] **Step 1: Write the failing controller test**

`apps/api/src/modules/consultation-records/__tests__/consultation-records.controller.spec.ts` — mirror the mocking style of `apps/api/src/modules/consultations/__tests__/consultations.controller.spec.ts` (mock service, instantiate controller directly):

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConsultationRecordsController } from '../consultation-records.controller.js'
import type { ConsultationRecordsService } from '../consultation-records.service.js'
import type { PdfService } from '../../../lib/pdf.service.js'

const mockSvc = {
  getLatest: vi.fn(),
  ensureDraft: vi.fn(),
  regenerate: vi.fn(),
  updateSections: vi.fn(),
  sign: vi.fn(),
  getPdfData: vi.fn(),
}
const mockPdf = { generateHistoriaMedica: vi.fn() }

const user = { id: 'u1' }
const controller = new ConsultationRecordsController(
  mockSvc as unknown as ConsultationRecordsService,
  mockPdf as unknown as PdfService,
)

beforeEach(() => vi.clearAllMocks())

describe('ConsultationRecordsController', () => {
  it('GET delegates to getLatest with tenant scope', async () => {
    mockSvc.getLatest.mockResolvedValue({ id: 'rec1' })
    await controller.get('t1', 'c1')
    expect(mockSvc.getLatest).toHaveBeenCalledWith('c1', 't1')
  })

  it('POST delegates to ensureDraft', async () => {
    mockSvc.ensureDraft.mockResolvedValue({ id: 'rec1' })
    await controller.create('t1', 'c1')
    expect(mockSvc.ensureDraft).toHaveBeenCalledWith('c1', 't1')
  })

  it('PATCH delegates to updateSections with the parsed dto', async () => {
    mockSvc.updateSections.mockResolvedValue({ id: 'rec1' })
    const dto = { sections: [{ key: 'evolucion', content: 'x' }] }
    await controller.update('t1', 'c1', dto as never)
    expect(mockSvc.updateSections).toHaveBeenCalledWith('c1', 't1', dto)
  })

  it('POST regenerate delegates', async () => {
    mockSvc.regenerate.mockResolvedValue({ id: 'rec1' })
    await controller.regenerate('t1', 'c1')
    expect(mockSvc.regenerate).toHaveBeenCalledWith('c1', 't1')
  })

  it('POST sign passes the acting user', async () => {
    mockSvc.sign.mockResolvedValue({ id: 'rec1', status: 'signed' })
    await controller.sign('t1', user as never, 'c1')
    expect(mockSvc.sign).toHaveBeenCalledWith('c1', 't1', 'u1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @rezeta/api test -- consultation-records.controller`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement controller and module**

`apps/api/src/modules/consultation-records/consultation-records.controller.ts` — copy the exact imports for guards/decorators/pipes from `consultations.controller.ts` (e.g. `@TenantId()`, `@CurrentUser()`, `ZodValidationPipe`, `ParseUUIDPipe`, `@ApiOperation`); the body pattern:

```typescript
import { Controller, Get, Post, Patch, Param, Body, Inject, ParseUUIDPipe, HttpCode, HttpStatus } from '@nestjs/common'
import type { ConsultationRecordDto, UpdateRecordSectionsDto } from '@rezeta/shared'
import { UpdateRecordSectionsSchema } from '@rezeta/shared'
import { ConsultationRecordsService } from './consultation-records.service.js'
import { PdfService } from '../../lib/pdf.service.js'
// + the same auth guard/decorator imports used by consultations.controller.ts

@Controller('v1/consultations/:consultationId/record')
export class ConsultationRecordsController {
  constructor(
    @Inject(ConsultationRecordsService) private svc: ConsultationRecordsService,
    @Inject(PdfService) private pdf: PdfService,
  ) {}

  @Get()
  get(
    @TenantId() tenantId: string,
    @Param('consultationId', ParseUUIDPipe) consultationId: string,
  ): Promise<ConsultationRecordDto> {
    return this.svc.getLatest(consultationId, tenantId)
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  create(
    @TenantId() tenantId: string,
    @Param('consultationId', ParseUUIDPipe) consultationId: string,
  ): Promise<ConsultationRecordDto> {
    return this.svc.ensureDraft(consultationId, tenantId)
  }

  @Patch()
  update(
    @TenantId() tenantId: string,
    @Param('consultationId', ParseUUIDPipe) consultationId: string,
    @Body(new ZodValidationPipe(UpdateRecordSectionsSchema)) dto: UpdateRecordSectionsDto,
  ): Promise<ConsultationRecordDto> {
    return this.svc.updateSections(consultationId, tenantId, dto)
  }

  @Post('regenerate')
  @HttpCode(HttpStatus.OK)
  regenerate(
    @TenantId() tenantId: string,
    @Param('consultationId', ParseUUIDPipe) consultationId: string,
  ): Promise<ConsultationRecordDto> {
    return this.svc.regenerate(consultationId, tenantId)
  }

  @Post('sign')
  @HttpCode(HttpStatus.OK)
  sign(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('consultationId', ParseUUIDPipe) consultationId: string,
  ): Promise<ConsultationRecordDto> {
    return this.svc.sign(consultationId, tenantId, user.id)
  }
}
```

`consultation-records.module.ts` — mirror `orders.module.ts` (it already provides `PdfService`):

```typescript
import { Module } from '@nestjs/common'
import { ConsultationRecordsController } from './consultation-records.controller.js'
import { ConsultationRecordsService } from './consultation-records.service.js'
import { ConsultationRecordsRepository } from './consultation-records.repository.js'
import { PdfService } from '../../lib/pdf.service.js'
// + import whatever module/provider pattern orders.module.ts uses for
//   PrismaService and AuditLogService and replicate it here

@Module({
  controllers: [ConsultationRecordsController],
  providers: [ConsultationRecordsService, ConsultationRecordsRepository, PdfService],
  exports: [ConsultationRecordsService],
})
export class ConsultationRecordsModule {}
```

`index.ts`:

```typescript
export * from './consultation-records.module.js'
export * from './consultation-records.service.js'
```

Register `ConsultationRecordsModule` in `apps/api/src/app.module.ts` imports (alongside the other feature modules).

- [ ] **Step 4: Run tests and typecheck**

Run: `pnpm --filter @rezeta/api test -- consultation-records`
Expected: PASS

Run: `pnpm -r typecheck && pnpm lint`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat(api): consultation record endpoints and module"
```

---

### Task 7: Hook draft creation into the consultation sign flow

**Files:**
- Modify: `apps/api/src/modules/consultations/consultations.service.ts` (`sign()`, constructor)
- Modify: `apps/api/src/modules/consultations/consultations.module.ts` (import `ConsultationRecordsModule`)
- Modify: `apps/api/src/modules/consultations/__tests__/consultations.service.spec.ts` (sign tests)

**Interfaces:**
- Consumes: `ConsultationRecordsService.ensureDraft` (Task 5), `RecordOutcome` (Task 1).
- Produces: `sign()` returns `{ ...consultation, invoiceOutcome, recordOutcome }`.

- [ ] **Step 1: Write the failing tests**

In `consultations.service.spec.ts`, the existing sign tests construct the service with mocked dependencies. Add a `mockRecordsSvc = { ensureDraft: vi.fn() }` to the constructor call (new last parameter) and add:

```typescript
  it('sign reports recordOutcome=created when the draft is generated', async () => {
    // arrange the same happy-path mocks the existing sign test uses, plus:
    mockRecordsSvc.ensureDraft.mockResolvedValue({ id: 'rec1' })
    const result = await svc.sign('c1', 't1', 'u1')
    expect(result.recordOutcome).toEqual({ status: 'created', recordId: 'rec1' })
  })

  it('sign reports recordOutcome=failed without failing the sign', async () => {
    mockRecordsSvc.ensureDraft.mockRejectedValue(new Error('boom'))
    const result = await svc.sign('c1', 't1', 'u1')
    expect(result.recordOutcome).toEqual({ status: 'failed' })
    expect(result.status).toBe('signed')
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @rezeta/api test -- consultations.service`
Expected: FAIL — constructor arity / `recordOutcome` is `{ status: 'failed' }` in the created case

- [ ] **Step 3: Implement**

In `consultations.service.ts`:
- Add constructor dependency: `@Inject(ConsultationRecordsService) private recordsSvc: ConsultationRecordsService` (import from `../consultation-records/index.js`).
- Replace the temporary line from Task 1 at the end of `sign()`:

```typescript
    // Auto-generate the historia médica draft. Failure never fails the sign —
    // the outcome is reported back so the client can offer "Generar historia".
    let recordOutcome: RecordOutcome
    try {
      const record = await this.recordsSvc.ensureDraft(id, tenantId)
      recordOutcome = { status: 'created', recordId: record.id }
    } catch {
      recordOutcome = { status: 'failed' }
    }

    return { ...consultation, invoiceOutcome, recordOutcome }
```

- Add `RecordOutcome` to the `@rezeta/shared` type imports.
- In `consultations.module.ts`, add `ConsultationRecordsModule` to `imports` (no circular dependency: consultation-records does not import ConsultationsModule).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @rezeta/api test`
Expected: PASS (all api tests, including untouched sign tests updated for the new constructor arg)

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat(api): auto-create historia draft on consultation sign"
```

---

### Task 8: Historia PDF — generator + streaming endpoint

**Files:**
- Modify: `apps/api/src/lib/pdf.service.ts` (add `HistoriaMedicaPdfData` + `generateHistoriaMedica`)
- Modify: `apps/api/src/modules/consultation-records/consultation-records.service.ts` (add `getPdfData`)
- Modify: `apps/api/src/modules/consultation-records/consultation-records.controller.ts` (add `GET pdf`)
- Test: `apps/api/src/lib/__tests__/pdf.service.historia.spec.ts` (create; follow the location of existing pdf.service tests if they live elsewhere — `grep -r "generatePrescription" apps/api --include="*.spec.ts" -l`)

**Interfaces:**
- Consumes: `RecordSection`, `ConsultationRecordDto` (Task 1); PDFKit helpers already in `pdf.service.ts` (`toBuffer`, `formatDate`, `calcAge`, `strokeLine`, `fillRect`, layout constants `MARGIN`, `CONTENT_W`, palette `T`).
- Produces:

```typescript
export interface HistoriaMedicaPdfData {
  record: Pick<ConsultationRecordDto, 'kind' | 'status' | 'sections' | 'versionNumber' | 'generatedAt' | 'signedAt'>
  doctor: { fullName: string | null; specialty: string | null; licenseNumber: string | null }
  patient: { firstName: string; lastName: string; dateOfBirth: string | null; documentNumber: string | null; documentType: string | null }
  location: { name: string; address: string | null } | null
  startedAt: string // consultation start (date + hour, §6.1.9)
}
generateHistoriaMedica(data: HistoriaMedicaPdfData): Promise<Buffer>
// and on the service:
getPdfData(consultationId: string, tenantId: string): Promise<HistoriaMedicaPdfData>
```

- [ ] **Step 1: Write the failing smoke test**

```typescript
import { describe, it, expect } from 'vitest'
import { PdfService } from '../pdf.service.js'
import type { HistoriaMedicaPdfData } from '../pdf.service.js'

const data: HistoriaMedicaPdfData = {
  record: {
    kind: 'evolution',
    status: 'signed',
    versionNumber: 1,
    generatedAt: '2026-07-06T10:42:00Z',
    signedAt: '2026-07-06T11:00:00Z',
    sections: [
      { key: 'ficha_identificacion', title: 'Ficha de identificación', content: 'María Peña · 54 años', source: 'generated', required: false },
      { key: 'motivo_consulta', title: 'Motivo de consulta', content: 'Control de HTA.', source: 'generated', required: true },
      { key: 'plan_tratamiento', title: 'Plan de tratamiento', content: 'Losartán 100 mg VO cada 24 h — 30 días', source: 'edited', required: true },
    ],
  },
  doctor: { fullName: 'Ana Herrera', specialty: 'Cardiología', licenseNumber: '145-23' },
  patient: { firstName: 'María', lastName: 'Peña', dateOfBirth: '1972-03-15', documentNumber: '001-1234567-8', documentType: 'cedula' },
  location: { name: 'Centro Médico Naco', address: 'Av. Tiradentes 45' },
  startedAt: '2026-07-06T10:42:00Z',
}

describe('generateHistoriaMedica', () => {
  it('renders a non-empty pdf buffer', async () => {
    const pdf = new PdfService()
    const buffer = await pdf.generateHistoriaMedica(data)
    expect(buffer.length).toBeGreaterThan(1000)
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-')
  })

  it('renders a draft watermark variant without throwing', async () => {
    const pdf = new PdfService()
    const buffer = await pdf.generateHistoriaMedica({
      ...data,
      record: { ...data.record, status: 'draft', signedAt: null },
    })
    expect(buffer.length).toBeGreaterThan(1000)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @rezeta/api test -- pdf.service.historia`
Expected: FAIL — `generateHistoriaMedica is not a function`

- [ ] **Step 3: Implement the generator**

In `pdf.service.ts`, add the `HistoriaMedicaPdfData` interface (as in the Interfaces block above) next to the other PDF data types, and the builder + public method. Use the **flow API** (`doc.text` with automatic pagination) rather than the manual `y` tracking of the prescription builder — historias have unbounded length:

```typescript
function buildHistoriaMedica(doc: PDFKit.PDFDocument, data: HistoriaMedicaPdfData): void {
  const { record, doctor, patient, location } = data
  const patientFullName = `${patient.firstName} ${patient.lastName}`.trim()
  const kindTitle = record.kind === 'first_visit' ? 'Historia médica — Primera consulta' : 'Historia médica — Nota de evolución'
  const startedDate = new Date(data.startedAt)
  const hour = `${String(startedDate.getHours()).padStart(2, '0')}:${String(startedDate.getMinutes()).padStart(2, '0')}`

  // Header (same visual language as prescriptions)
  doc.font('Helvetica-Bold').fontSize(16).fillColor(T.teal)
  doc.text(`Dr. ${doctor.fullName ?? 'Médico'}`, MARGIN, MARGIN)
  doc.font('Helvetica').fontSize(9).fillColor(T.n500)
  if (doctor.specialty) doc.text(doctor.specialty)
  if (doctor.licenseNumber) doc.text(`Exequátur: ${doctor.licenseNumber}`)
  if (location) doc.text(location.name)
  doc.text(`${formatDate(data.startedAt)} · ${hour}`, MARGIN, MARGIN + 2, {
    width: CONTENT_W,
    align: 'right',
  })
  doc.moveDown(0.5)
  strokeLine(doc, MARGIN, doc.y, MARGIN + CONTENT_W, doc.y, T.teal, 2)
  doc.moveDown(0.8)

  // Title + patient line
  doc.font('Helvetica-Bold').fontSize(13).fillColor(T.n900).text(kindTitle, MARGIN)
  const docId = patient.documentNumber
    ? `${(patient.documentType ?? 'Doc.').toUpperCase()} ${patient.documentNumber}`
    : null
  doc.font('Helvetica').fontSize(10).fillColor(T.n600)
  doc.text([patientFullName, calcAge(patient.dateOfBirth), docId].filter(Boolean).join('  ·  '))
  doc.moveDown(1)

  // Draft banner
  if (record.status === 'draft') {
    doc.font('Helvetica-Bold').fontSize(10).fillColor(T.warnText)
    doc.text('BORRADOR — PENDIENTE DE FIRMA', MARGIN)
    doc.moveDown(0.6)
  }

  // Sections
  for (const section of record.sections) {
    if (!section.content.trim()) continue
    doc.font('Helvetica-Bold').fontSize(9).fillColor(T.teal)
    doc.text(section.title.toUpperCase(), MARGIN, doc.y)
    doc.moveDown(0.2)
    doc.font('Helvetica').fontSize(10).fillColor(T.n700)
    doc.text(section.content, MARGIN + 10, doc.y, { width: CONTENT_W - 10 })
    doc.moveDown(0.8)
  }

  // Signature footer
  doc.moveDown(1.5)
  strokeLine(doc, MARGIN, doc.y, MARGIN + 200, doc.y, T.n300, 1)
  doc.moveDown(0.3)
  doc.font('Helvetica-Bold').fontSize(10).fillColor(T.n800)
  doc.text(`Dr. ${doctor.fullName ?? ''}`, MARGIN)
  doc.font('Helvetica').fontSize(9).fillColor(T.n500)
  if (doctor.licenseNumber) doc.text(`Exequátur: ${doctor.licenseNumber}`)
  if (record.signedAt) {
    const signed = new Date(record.signedAt)
    const signedHour = `${String(signed.getHours()).padStart(2, '0')}:${String(signed.getMinutes()).padStart(2, '0')}`
    doc.text(`Firmada: ${formatDate(record.signedAt)} · ${signedHour} · v${record.versionNumber}`)
  }
}
```

and on the `PdfService` class:

```typescript
  generateHistoriaMedica(data: HistoriaMedicaPdfData): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'LETTER', margin: MARGIN })
    buildHistoriaMedica(doc, data)
    return toBuffer(doc)
  }
```

- [ ] **Step 4: Add `getPdfData` to the records service**

In `consultation-records.service.ts`:

```typescript
  async getPdfData(consultationId: string, tenantId: string): Promise<HistoriaMedicaPdfData> {
    const record = await this.getLatest(consultationId, tenantId)
    const c = await this.prisma.consultation.findFirst({
      where: { id: consultationId, tenantId, deletedAt: null },
      include: { patient: true, doctor: true, location: true },
    })
    if (!c) {
      throw new NotFoundException({
        code: ErrorCode.CONSULTATION_NOT_FOUND,
        message: 'Consultation not found',
      })
    }
    return {
      record,
      doctor: {
        fullName: c.doctor.fullName,
        specialty: c.doctor.specialty,
        licenseNumber: c.doctor.licenseNumber,
      },
      patient: {
        firstName: c.patient.firstName,
        lastName: c.patient.lastName,
        dateOfBirth: c.patient.dateOfBirth ? c.patient.dateOfBirth.toISOString() : null,
        documentNumber: c.patient.documentNumber,
        documentType: c.patient.documentType,
      },
      location: c.location ? { name: c.location.name, address: c.location.address } : null,
      startedAt: c.startedAt.toISOString(),
    }
  }
```

(import `HistoriaMedicaPdfData` from `../../lib/pdf.service.js`; check the relation name for `location` on `Consultation` in `schema.prisma` and use the exact one.)

- [ ] **Step 5: Add the streaming endpoint**

In `consultation-records.controller.ts` (mirror `orders.controller.ts` streaming pattern, `import type { Response } from 'express'`):

```typescript
  @Get('pdf')
  async pdfDownload(
    @TenantId() tenantId: string,
    @Param('consultationId', ParseUUIDPipe) consultationId: string,
    @Res() res: Response,
  ): Promise<void> {
    const data = await this.svc.getPdfData(consultationId, tenantId)
    const buffer = await this.pdf.generateHistoriaMedica(data)
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="historia-${consultationId}.pdf"`,
    })
    res.send(buffer)
  }
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter @rezeta/api test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/api
git commit -m "feat(api): historia medica pdf generation and download endpoint"
```

---

### Task 9: Frontend hooks

**Files:**
- Create: `apps/web/src/hooks/consultations/use-consultation-record.ts`
- Test: `apps/web/src/hooks/consultations/__tests__/use-consultation-record.test.tsx` (mirror the harness of the existing tests in that `__tests__` dir — QueryClientProvider wrapper + mocked `apiClient`)

**Interfaces:**
- Consumes: `apiClient` (`@/lib/api-client` — `get/post/patch/download`, `triggerDownload`), `ApiRequestError`; shared types (Task 1).
- Produces:

```typescript
useConsultationRecord(consultationId: string | null): UseQueryResult<ConsultationRecordDto | null, Error> // null on RECORD_NOT_FOUND
useEnsureRecord(): UseMutationResult<ConsultationRecordDto, Error, string>            // arg: consultationId
useUpdateRecordSections(consultationId: string): UseMutationResult<ConsultationRecordDto, Error, UpdateRecordSectionsDto>
useRegenerateRecord(consultationId: string): UseMutationResult<ConsultationRecordDto, Error, void>
useSignRecord(consultationId: string): UseMutationResult<ConsultationRecordDto, Error, void>
downloadRecordPdf(consultationId: string): Promise<void>
```

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useConsultationRecord, useSignRecord } from '../use-consultation-record'
import { apiClient, ApiRequestError } from '@/lib/api-client'

vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-client')>()
  return {
    ...actual,
    apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), download: vi.fn() },
  }
})

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => vi.clearAllMocks())

describe('useConsultationRecord', () => {
  it('fetches the record', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ id: 'rec1', status: 'draft' })
    const { result } = renderHook(() => useConsultationRecord('c1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.get).toHaveBeenCalledWith('/v1/consultations/c1/record')
    expect(result.current.data).toMatchObject({ id: 'rec1' })
  })

  it('resolves null on RECORD_NOT_FOUND instead of erroring', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(
      new ApiRequestError({ code: 'RECORD_NOT_FOUND', message: 'x' }),
    )
    const { result } = renderHook(() => useConsultationRecord('c1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeNull()
  })

  it('is disabled without a consultation id', () => {
    const { result } = renderHook(() => useConsultationRecord(null), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
  })
})

describe('useSignRecord', () => {
  it('posts to the sign endpoint', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ id: 'rec1', status: 'signed' })
    const { result } = renderHook(() => useSignRecord('c1'), { wrapper })
    result.current.mutate()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.post).toHaveBeenCalledWith('/v1/consultations/c1/record/sign', {})
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @rezeta/web test -- use-consultation-record`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement the hooks**

`apps/web/src/hooks/consultations/use-consultation-record.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query'
import { apiClient, ApiRequestError, triggerDownload } from '@/lib/api-client'
import type { ConsultationRecordDto, UpdateRecordSectionsDto } from '@rezeta/shared'

const QK = 'consultation-record'

export function useConsultationRecord(
  consultationId: string | null,
): UseQueryResult<ConsultationRecordDto | null, Error> {
  return useQuery({
    queryKey: [QK, consultationId],
    queryFn: async () => {
      try {
        return await apiClient.get<ConsultationRecordDto>(`/v1/consultations/${consultationId}/record`)
      } catch (err) {
        if (err instanceof ApiRequestError && err.error.code === 'RECORD_NOT_FOUND') return null
        throw err
      }
    },
    enabled: Boolean(consultationId),
  })
}

function useRecordMutation<TVars>(
  consultationId: string,
  run: (vars: TVars) => Promise<ConsultationRecordDto>,
): UseMutationResult<ConsultationRecordDto, Error, TVars> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: run,
    onSuccess: (record) => {
      qc.setQueryData([QK, consultationId], record)
    },
  })
}

export function useEnsureRecord(): UseMutationResult<ConsultationRecordDto, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (consultationId: string) =>
      apiClient.post<ConsultationRecordDto>(`/v1/consultations/${consultationId}/record`, {}),
    onSuccess: (record, consultationId) => {
      qc.setQueryData([QK, consultationId], record)
    },
  })
}

export function useUpdateRecordSections(
  consultationId: string,
): UseMutationResult<ConsultationRecordDto, Error, UpdateRecordSectionsDto> {
  return useRecordMutation(consultationId, (dto) =>
    apiClient.patch<ConsultationRecordDto>(`/v1/consultations/${consultationId}/record`, dto),
  )
}

export function useRegenerateRecord(
  consultationId: string,
): UseMutationResult<ConsultationRecordDto, Error, void> {
  return useRecordMutation(consultationId, () =>
    apiClient.post<ConsultationRecordDto>(`/v1/consultations/${consultationId}/record/regenerate`, {}),
  )
}

export function useSignRecord(
  consultationId: string,
): UseMutationResult<ConsultationRecordDto, Error, void> {
  return useRecordMutation(consultationId, () =>
    apiClient.post<ConsultationRecordDto>(`/v1/consultations/${consultationId}/record/sign`, {}),
  )
}

export async function downloadRecordPdf(consultationId: string): Promise<void> {
  const blob = await apiClient.download(`/v1/consultations/${consultationId}/record/pdf`)
  triggerDownload(blob, `historia-${consultationId}.pdf`)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @rezeta/web test -- use-consultation-record`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): consultation record hooks"
```

---

### Task 10: Patient detail — Historia tab (list + document pane)

**Files:**
- Create: `apps/web/src/pages/PatientDetail/HistoriaTab.tsx`
- Create: `apps/web/src/pages/PatientDetail/RecordDocument.tsx`
- Modify: `apps/web/src/pages/PatientDetail/strings.ts` (new strings)
- Modify: `apps/web/src/pages/PatientDetail/index.tsx` (swap tab content)
- Test: `apps/web/src/pages/PatientDetail/__tests__/HistoriaTab.test.tsx`
- Test: `apps/web/src/pages/PatientDetail/__tests__/RecordDocument.test.tsx`

**Interfaces:**
- Consumes: `usePatientConsultations` (`@/hooks/consultations/use-consultations`), all hooks + `downloadRecordPdf` (Task 9), UI kit (`Button`, `Badge`, `Spinner`, `Overline`, `Textarea` from `@/components/ui` — check `apps/web/src/components/ui/index.ts` for exact exports before using), Phosphor icons (`<i className="ph ph-…">`).
- Produces: `<HistoriaTab patientId={string} />`, `<RecordDocument consultationId={string} consultationStatus={string} />`. Visual reference: mockup screen 2 (`docs/superpowers/specs/2026-07-06-historia-medica-mockups.html`) — 2px teal rule on the selected consultation and on each section (`border-l-2 border-p-500`), amber draft bar, chips.

- [ ] **Step 1: Add strings**

In `apps/web/src/pages/PatientDetail/strings.ts` add to the exported object:

```typescript
  historiaListTitle: 'Expediente',
  historiaChipDraft: 'Borrador',
  historiaChipSigned: 'Firmada',
  historiaChipNone: 'Sin historia',
  historiaGenerate: 'Generar historia',
  historiaDraftBar: 'Borrador — editable hasta la firma',
  historiaEdit: 'Editar',
  historiaSave: 'Guardar cambios',
  historiaCancelEdit: 'Cancelar',
  historiaRegenerate: 'Regenerar',
  historiaRegenerateConfirm:
    'Regenerar descarta las ediciones y vuelve a derivar la historia del protocolo. ¿Continuar?',
  historiaSign: 'Firmar historia',
  historiaSignedBar: 'Historia firmada — solo lectura',
  historiaDownload: 'Descargar PDF',
  historiaEditedFlag: 'Editado',
  historiaKindFirstVisit: 'Primera consulta',
  historiaKindEvolution: 'Evolución',
  historiaEmpty: 'Selecciona una consulta para ver su historia médica.',
  historiaOnlySigned: 'La historia se genera al firmar la consulta.',
  historiaMissingSections: 'Completa las secciones requeridas antes de firmar.',
```

- [ ] **Step 2: Write the failing component tests**

`apps/web/src/pages/PatientDetail/__tests__/RecordDocument.test.tsx` (mirror the render harness used by the existing tests in this `__tests__` dir — QueryClientProvider wrapper, `vi.mock` of the hooks module):

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RecordDocument } from '../RecordDocument'
import * as recordHooks from '@/hooks/consultations/use-consultation-record'
import type { ConsultationRecordDto } from '@rezeta/shared'

vi.mock('@/hooks/consultations/use-consultation-record')

const draft: ConsultationRecordDto = {
  id: 'rec1',
  consultationId: 'c1',
  patientId: 'p1',
  versionNumber: 1,
  kind: 'evolution',
  status: 'draft',
  sections: [
    { key: 'ficha_identificacion', title: 'Ficha de identificación', content: 'María Peña', source: 'generated', required: false },
    { key: 'motivo_consulta', title: 'Motivo de consulta', content: 'Control.', source: 'generated', required: true },
    { key: 'examen_fisico', title: 'Examen físico', content: 'PA 148/92', source: 'edited', required: true },
  ],
  generatedAt: '2026-07-06T10:42:00Z',
  signedAt: null,
  signedBy: null,
  createdAt: '2026-07-06T10:42:00Z',
  updatedAt: '2026-07-06T10:42:00Z',
}

const mutationStub = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false } as never

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(recordHooks.useConsultationRecord).mockReturnValue({
    data: draft, isLoading: false, isSuccess: true,
  } as never)
  vi.mocked(recordHooks.useUpdateRecordSections).mockReturnValue(mutationStub)
  vi.mocked(recordHooks.useRegenerateRecord).mockReturnValue(mutationStub)
  vi.mocked(recordHooks.useSignRecord).mockReturnValue(mutationStub)
  vi.mocked(recordHooks.useEnsureRecord).mockReturnValue(mutationStub)
})

describe('RecordDocument', () => {
  it('renders sections with titles and the draft bar', () => {
    render(<RecordDocument consultationId="c1" consultationStatus="signed" />)
    expect(screen.getByText('Borrador — editable hasta la firma')).toBeInTheDocument()
    expect(screen.getByText('Motivo de consulta')).toBeInTheDocument()
    expect(screen.getByText('Control.')).toBeInTheDocument()
  })

  it('shows the edited flag on edited sections only', () => {
    render(<RecordDocument consultationId="c1" consultationStatus="signed" />)
    expect(screen.getAllByText('Editado')).toHaveLength(1)
  })

  it('switches to textareas in edit mode and hides ficha from editing', () => {
    render(<RecordDocument consultationId="c1" consultationStatus="signed" />)
    fireEvent.click(screen.getByRole('button', { name: /Editar/ }))
    expect(screen.getAllByRole('textbox').length).toBe(2) // motivo + examen, never ficha
  })

  it('renders read-only signed state with download action', () => {
    vi.mocked(recordHooks.useConsultationRecord).mockReturnValue({
      data: { ...draft, status: 'signed', signedAt: '2026-07-06T11:00:00Z' },
      isLoading: false,
      isSuccess: true,
    } as never)
    render(<RecordDocument consultationId="c1" consultationStatus="signed" />)
    expect(screen.getByText('Historia firmada — solo lectura')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Descargar PDF/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Firmar historia/ })).not.toBeInTheDocument()
  })

  it('offers "Generar historia" when no record exists yet', () => {
    vi.mocked(recordHooks.useConsultationRecord).mockReturnValue({
      data: null, isLoading: false, isSuccess: true,
    } as never)
    render(<RecordDocument consultationId="c1" consultationStatus="signed" />)
    expect(screen.getByRole('button', { name: /Generar historia/ })).toBeInTheDocument()
  })
})
```

`apps/web/src/pages/PatientDetail/__tests__/HistoriaTab.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HistoriaTab } from '../HistoriaTab'
import * as consultationHooks from '@/hooks/consultations/use-consultations'
import * as recordHooks from '@/hooks/consultations/use-consultation-record'

vi.mock('@/hooks/consultations/use-consultations')
vi.mock('@/hooks/consultations/use-consultation-record')

const consultations = [
  { id: 'c1', status: 'signed', startedAt: '2026-07-06T10:42:00Z', locationName: 'Centro Médico Naco', doctorName: 'Dra. Herrera', protocolUsages: [] },
  { id: 'c2', status: 'open', startedAt: '2026-07-05T09:00:00Z', locationName: 'Centro Médico Naco', doctorName: 'Dra. Herrera', protocolUsages: [] },
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(consultationHooks.usePatientConsultations).mockReturnValue({
    data: consultations, isLoading: false,
  } as never)
  vi.mocked(recordHooks.useConsultationRecord).mockReturnValue({
    data: null, isLoading: false, isSuccess: true,
  } as never)
  const stub = { mutate: vi.fn(), isPending: false } as never
  vi.mocked(recordHooks.useEnsureRecord).mockReturnValue(stub)
  vi.mocked(recordHooks.useUpdateRecordSections).mockReturnValue(stub)
  vi.mocked(recordHooks.useRegenerateRecord).mockReturnValue(stub)
  vi.mocked(recordHooks.useSignRecord).mockReturnValue(stub)
})

describe('HistoriaTab', () => {
  it('lists consultations with a status chip per row', () => {
    render(<HistoriaTab patientId="p1" />)
    expect(screen.getByText('Expediente')).toBeInTheDocument()
    // signed consultation without a record shows "Sin historia"
    expect(screen.getByText('Sin historia')).toBeInTheDocument()
  })

  it('selects the newest signed consultation by default and renders its document pane', () => {
    render(<HistoriaTab patientId="p1" />)
    expect(vi.mocked(recordHooks.useConsultationRecord)).toHaveBeenCalledWith('c1')
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter @rezeta/web test -- HistoriaTab RecordDocument`
Expected: FAIL — cannot find module

- [ ] **Step 4: Implement `RecordDocument`**

`apps/web/src/pages/PatientDetail/RecordDocument.tsx`:

```tsx
import { useState } from 'react'
import { Button, Spinner } from '@/components/ui'
import {
  useConsultationRecord,
  useEnsureRecord,
  useUpdateRecordSections,
  useRegenerateRecord,
  useSignRecord,
  downloadRecordPdf,
} from '@/hooks/consultations/use-consultation-record'
import type { RecordSection } from '@rezeta/shared'
import { patientDetailStrings as s } from './strings'

export interface RecordDocumentProps {
  consultationId: string
  consultationStatus: string
}

export function RecordDocument({ consultationId, consultationStatus }: RecordDocumentProps): JSX.Element {
  const { data: record, isLoading } = useConsultationRecord(consultationId)
  const ensure = useEnsureRecord()
  const update = useUpdateRecordSections(consultationId)
  const regenerate = useRegenerateRecord(consultationId)
  const signRecord = useSignRecord(consultationId)
  const [editing, setEditing] = useState(false)
  const [draftTexts, setDraftTexts] = useState<Record<string, string>>({})

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[200px]">
        <Spinner size="md" className="text-n-400" />
      </div>
    )
  }

  if (consultationStatus === 'open') {
    return <p className="text-[13px] text-n-500 p-5">{s.historiaOnlySigned}</p>
  }

  if (!record) {
    return (
      <div className="flex flex-col items-center justify-center h-[200px] gap-3">
        <p className="text-[13px] text-n-500">{s.historiaChipNone}</p>
        <Button variant="secondary" size="sm" onClick={() => ensure.mutate(consultationId)}>
          {s.historiaGenerate}
        </Button>
      </div>
    )
  }

  const isDraft = record.status === 'draft'
  const editableSections = record.sections.filter((sec) => sec.key !== 'ficha_identificacion')

  function startEdit(): void {
    setDraftTexts(Object.fromEntries(editableSections.map((sec) => [sec.key, sec.content])))
    setEditing(true)
  }

  function saveEdit(): void {
    update.mutate(
      {
        sections: editableSections
          .filter((sec) => draftTexts[sec.key] !== sec.content)
          .map((sec) => ({ key: sec.key, content: draftTexts[sec.key] ?? '' })),
      },
      { onSuccess: () => setEditing(false) },
    )
  }

  function confirmRegenerate(): void {
    if (window.confirm(s.historiaRegenerateConfirm)) regenerate.mutate()
  }

  return (
    <div>
      {isDraft ? (
        <div className="flex items-center gap-2 px-5 py-2 bg-warning-bg border-b border-warning-border">
          <span className="text-[12px] font-medium text-warning-text">{s.historiaDraftBar}</span>
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" size="sm" onClick={confirmRegenerate}>{s.historiaRegenerate}</Button>
            {editing ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>{s.historiaCancelEdit}</Button>
                <Button variant="secondary" size="sm" onClick={saveEdit} disabled={update.isPending}>{s.historiaSave}</Button>
              </>
            ) : (
              <Button variant="secondary" size="sm" onClick={startEdit}>{s.historiaEdit}</Button>
            )}
            <Button variant="primary" size="sm" onClick={() => signRecord.mutate()} disabled={editing || signRecord.isPending}>
              {s.historiaSign}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-5 py-2 bg-success-bg border-b border-success-border">
          <span className="text-[12px] font-medium text-success-text">{s.historiaSignedBar}</span>
          <div className="ml-auto">
            <Button variant="secondary" size="sm" onClick={() => void downloadRecordPdf(consultationId)}>
              <i className="ph ph-download-simple" /> {s.historiaDownload}
            </Button>
          </div>
        </div>
      )}

      <div className="p-5 max-w-[640px]">
        <div className="mb-4 pb-3 border-b border-n-200">
          <span className="font-mono text-[11px] uppercase tracking-[0.10em] text-n-400">
            {record.kind === 'first_visit' ? s.historiaKindFirstVisit : s.historiaKindEvolution}
            {' · v'}{record.versionNumber}
          </span>
        </div>

        {record.sections.map((section: RecordSection) => (
          <div key={section.key} className="mb-4 pl-3 border-l-2 border-p-500">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[11px] uppercase tracking-[0.10em] text-p-700">{section.title}</span>
              {section.source === 'edited' && (
                <span className="font-mono text-[9px] uppercase px-1 rounded-sm bg-p-50 border border-p-100 text-p-500">
                  {s.historiaEditedFlag}
                </span>
              )}
            </div>
            {editing && section.key !== 'ficha_identificacion' ? (
              <textarea
                className="w-full min-h-[80px] text-[13px] font-sans text-n-700 border border-n-200 rounded-sm p-2"
                value={draftTexts[section.key] ?? ''}
                onChange={(e) => setDraftTexts((prev) => ({ ...prev, [section.key]: e.target.value }))}
              />
            ) : (
              <p className="text-[13px] text-n-600 whitespace-pre-line m-0">{section.content}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

(If `@/components/ui` exports a `Textarea` component, use it instead of the raw `<textarea>` — check `apps/web/src/components/ui/index.ts` first.)

- [ ] **Step 5: Implement `HistoriaTab` and wire the tab**

`apps/web/src/pages/PatientDetail/HistoriaTab.tsx`:

```tsx
import { useState } from 'react'
import { Spinner } from '@/components/ui'
import { usePatientConsultations } from '@/hooks/consultations/use-consultations'
import { RecordDocument } from './RecordDocument'
import { patientDetailStrings as s } from './strings'

export function HistoriaTab({ patientId }: { patientId: string }): JSX.Element {
  const { data: consultations = [], isLoading } = usePatientConsultations(patientId)
  const signed = consultations.filter((c) => c.status === 'signed' || c.status === 'amended')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const activeId = selectedId ?? signed[0]?.id ?? null
  const active = consultations.find((c) => c.id === activeId) ?? null

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[200px]">
        <Spinner size="md" className="text-n-400" />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-[280px_1fr] min-h-[400px] -m-5">
      <div className="border-r border-n-200 bg-n-25">
        <div className="px-4 py-3 border-b border-n-100">
          <span className="font-mono text-[11px] uppercase tracking-[0.10em] text-n-400">
            {s.historiaListTitle}
          </span>
        </div>
        {consultations.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setSelectedId(c.id)}
            className={`block w-full text-left px-4 py-3 border-b border-n-100 border-l-2 ${
              c.id === activeId ? 'border-l-p-500 bg-n-0' : 'border-l-transparent'
            }`}
          >
            <div className="text-[13px] font-semibold text-n-800">
              {new Date(c.startedAt).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
            <div className="text-[12px] text-n-500">
              {c.locationName} · {c.doctorName}
            </div>
          </button>
        ))}
      </div>
      <div>
        {active ? (
          <HistoriaChipAndDocument consultationId={active.id} consultationStatus={active.status} />
        ) : (
          <p className="text-[13px] text-n-500 p-5">{s.historiaEmpty}</p>
        )}
      </div>
    </div>
  )
}

function HistoriaChipAndDocument(props: { consultationId: string; consultationStatus: string }): JSX.Element {
  return <RecordDocument {...props} />
}
```

Add the per-row status chip: inside the list button, render a chip derived from the record status. To avoid N queries, the row chip for the MVP is derived from the consultation status only (`open` → `s.historiaChipNone` in neutral); the document pane shows the authoritative record state. Add after the date div:

```tsx
            {c.status === 'open' && (
              <span className="inline-flex items-center h-[20px] px-2 rounded-full text-[11px] font-medium bg-n-50 border border-n-200 text-n-500">
                {s.historiaChipNone}
              </span>
            )}
```

In `apps/web/src/pages/PatientDetail/index.tsx`, replace the historia tab content:

```tsx
import { HistoriaTab } from './HistoriaTab'
// …
          <TabsContent value="historia">
            <HistoriaTab patientId={patient.id} />
          </TabsContent>
```

(`ClinicalHistory` remains used by other screens; do not delete it. If after this change nothing imports it, leave removal to a dead-code sweep — out of scope here.)

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter @rezeta/web test -- HistoriaTab RecordDocument`
Expected: PASS (7 tests)

Run: `pnpm --filter @rezeta/web test`
Expected: PASS (existing PatientDetail tests may need the new mock for `use-consultation-record` — update them if they render the historia tab)

- [ ] **Step 7: Commit**

```bash
git add apps/web
git commit -m "feat(web): historia medica tab in patient detail"
```

---

### Task 11: Post-sign panel — historia card

**Files:**
- Modify: `apps/web/src/pages/Consultation/PostSignPanel.tsx`
- Modify: `apps/web/src/pages/Consultation/strings.ts`
- Modify: `apps/web/src/pages/Consultation/__tests__/` (extend the existing PostSignPanel test file; create `PostSignPanel.test.tsx` if none exists)

**Interfaces:**
- Consumes: `RecordOutcome` (Task 1 — now part of `SignConsultationResponse`), `useEnsureRecord` (Task 9). `PostSignPanel` already receives `consultation`; add a `recordOutcome: RecordOutcome` prop passed from the sign call site in `apps/web/src/pages/Consultation/index.tsx` (same place `invoiceOutcome` comes from).

- [ ] **Step 1: Add strings**

In `apps/web/src/pages/Consultation/strings.ts`, extend `postSignPanelStrings`:

```typescript
  historiaHeading: 'Historia médica',
  historiaCreated: 'Borrador generado — revísala y fírmala en la ficha del paciente.',
  historiaFailed: 'No se pudo generar la historia médica.',
  historiaRetry: 'Generar historia',
  historiaOpen: 'Ver historia',
```

- [ ] **Step 2: Write the failing test**

Add to the PostSignPanel test file:

```typescript
  it('shows the historia card with a link to the patient historia tab when created', () => {
    renderPanel({ recordOutcome: { status: 'created', recordId: 'rec1' } })
    expect(screen.getByText('Historia médica')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Ver historia/ })).toHaveAttribute(
      'href',
      expect.stringContaining('/pacientes/'),
    )
  })

  it('offers a retry when the draft failed', () => {
    renderPanel({ recordOutcome: { status: 'failed' } })
    expect(screen.getByText('No se pudo generar la historia médica.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Generar historia/ })).toBeInTheDocument()
  })
```

(`renderPanel` = the existing helper for PostSignPanel tests extended with the new prop; wrap in `MemoryRouter` + QueryClientProvider as the existing tests do, and mock `@/hooks/consultations/use-consultation-record`.)

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter @rezeta/web test -- PostSignPanel`
Expected: FAIL — missing prop / card not rendered

- [ ] **Step 4: Implement**

In `PostSignPanel.tsx`, add the prop and card below `InvoiceCard`:

```tsx
export interface PostSignPanelProps {
  invoiceOutcome: InvoiceOutcome
  recordOutcome: RecordOutcome
  consultation: ConsultationWithDetails
}
```

```tsx
      <RecordCard recordOutcome={recordOutcome} consultation={consultation} />
```

```tsx
function RecordCard({
  recordOutcome,
  consultation,
}: {
  recordOutcome: RecordOutcome
  consultation: ConsultationWithDetails
}): JSX.Element {
  const ensure = useEnsureRecord()
  return (
    <div className="mt-4 flex items-center justify-between border-t border-n-100 pt-4">
      <div>
        <div className="text-[14px] font-semibold text-n-800">
          {postSignPanelStrings.historiaHeading}
        </div>
        <div className="text-[12px] text-n-500">
          {recordOutcome.status === 'created'
            ? postSignPanelStrings.historiaCreated
            : postSignPanelStrings.historiaFailed}
        </div>
      </div>
      {recordOutcome.status === 'created' ? (
        <Link to={`/pacientes/${consultation.patientId}`} className={navLinkClass}>
          {postSignPanelStrings.historiaOpen}
        </Link>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => ensure.mutate(consultation.id)} disabled={ensure.isPending}>
          {postSignPanelStrings.historiaRetry}
        </Button>
      )}
    </div>
  )
}
```

Update the call site in `apps/web/src/pages/Consultation/index.tsx` to pass `recordOutcome` from the `SignConsultationResponse` (same state that holds `invoiceOutcome`).

- [ ] **Step 5: Run tests, lint, typecheck**

Run: `pnpm --filter @rezeta/web test && pnpm lint && pnpm -r typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web
git commit -m "feat(web): historia medica card in post-sign panel"
```

---

### Task 12: Changelog + full verification

**Files:**
- Modify: `CHANGELOG.md` (prepend entry)

- [ ] **Step 1: Prepend the changelog entry**

```markdown
## [2026-07-06] Historia médica — registro por consulta (fase 1)

### Added

- `ConsultationRecord` model (`consultation_records`): historia médica versionada por consulta con secciones estructuradas (draft → signed, append-only).
- Mapper `generateRecordSections` en `@rezeta/shared`: deriva las secciones legales (Reglamento MISPAS 2023 §6.3) del contenido de protocolos, con distinción primera consulta / nota de evolución.
- Endpoints `GET/POST/PATCH /v1/consultations/:id/record`, `POST …/record/regenerate`, `POST …/record/sign`, `GET …/record/pdf` (PDF con PDFKit, streaming).
- El firmado de consulta genera el borrador automáticamente (`recordOutcome` en la respuesta).
- Pestaña «Historia» del detalle de paciente: lista de consultas + documento con editar/regenerar/firmar/descargar (`HistoriaTab`, `RecordDocument`).
- Tarjeta de historia médica en el panel post-firma de la consulta.

### Changed

- `SignConsultationResponse` ahora incluye `recordOutcome`.
- Nuevos códigos de error: `RECORD_NOT_FOUND`, `RECORD_NOT_DRAFT`, `RECORD_ALREADY_SIGNED`, `RECORD_REQUIRED_SECTIONS_MISSING`, `RECORD_CONSULTATION_NOT_SIGNED`.
```

- [ ] **Step 2: Run the full gates**

Run: `pnpm lint && pnpm -r typecheck && pnpm test`
Expected: PASS, zero failures

Run: `pnpm test:coverage`
Expected: PASS — ≥95% per-file on all new files. If a new file is short, extend its spec (e.g. cover `regenerate` fallback to `ensureDraft`, `downloadRecordPdf`, empty-state branches) rather than lowering thresholds.

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: changelog for historia medica phase 1"
```
