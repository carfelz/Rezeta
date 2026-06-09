# Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the consultation page (3-zone layout: header bar, main protocol panel, right-rail orders queue), remove the SOAP form, support new block types (`vitals`, `clinical_notes`) in the protocol editor, replace ProtocolType with ProtocolCategory in the Protocols list, and remove the consultation gate.

**Architecture:** React 18 + Vite. State managed with TanStack Query (server state) + Zustand (UI state). All UI must use tokens from `apps/web/src/index.css` via Tailwind classes — never raw hex or pixel values. Block types rendered by the existing `BlockRenderer` component, extended with two new block types.

**Tech Stack:** React + TypeScript + Tailwind CSS + Radix UI + TanStack Query + Zustand, pnpm monorepo

**Prerequisite:** Plans 01, 02, 03 complete — backend API updated and shared schemas exported.

**Design Reference:** Read `apps/web/src/index.css` and `design-system/reference.html` before making any visual decisions. Right-rail width: `w-80` (320px). Touch targets: `min-h-touch` (44px).

---

## File Map

| Action | File |
|---|---|
| Modify | `apps/web/src/pages/ProtocolEditor/block-factory.ts` |
| Create | `apps/web/src/components/protocols/blocks/VitalsBlock.tsx` |
| Create | `apps/web/src/components/protocols/blocks/ClinicalNotesBlock.tsx` |
| Modify | `apps/web/src/components/protocols/BlockRenderer.tsx` |
| Modify | `apps/web/src/pages/Protocols/index.tsx` (remove ProtocolType filter, add ProtocolCategory) |
| Modify | `apps/web/src/pages/NewConsultation.tsx` (remove protocol gate) |
| Modify | `apps/web/src/pages/Consultation/index.tsx` (3-zone layout) |
| Create | `apps/web/src/pages/Consultation/ProtocolPanel.tsx` |
| Create | `apps/web/src/pages/Consultation/OrdersRail.tsx` |
| Create | `apps/web/src/pages/Consultation/PrescriptionsTab.tsx` |
| Create | `apps/web/src/pages/Consultation/LabOrdersTab.tsx` |
| Create | `apps/web/src/pages/Consultation/ImagingOrdersTab.tsx` |
| Modify | `apps/web/src/pages/Consultation/PageHeader.tsx` |
| Create | `apps/web/src/hooks/useConsultationOrders.ts` |
| Modify | `apps/web/src/lib/api.ts` (or equivalent API client layer) |

---

## Task 1: Add vitals and clinical_notes blocks to the protocol editor

**Files:**
- Modify: `apps/web/src/pages/ProtocolEditor/block-factory.ts`
- Create: `apps/web/src/components/protocols/blocks/VitalsBlock.tsx`
- Create: `apps/web/src/components/protocols/blocks/ClinicalNotesBlock.tsx`
- Modify: `apps/web/src/components/protocols/BlockRenderer.tsx`

- [ ] **Step 1: Write failing test**

Create `apps/web/src/pages/ProtocolEditor/__tests__/block-factory.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { makeBlock, PALETTE_ITEMS } from '../block-factory.js'

describe('makeBlock', () => {
  it('creates a vitals block with default fields array', () => {
    const block = makeBlock('vitals')
    expect(block).not.toBeNull()
    expect(block!.type).toBe('vitals')
    expect((block as { fields: unknown[] }).fields).toBeInstanceOf(Array)
    expect((block as { fields: unknown[] }).fields.length).toBeGreaterThan(0)
  })

  it('creates a clinical_notes block with label and content', () => {
    const block = makeBlock('clinical_notes')
    expect(block).not.toBeNull()
    expect(block!.type).toBe('clinical_notes')
    expect((block as { label: string }).label).toBeDefined()
    expect((block as { content: string }).content).toBe('')
  })
})

describe('PALETTE_ITEMS', () => {
  it('includes vitals and clinical_notes', () => {
    const types = PALETTE_ITEMS.map((i) => i.type)
    expect(types).toContain('vitals')
    expect(types).toContain('clinical_notes')
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm --filter @rezeta/web test -- --testPathPattern block-factory
```

- [ ] **Step 3: Update block-factory.ts**

In `apps/web/src/pages/ProtocolEditor/block-factory.ts`:

Add to `PALETTE_ITEMS`:
```typescript
  { type: 'vitals', icon: 'ph-heartbeat', label: 'Signos vitales', active: true },
  { type: 'clinical_notes', icon: 'ph-note-pencil', label: 'Nota clínica', active: true },
```

Add to `makeBlock`:
```typescript
  if (type === 'vitals') {
    return {
      id: makeid(),
      type: 'vitals',
      fields: [
        { id: `fld_${crypto.randomUUID().slice(0, 8)}`, label: 'Presión arterial', unit: 'mmHg', input_type: 'text' },
        { id: `fld_${crypto.randomUUID().slice(0, 8)}`, label: 'Frecuencia cardíaca', unit: 'lpm', input_type: 'number' },
        { id: `fld_${crypto.randomUUID().slice(0, 8)}`, label: 'Temperatura', unit: '°C', input_type: 'number' },
        { id: `fld_${crypto.randomUUID().slice(0, 8)}`, label: 'Peso', unit: 'kg', input_type: 'number' },
        { id: `fld_${crypto.randomUUID().slice(0, 8)}`, label: 'Talla', unit: 'cm', input_type: 'number' },
      ],
    }
  }
  if (type === 'clinical_notes') {
    return {
      id: makeid(),
      type: 'clinical_notes',
      label: 'Nota clínica',
      required: false,
      content: '',
    }
  }
```

- [ ] **Step 4: Run — expect PASS**

```bash
pnpm --filter @rezeta/web test -- --testPathPattern block-factory
```

- [ ] **Step 5: Create VitalsBlock.tsx**

```tsx
// apps/web/src/components/protocols/blocks/VitalsBlock.tsx
import type { FC } from 'react'

type VitalsField = {
  id: string
  label: string
  unit?: string
  input_type: 'text' | 'number' | 'computed'
  formula?: string
}

type VitalsBlockProps = {
  fields: VitalsField[]
  values?: Record<string, string | number>
  readOnly?: boolean
  onChange?: (fieldId: string, value: string) => void
}

export const VitalsBlock: FC<VitalsBlockProps> = ({ fields, values = {}, readOnly, onChange }) => {
  return (
    <div className="grid grid-cols-2 gap-3">
      {fields.map((field) => (
        <div key={field.id} className="flex flex-col gap-1">
          <label className="text-xs font-mono text-n-500 uppercase tracking-wide">
            {field.label}
            {field.unit && <span className="ml-1 text-n-400">({field.unit})</span>}
          </label>
          {field.input_type === 'computed' ? (
            <div className="h-touch flex items-center px-3 bg-n-50 rounded-sm border border-n-200 text-n-600 font-mono text-sm">
              {values[field.id] ?? '—'}
            </div>
          ) : (
            <input
              type={field.input_type === 'number' ? 'number' : 'text'}
              className="h-touch px-3 rounded-sm border border-n-200 bg-white text-n-900 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-p-400 disabled:bg-n-50"
              value={String(values[field.id] ?? '')}
              disabled={readOnly}
              onChange={(e) => onChange?.(field.id, e.target.value)}
              placeholder="—"
            />
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 6: Create ClinicalNotesBlock.tsx**

```tsx
// apps/web/src/components/protocols/blocks/ClinicalNotesBlock.tsx
import type { FC } from 'react'

type ClinicalNotesBlockProps = {
  label: string
  content: string
  required?: boolean
  readOnly?: boolean
  onChange?: (content: string) => void
}

export const ClinicalNotesBlock: FC<ClinicalNotesBlockProps> = ({
  label,
  content,
  required,
  readOnly,
  onChange,
}) => {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        <span className="text-sm font-medium text-n-700">{label}</span>
        {required && <span className="text-xs text-red-500">*</span>}
      </div>
      <textarea
        className="w-full min-h-[120px] px-3 py-2 rounded-sm border border-n-200 bg-white text-n-900 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-p-400 disabled:bg-n-50"
        value={content}
        disabled={readOnly}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={readOnly ? '' : `Escribir ${label.toLowerCase()}…`}
      />
    </div>
  )
}
```

- [ ] **Step 7: Update BlockRenderer to handle new types**

Find `apps/web/src/components/protocols/BlockRenderer.tsx`. In the block type switch/dispatch, add:

```tsx
// Add import at top:
import { VitalsBlock } from './blocks/VitalsBlock.js'
import { ClinicalNotesBlock } from './blocks/ClinicalNotesBlock.js'

// In the render switch:
if (block.type === 'vitals') {
  return (
    <VitalsBlock
      fields={block.fields ?? []}
      values={block.values}
      readOnly={readOnly}
      onChange={(fieldId, value) => onBlockChange?.({ ...block, values: { ...block.values, [fieldId]: value } })}
    />
  )
}

if (block.type === 'clinical_notes') {
  return (
    <ClinicalNotesBlock
      label={block.label}
      content={block.content ?? ''}
      required={block.required}
      readOnly={readOnly}
      onChange={(content) => onBlockChange?.({ ...block, content })}
    />
  )
}
```

Also update the TypeScript `ProtocolBlock` union type to include `vitals` and `clinical_notes` variants. Find where `ProtocolBlock` is typed (likely in `BlockRenderer.tsx` or a types file) and add:

```typescript
| { id: string; type: 'vitals'; fields: Array<{ id: string; label: string; unit?: string; input_type: string; formula?: string }>; values?: Record<string, string | number>; conditional_rule?: unknown }
| { id: string; type: 'clinical_notes'; label: string; content: string; required?: boolean; conditional_rule?: unknown }
```

- [ ] **Step 8: Run typecheck**

```bash
pnpm typecheck
```

Fix any errors from new block types. Common: exhaustive switch missing the new cases, or `block.type` string not narrowed.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/pages/ProtocolEditor/block-factory.ts \
  apps/web/src/components/protocols/blocks/ \
  apps/web/src/components/protocols/BlockRenderer.tsx
git commit -m "feat(web): add vitals and clinical_notes block types to protocol editor"
```

---

## Task 2: Replace ProtocolType with ProtocolCategory in Protocols list

**Files:**
- Modify: `apps/web/src/pages/Protocols/index.tsx`
- Modify: any API hooks that fetch `protocol-types` → `protocol-categories`

- [ ] **Step 1: Write test**

Create `apps/web/src/pages/Protocols/__tests__/Protocols.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

// Mock TanStack Query and router
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn().mockReturnValue({ data: [], isLoading: false }),
  useMutation: vi.fn().mockReturnValue({ mutate: vi.fn() }),
}))

// The Protocols page should not reference "Tipo de protocolo" anywhere
import ProtocolsPage from '../index.js'

describe('Protocols page', () => {
  it('does not show "tipo" filter (ProtocolType removed)', () => {
    // @ts-expect-error — minimal render without full context
    render(<ProtocolsPage />)
    expect(screen.queryByText(/tipo de protocolo/i)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Update API hooks**

Find the hook or query that calls `GET /v1/protocol-types`. Replace with `GET /v1/protocol-categories`:

```typescript
// Before:
export function useProtocolTypes() {
  return useQuery({ queryKey: ['protocol-types'], queryFn: () => api.get('/v1/protocol-types') })
}

// After:
export function useProtocolCategories() {
  return useQuery({ queryKey: ['protocol-categories'], queryFn: () => api.get('/v1/protocol-categories') })
}
```

- [ ] **Step 3: Update Protocols page filter UI**

In `apps/web/src/pages/Protocols/index.tsx`:

Replace any `typeId` filter dropdown with a `categoryId` filter. The UI pattern stays the same — a dropdown list of categories instead of types. Key changes:

```tsx
// Replace:
const { data: types } = useProtocolTypes()
// Add:
const { data: categories } = useProtocolCategories()

// Replace filter URL param:
const [categoryId, setCategoryId] = useQueryParam('categoryId')
// (was: const [typeId, setTypeId] = useQueryParam('typeId'))

// In the filter UI, render category chips with their colors:
{categories?.map((cat) => (
  <button
    key={cat.id}
    onClick={() => setCategoryId(cat.id === categoryId ? undefined : cat.id)}
    className={cn(
      'inline-flex items-center gap-1.5 px-3 h-8 rounded-sm text-sm border transition-colors',
      categoryId === cat.id
        ? 'border-p-500 bg-p-50 text-p-700'
        : 'border-n-200 bg-white text-n-600 hover:border-n-300',
    )}
  >
    <span
      className="w-2 h-2 rounded-full"
      style={{ backgroundColor: cat.color }}
    />
    {cat.name}
  </button>
))}
```

Also update the protocol list item display — change `typeName` to `categoryName` in the list row rendering.

- [ ] **Step 4: Update Create Protocol dialog**

If there is a modal for creating a new protocol that has a `typeId` select dropdown, replace it with `categoryId`:

```tsx
// Replace:
<Select value={typeId} onValueChange={setTypeId}>
  {types.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
</Select>

// With:
<Select value={categoryId} onValueChange={setCategoryId}>
  <SelectItem value="">Sin categoría</SelectItem>
  {categories?.map((cat) => (
    <SelectItem key={cat.id} value={cat.id}>
      <span className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
        {cat.name}
      </span>
    </SelectItem>
  ))}
</Select>
```

- [ ] **Step 5: Run tests**

```bash
pnpm --filter @rezeta/web test -- --testPathPattern Protocols
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/Protocols/
git commit -m "feat(web): replace ProtocolType filter with ProtocolCategory in Protocols list"
```

---

## Task 3: Remove SOAP form from NewConsultation — eliminate protocol gate

**Files:**
- Modify: `apps/web/src/pages/NewConsultation.tsx`

The current `NewConsultation.tsx` likely shows a protocol picker as a required step before opening the consultation. This gate must be removed. The page becomes a simple 2-field form: patient + location.

- [ ] **Step 1: Write test**

Create `apps/web/src/pages/__tests__/NewConsultation.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('@tanstack/react-query', () => ({
  useMutation: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
  useQuery: vi.fn().mockReturnValue({ data: [], isLoading: false }),
}))

import NewConsultation from '../NewConsultation.js'

describe('NewConsultation', () => {
  it('does not show a protocol picker step', () => {
    render(<NewConsultation />)
    expect(screen.queryByText(/seleccionar protocolo/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/elegir protocolo/i)).not.toBeInTheDocument()
  })

  it('shows patient search and location fields', () => {
    render(<NewConsultation />)
    expect(screen.getByPlaceholderText(/buscar paciente/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — check current behavior**

```bash
pnpm --filter @rezeta/web test -- --testPathPattern NewConsultation
```

- [ ] **Step 3: Rewrite NewConsultation.tsx**

Replace the multi-step gate with a direct creation form:

```tsx
// apps/web/src/pages/NewConsultation.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api.js'
import { PatientSearch } from '@/components/patients/PatientSearch.js'
import { LocationSelect } from '@/components/locations/LocationSelect.js'
import { Button } from '@/components/ui/Button.js'

export default function NewConsultation() {
  const navigate = useNavigate()
  const [patientId, setPatientId] = useState<string | null>(null)
  const [locationId, setLocationId] = useState<string | null>(null)

  const { mutate: createConsultation, isPending } = useMutation({
    mutationFn: () =>
      api.post('/v1/consultations', { patientId, locationId }),
    onSuccess: (consultation) => {
      navigate(`/consultations/${consultation.id}`)
    },
  })

  return (
    <div className="max-w-lg mx-auto mt-12 p-6">
      <h1 className="text-2xl font-serif text-n-900 mb-6">Nueva consulta</h1>

      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-n-700 mb-1">Paciente</label>
          <PatientSearch onSelect={(id) => setPatientId(id)} />
        </div>

        <div>
          <label className="block text-sm font-medium text-n-700 mb-1">Sede</label>
          <LocationSelect value={locationId} onChange={setLocationId} />
        </div>

        <Button
          onClick={() => createConsultation()}
          disabled={!patientId || !locationId || isPending}
          className="mt-2"
        >
          {isPending ? 'Creando…' : 'Iniciar consulta'}
        </Button>
      </div>
    </div>
  )
}
```

Remove any protocol selection step, any `protocolId` state, and any multi-step wizard logic.

- [ ] **Step 4: Run — expect PASS**

```bash
pnpm --filter @rezeta/web test -- --testPathPattern NewConsultation
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/NewConsultation.tsx
git commit -m "feat(web): remove consultation gate — NewConsultation is now 2-field form"
```

---

## Task 4: Redesign Consultation page — 3-zone layout

**Files:**
- Modify: `apps/web/src/pages/Consultation/index.tsx`
- Modify: `apps/web/src/pages/Consultation/PageHeader.tsx`
- Create: `apps/web/src/pages/Consultation/ProtocolPanel.tsx`

The consultation view has three zones:
1. **Header bar** (always visible): patient name + age + allergy alerts, location, status + autosave, "Firmar y cerrar" button
2. **Main panel** (scrollable): protocol blocks; if no protocol active, shows "+" prompt
3. **Right rail** (always visible): "+ Agregar protocolo" button + orders panel (Tasks 5–6)

- [ ] **Step 1: Write test**

Create `apps/web/src/pages/Consultation/__tests__/Consultation.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

const mockConsultation = {
  id: 'c-1',
  status: 'open',
  patient: { firstName: 'Ana', lastName: 'García', dateOfBirth: '1985-03-15', allergies: ['Penicilina'] },
  location: { name: 'Clínica Norte' },
  protocolUsages: [],
  prescriptions: [],
  labOrders: [],
  imagingOrders: [],
}

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn().mockReturnValue({ data: mockConsultation, isLoading: false }),
  useMutation: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('react-router-dom', () => ({
  useParams: vi.fn().mockReturnValue({ id: 'c-1' }),
  useNavigate: vi.fn().mockReturnValue(vi.fn()),
}))

import ConsultationPage from '../index.js'

describe('ConsultationPage', () => {
  it('shows patient allergy alert in header', () => {
    render(<ConsultationPage />)
    expect(screen.getByText(/penicilina/i)).toBeInTheDocument()
  })

  it('shows "Firmar y cerrar" button when status is open', () => {
    render(<ConsultationPage />)
    expect(screen.getByRole('button', { name: /firmar y cerrar/i })).toBeInTheDocument()
  })

  it('shows "Agregar protocolo" in the right rail', () => {
    render(<ConsultationPage />)
    expect(screen.getByText(/agregar protocolo/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — check current state**

```bash
pnpm --filter @rezeta/web test -- --testPathPattern Consultation.test
```

- [ ] **Step 3: Rewrite Consultation/index.tsx with 3-zone layout**

```tsx
// apps/web/src/pages/Consultation/index.tsx
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api.js'
import { ConsultationPageHeader } from './PageHeader.js'
import { ProtocolPanel } from './ProtocolPanel.js'
import { OrdersRail } from './OrdersRail.js'

export default function ConsultationPage() {
  const { id } = useParams<{ id: string }>()

  const { data: consultation, isLoading } = useQuery({
    queryKey: ['consultation', id],
    queryFn: () => api.get(`/v1/consultations/${id}`),
    enabled: !!id,
  })

  if (isLoading || !consultation) {
    return (
      <div className="flex items-center justify-center h-screen text-n-500">Cargando consulta…</div>
    )
  }

  const isOpen = consultation.status === 'open'

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Zone 1: Header (always visible, never scrolls) */}
      <ConsultationPageHeader consultation={consultation} />

      {/* Zone 2 + 3: Main content + Right rail */}
      <div className="flex flex-1 overflow-hidden">
        {/* Zone 2: Main panel (scrollable) */}
        <main className="flex-1 overflow-y-auto p-6">
          <ProtocolPanel consultation={consultation} readOnly={!isOpen} />
        </main>

        {/* Zone 3: Right rail (always visible) */}
        <aside className="w-80 border-l border-n-200 flex flex-col overflow-hidden">
          <OrdersRail consultation={consultation} readOnly={!isOpen} />
        </aside>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Update PageHeader.tsx**

The header must always show patient allergy/condition alerts — never hidden. Update `PageHeader.tsx`:

```tsx
// apps/web/src/pages/Consultation/PageHeader.tsx
import type { FC } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api.js'
import { Button } from '@/components/ui/Button.js'
import { Badge } from '@/components/ui/Badge.js'
import { calculateAge } from '@/lib/utils.js'

type ConsultationHeaderProps = {
  consultation: {
    id: string
    status: string
    patient: {
      firstName: string
      lastName: string
      dateOfBirth: string
      allergies?: string[]
      chronicConditions?: string[]
    }
    location: { name: string }
  }
}

export const ConsultationPageHeader: FC<ConsultationHeaderProps> = ({ consultation }) => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { patient, location } = consultation
  const age = calculateAge(patient.dateOfBirth)

  const { mutate: sign, isPending } = useMutation({
    mutationFn: () => api.patch(`/v1/consultations/${consultation.id}/sign`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultation', consultation.id] })
      navigate(`/consultations/${consultation.id}/summary`)
    },
  })

  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-n-200 bg-white shrink-0">
      <div className="flex items-center gap-4">
        {/* Patient identity — always visible */}
        <div>
          <h1 className="text-base font-semibold text-n-900">
            {patient.firstName} {patient.lastName}
          </h1>
          <p className="text-sm text-n-500">{age} años · {location.name}</p>
        </div>

        {/* Allergy alerts — HARD REQUIREMENT: never hidden */}
        {patient.allergies && patient.allergies.length > 0 && (
          <div className="flex items-center gap-1">
            {patient.allergies.map((allergy) => (
              <Badge key={allergy} variant="danger" className="text-xs">
                <i className="ph ph-warning mr-1" />
                {allergy}
              </Badge>
            ))}
          </div>
        )}

        {/* Chronic condition flags */}
        {patient.chronicConditions && patient.chronicConditions.length > 0 && (
          <div className="flex items-center gap-1">
            {patient.chronicConditions.map((condition) => (
              <Badge key={condition} variant="warning" className="text-xs">
                {condition}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {consultation.status === 'open' && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => sign()}
            disabled={isPending}
          >
            {isPending ? 'Firmando…' : 'Firmar y cerrar'}
          </Button>
        )}
        {consultation.status === 'signed' && (
          <Badge variant="success">Firmada</Badge>
        )}
      </div>
    </header>
  )
}
```

- [ ] **Step 5: Create ProtocolPanel.tsx**

The main panel shows all active protocol usages inline, with a button to add more:

```tsx
// apps/web/src/pages/Consultation/ProtocolPanel.tsx
import { useState, type FC } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api.js'
import { BlockRenderer } from '@/components/protocols/BlockRenderer.js'
import { ProtocolPickerModal } from '@/components/protocols/ProtocolPickerModal.js'

type ProtocolUsage = {
  id: string
  protocol: { id: string; title: string }
  content: { blocks: unknown[] }
  status: string
}

type ProtocolPanelProps = {
  consultation: { id: string; protocolUsages: ProtocolUsage[] }
  readOnly: boolean
}

export const ProtocolPanel: FC<ProtocolPanelProps> = ({ consultation, readOnly }) => {
  const [pickerOpen, setPickerOpen] = useState(false)
  const queryClient = useQueryClient()

  const { mutate: addProtocol } = useMutation({
    mutationFn: (protocolId: string) =>
      api.post(`/v1/consultations/${consultation.id}/protocols`, { protocolId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultation', consultation.id] })
      setPickerOpen(false)
    },
  })

  const { mutate: updateUsage } = useMutation({
    mutationFn: ({ usageId, content }: { usageId: string; content: unknown }) =>
      api.patch(`/v1/consultations/${consultation.id}/protocols/${usageId}`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultation', consultation.id] })
    },
  })

  const activeUsages = consultation.protocolUsages.filter((u) => u.status !== 'abandoned')

  return (
    <div className="flex flex-col gap-6">
      {/* Protocol usages — stacked inline */}
      {activeUsages.map((usage) => (
        <section key={usage.id} className="border border-n-200 rounded-md overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-n-50 border-b border-n-200">
            <div className="flex items-center gap-2">
              <span className="w-0.5 h-5 rounded bg-p-500" />
              <h2 className="text-sm font-semibold text-n-800">{usage.protocol.title}</h2>
            </div>
          </div>
          <div className="p-4 flex flex-col gap-4">
            {(usage.content.blocks as unknown[]).map((block, i) => (
              <BlockRenderer
                key={i}
                block={block as Parameters<typeof BlockRenderer>[0]['block']}
                readOnly={readOnly}
                onBlockChange={(updatedBlock) => {
                  const newBlocks = [...usage.content.blocks]
                  newBlocks[i] = updatedBlock
                  updateUsage({ usageId: usage.id, content: { ...usage.content, blocks: newBlocks } })
                }}
              />
            ))}
          </div>
        </section>
      ))}

      {/* Add protocol button */}
      {!readOnly && (
        <button
          onClick={() => setPickerOpen(true)}
          className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-n-300 rounded-md text-n-500 hover:border-p-400 hover:text-p-600 transition-colors"
        >
          <i className="ph ph-plus-circle text-lg" />
          <span className="text-sm font-medium">Agregar protocolo</span>
        </button>
      )}

      {activeUsages.length === 0 && !readOnly && (
        <div className="text-center py-8 text-n-400 text-sm">
          No hay protocolos activos. Agrega uno o usa una nota libre.
        </div>
      )}

      <ProtocolPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(protocolId) => addProtocol(protocolId)}
      />
    </div>
  )
}
```

- [ ] **Step 6: Run tests**

```bash
pnpm --filter @rezeta/web test -- --testPathPattern Consultation
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/pages/Consultation/
git commit -m "feat(web): 3-zone consultation layout — header, protocol panel, right rail skeleton"
```

---

## Task 5: Build OrdersRail — right rail with 3 tabs

**Files:**
- Create: `apps/web/src/pages/Consultation/OrdersRail.tsx`
- Create: `apps/web/src/pages/Consultation/PrescriptionsTab.tsx`
- Create: `apps/web/src/pages/Consultation/LabOrdersTab.tsx`
- Create: `apps/web/src/pages/Consultation/ImagingOrdersTab.tsx`
- Create: `apps/web/src/hooks/useConsultationOrders.ts`

- [ ] **Step 1: Create orders hook**

```typescript
// apps/web/src/hooks/useConsultationOrders.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api.js'

export function useConsultationOrders(consultationId: string) {
  return useQuery({
    queryKey: ['consultation-orders', consultationId],
    queryFn: () => api.get(`/v1/consultations/${consultationId}/orders`),
    enabled: !!consultationId,
  })
}

export function useCreatePrescriptionGroup(consultationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (dto: unknown) => api.post(`/v1/consultations/${consultationId}/prescriptions`, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultation-orders', consultationId] })
      queryClient.invalidateQueries({ queryKey: ['consultation', consultationId] })
    },
  })
}

export function useCreateImagingOrderGroup(consultationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (dto: unknown) => api.post(`/v1/consultations/${consultationId}/imaging-orders`, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultation-orders', consultationId] })
    },
  })
}

export function useCreateLabOrderGroup(consultationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (dto: unknown) => api.post(`/v1/consultations/${consultationId}/lab-orders`, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultation-orders', consultationId] })
    },
  })
}

export function useDeleteOrderGroup(consultationId: string, type: 'prescriptions' | 'imaging-orders' | 'lab-orders') {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (orderId: string) => api.delete(`/v1/consultations/${consultationId}/${type}/${orderId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultation-orders', consultationId] })
    },
  })
}
```

- [ ] **Step 2: Create OrdersRail.tsx**

```tsx
// apps/web/src/pages/Consultation/OrdersRail.tsx
import { useState, type FC } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import { useConsultationOrders } from '@/hooks/useConsultationOrders.js'
import { PrescriptionsTab } from './PrescriptionsTab.js'
import { LabOrdersTab } from './LabOrdersTab.js'
import { ImagingOrdersTab } from './ImagingOrdersTab.js'
import { cn } from '@/lib/utils.js'

type OrdersRailProps = {
  consultation: { id: string; status: string }
  readOnly: boolean
}

export const OrdersRail: FC<OrdersRailProps> = ({ consultation, readOnly }) => {
  const { data: orders, isLoading } = useConsultationOrders(consultation.id)

  const prescriptionCount = orders?.prescriptions?.reduce(
    (acc: number, p: { prescriptionItems?: unknown[] }) => acc + (p.prescriptionItems?.length ?? 0),
    0,
  ) ?? 0
  const labCount = orders?.labOrders?.reduce(
    (acc: number, l: { items?: unknown[] }) => acc + (l.items?.length ?? 0),
    0,
  ) ?? 0
  const imagingCount = orders?.imagingOrders?.reduce(
    (acc: number, i: { items?: unknown[] }) => acc + (i.items?.length ?? 0),
    0,
  ) ?? 0

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-n-200 shrink-0">
        <h2 className="text-sm font-semibold text-n-700">Órdenes</h2>
      </div>

      <Tabs.Root defaultValue="prescriptions" className="flex flex-col flex-1 overflow-hidden">
        <Tabs.List className="flex border-b border-n-200 shrink-0">
          {[
            { value: 'prescriptions', label: 'Recetas', count: prescriptionCount },
            { value: 'lab', label: 'Lab', count: labCount },
            { value: 'imaging', label: 'Imagen', count: imagingCount },
          ].map((tab) => (
            <Tabs.Trigger
              key={tab.value}
              value={tab.value}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 px-2 py-2 text-xs font-medium border-b-2 transition-colors',
                'border-transparent text-n-500 hover:text-n-700',
                'data-[state=active]:border-p-500 data-[state=active]:text-p-700',
              )}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="w-4 h-4 rounded-full bg-p-100 text-p-700 text-[10px] flex items-center justify-center">
                  {tab.count}
                </span>
              )}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-sm text-n-400">Cargando órdenes…</div>
          ) : (
            <>
              <Tabs.Content value="prescriptions" className="p-3">
                <PrescriptionsTab
                  consultationId={consultation.id}
                  prescriptions={orders?.prescriptions ?? []}
                  readOnly={readOnly}
                />
              </Tabs.Content>
              <Tabs.Content value="lab" className="p-3">
                <LabOrdersTab
                  consultationId={consultation.id}
                  labOrders={orders?.labOrders ?? []}
                  readOnly={readOnly}
                />
              </Tabs.Content>
              <Tabs.Content value="imaging" className="p-3">
                <ImagingOrdersTab
                  consultationId={consultation.id}
                  imagingOrders={orders?.imagingOrders ?? []}
                  readOnly={readOnly}
                />
              </Tabs.Content>
            </>
          )}
        </div>
      </Tabs.Root>
    </div>
  )
}
```

- [ ] **Step 3: Create PrescriptionsTab.tsx**

```tsx
// apps/web/src/pages/Consultation/PrescriptionsTab.tsx
import { useState, type FC } from 'react'
import { useCreatePrescriptionGroup, useDeleteOrderGroup } from '@/hooks/useConsultationOrders.js'
import { Button } from '@/components/ui/Button.js'

type PrescriptionItem = { id: string; drug: string; dose: string; route: string; frequency: string; duration: string }
type Prescription = { id: string; groupTitle?: string | null; groupOrder: number; prescriptionItems: PrescriptionItem[] }

type PrescriptionsTabProps = {
  consultationId: string
  prescriptions: Prescription[]
  readOnly: boolean
}

export const PrescriptionsTab: FC<PrescriptionsTabProps> = ({ consultationId, prescriptions, readOnly }) => {
  const [showForm, setShowForm] = useState(false)
  const { mutate: createGroup, isPending } = useCreatePrescriptionGroup(consultationId)
  const { mutate: deleteGroup } = useDeleteOrderGroup(consultationId, 'prescriptions')

  const [newItem, setNewItem] = useState({ drug: '', dose: '', route: '', frequency: '', duration: '' })

  return (
    <div className="flex flex-col gap-3">
      {prescriptions.map((rx) => (
        <div key={rx.id} className="border border-n-200 rounded-sm p-3">
          {rx.groupTitle && (
            <div className="text-xs font-medium text-n-500 mb-2 uppercase tracking-wide">{rx.groupTitle}</div>
          )}
          {rx.prescriptionItems.map((item) => (
            <div key={item.id} className="text-sm text-n-800 py-1 border-b border-n-100 last:border-0">
              <span className="font-medium">{item.drug}</span>
              <span className="text-n-500 ml-1">{item.dose} · {item.route} · {item.frequency} · {item.duration}</span>
            </div>
          ))}
          {!readOnly && (
            <button
              onClick={() => deleteGroup(rx.id)}
              className="mt-2 text-xs text-red-400 hover:text-red-600"
            >
              Eliminar grupo
            </button>
          )}
        </div>
      ))}

      {!readOnly && !showForm && (
        <Button variant="ghost" size="sm" onClick={() => setShowForm(true)} className="w-full">
          <i className="ph ph-plus mr-1" /> Agregar receta
        </Button>
      )}

      {!readOnly && showForm && (
        <form
          className="border border-n-200 rounded-sm p-3 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            createGroup({
              groupOrder: prescriptions.length + 1,
              items: [{ ...newItem, source: 'manual' }],
            })
            setShowForm(false)
            setNewItem({ drug: '', dose: '', route: '', frequency: '', duration: '' })
          }}
        >
          {(['drug', 'dose', 'route', 'frequency', 'duration'] as const).map((field) => (
            <input
              key={field}
              className="h-8 px-2 text-sm border border-n-200 rounded-sm focus:outline-none focus:ring-1 focus:ring-p-400"
              placeholder={field === 'drug' ? 'Medicamento' : field === 'dose' ? 'Dosis' : field === 'route' ? 'Vía' : field === 'frequency' ? 'Frecuencia' : 'Duración'}
              value={newItem[field]}
              onChange={(e) => setNewItem((prev) => ({ ...prev, [field]: e.target.value }))}
              required
            />
          ))}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isPending}>Agregar</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </form>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create LabOrdersTab.tsx and ImagingOrdersTab.tsx**

Follow the same pattern as `PrescriptionsTab.tsx`. For `LabOrdersTab`, the add-form fields are: `testName`, `indication`, `urgency` (select: routine/urgent/stat), `fastingRequired` (checkbox), `sampleType` (select: blood/urine/stool/csf/other). For `ImagingOrdersTab`, fields are: `studyType`, `indication`, `urgency`, `contrast` (checkbox), `fastingRequired` (checkbox).

```tsx
// apps/web/src/pages/Consultation/LabOrdersTab.tsx
import { useState, type FC } from 'react'
import { useCreateLabOrderGroup, useDeleteOrderGroup } from '@/hooks/useConsultationOrders.js'
import { Button } from '@/components/ui/Button.js'

type LabItem = { id: string; testName: string; urgency: string; sampleType: string }
type LabOrder = { id: string; groupTitle?: string | null; items: LabItem[] }

type LabOrdersTabProps = {
  consultationId: string
  labOrders: LabOrder[]
  readOnly: boolean
}

export const LabOrdersTab: FC<LabOrdersTabProps> = ({ consultationId, labOrders, readOnly }) => {
  const [showForm, setShowForm] = useState(false)
  const { mutate: createGroup, isPending } = useCreateLabOrderGroup(consultationId)
  const { mutate: deleteGroup } = useDeleteOrderGroup(consultationId, 'lab-orders')

  const [newItem, setNewItem] = useState({ testName: '', indication: '', urgency: 'routine', fastingRequired: false, sampleType: 'blood' })

  return (
    <div className="flex flex-col gap-3">
      {labOrders.map((order) => (
        <div key={order.id} className="border border-n-200 rounded-sm p-3">
          {order.groupTitle && <div className="text-xs font-medium text-n-500 mb-2 uppercase">{order.groupTitle}</div>}
          {order.items.map((item) => (
            <div key={item.id} className="text-sm text-n-800 py-1 border-b border-n-100 last:border-0">
              <span className="font-medium">{item.testName}</span>
              {item.urgency !== 'routine' && (
                <span className="ml-1 text-xs font-bold text-orange-600 uppercase">{item.urgency}</span>
              )}
            </div>
          ))}
          {!readOnly && (
            <button onClick={() => deleteGroup(order.id)} className="mt-2 text-xs text-red-400 hover:text-red-600">
              Eliminar
            </button>
          )}
        </div>
      ))}

      {!readOnly && !showForm && (
        <Button variant="ghost" size="sm" onClick={() => setShowForm(true)} className="w-full">
          <i className="ph ph-plus mr-1" /> Agregar laboratorio
        </Button>
      )}

      {!readOnly && showForm && (
        <form
          className="border border-n-200 rounded-sm p-3 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            createGroup({ groupOrder: labOrders.length + 1, items: [{ ...newItem, source: 'manual' }] })
            setShowForm(false)
            setNewItem({ testName: '', indication: '', urgency: 'routine', fastingRequired: false, sampleType: 'blood' })
          }}
        >
          <input className="h-8 px-2 text-sm border border-n-200 rounded-sm focus:outline-none focus:ring-1 focus:ring-p-400" placeholder="Nombre del examen" value={newItem.testName} onChange={(e) => setNewItem((p) => ({ ...p, testName: e.target.value }))} required />
          <input className="h-8 px-2 text-sm border border-n-200 rounded-sm focus:outline-none focus:ring-1 focus:ring-p-400" placeholder="Indicación" value={newItem.indication} onChange={(e) => setNewItem((p) => ({ ...p, indication: e.target.value }))} required />
          <select className="h-8 px-2 text-sm border border-n-200 rounded-sm bg-white" value={newItem.urgency} onChange={(e) => setNewItem((p) => ({ ...p, urgency: e.target.value }))}>
            <option value="routine">Rutina</option>
            <option value="urgent">Urgente</option>
            <option value="stat">STAT</option>
          </select>
          <select className="h-8 px-2 text-sm border border-n-200 rounded-sm bg-white" value={newItem.sampleType} onChange={(e) => setNewItem((p) => ({ ...p, sampleType: e.target.value }))}>
            <option value="blood">Sangre</option>
            <option value="urine">Orina</option>
            <option value="stool">Heces</option>
            <option value="csf">LCR</option>
            <option value="other">Otro</option>
          </select>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isPending}>Agregar</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </form>
      )}
    </div>
  )
}
```

Create `ImagingOrdersTab.tsx` with the same pattern. Fields: `studyType`, `indication`, `urgency` (select), `contrast` (checkbox label "Con contraste"), `fastingRequired` (checkbox label "En ayunas").

- [ ] **Step 5: Run tests**

```bash
pnpm --filter @rezeta/web test -- --testPathPattern Consultation
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/Consultation/ apps/web/src/hooks/useConsultationOrders.ts
git commit -m "feat(web): orders right rail with 3 tabs — prescriptions, lab, imaging"
```

---

## Task 6: Full frontend integration + smoke test

- [ ] **Step 1: Start dev server**

```bash
pnpm dev
```

- [ ] **Step 2: Manual smoke test golden path**

1. Navigate to **Nueva Consulta** — verify no protocol picker step appears
2. Create a walk-in consultation (patient + location only)
3. Inside consultation — verify 3-zone layout renders (header, main, right rail)
4. Verify patient allergy alerts appear in header (if patient has allergies)
5. Click **Agregar protocolo** in right rail — verify protocol picker modal opens
6. Select a protocol — verify protocol blocks render in main panel
7. Fill vitals block fields — verify values save
8. Write a clinical_notes block — verify text saves
9. Add a prescription in right rail — verify it appears in Recetas tab
10. Click **Firmar y cerrar** — verify consultation moves to signed state
11. Navigate to **Protocolos** — verify ProtocolCategory chips appear (not ProtocolType)
12. Open the Protocol Editor — verify vitals and clinical_notes appear in the block palette

- [ ] **Step 3: Run full test suite**

```bash
pnpm test
```

Expected: All pass.

- [ ] **Step 4: Run typecheck + lint**

```bash
pnpm typecheck && pnpm lint
```

Expected: 0 errors.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(web): complete frontend redesign — consultation 3-zone, new blocks, category filter"
```

---

## Self-Review

**Spec coverage check:**
- [x] Protocol editor palette includes `vitals` and `clinical_notes` block types
- [x] `VitalsBlock` renders configurable fields with labels, units, and input types
- [x] `ClinicalNotesBlock` renders labeled textarea (not SOAP-specific)
- [x] Protocols list shows ProtocolCategory chips with color dots (not ProtocolType)
- [x] NewConsultation has no protocol gate — patient + location only
- [x] Consultation page: header bar always visible with allergy alerts
- [x] Consultation page: "Firmar y cerrar" button in header
- [x] Consultation page: "+ Agregar protocolo" in main panel
- [x] Consultation page: right rail with Recetas / Laboratorio / Imágenes tabs
- [x] Prescriptions tab: shows items, supports manual add
- [x] Lab orders tab: shows items, supports manual add with urgency + sample type
- [x] Imaging orders tab: shows items, supports manual add with contrast + fasting
- [x] Sign action calls `PATCH /v1/consultations/:id/sign`

**Type consistency:** `ProtocolBlock` union type includes `vitals` and `clinical_notes`. All components use `consultationId` (not `consultation_id`) when calling hooks.
