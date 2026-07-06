# Historia Médica — Phase 3: Expediente Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One-click export of a patient's full expediente — all signed historias compiled into a single PDF with a cover page — satisfying the patient-copy right (Ley 42-01 art. 28 / Reglamento §7.1.7).

**Architecture:** A single streaming endpoint on the patients module (`GET /v1/patients/:id/record-export`) loads all signed `ConsultationRecord`s for the patient (tenant-scoped, newest-first), and a new `generateExpediente` PDFKit builder renders cover page + one historia per section, reusing the phase-1 historia layout. Synchronous, like every other PDF endpoint.

**Tech Stack:** NestJS, PDFKit, React, Vitest. No schema changes.

**Spec:** `docs/superpowers/specs/2026-07-06-historia-medica-design.md` §7.7 · Mockup screen 2 ("Exportar expediente" button).

**Prerequisite:** Phase 1 plan (`2026-07-06-01-historia-core.md`) fully merged. Independent of phase 2.

## Global Constraints

Same as phase 1 (see `2026-07-06-01-historia-core.md`): tenant filtering everywhere, Spanish strings colocated, token-only Tailwind, no TODOs, lower-case commit subjects, per-task green gates, 95% per-file coverage at the end.

---

### Task 1: PDF — `generateExpediente`

**Files:**
- Modify: `apps/api/src/lib/pdf.service.ts`
- Test: `apps/api/src/lib/__tests__/pdf.service.expediente.spec.ts`

**Interfaces:**
- Consumes: `HistoriaMedicaPdfData` (phase 1 Task 8), the `buildHistoriaMedica` builder, `toBuffer`, layout constants, palette `T`.
- Produces:

```typescript
export interface ExpedientePdfData {
  patient: { firstName: string; lastName: string; dateOfBirth: string | null; documentNumber: string | null; documentType: string | null }
  doctor: { fullName: string | null; specialty: string | null; licenseNumber: string | null }
  generatedAt: string
  entries: Array<Omit<HistoriaMedicaPdfData, 'patient' | 'doctor'>> // newest-first
}
generateExpediente(data: ExpedientePdfData): Promise<Buffer>
```

- [ ] **Step 1: Write the failing smoke test**

`apps/api/src/lib/__tests__/pdf.service.expediente.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { PdfService } from '../pdf.service.js'
import type { ExpedientePdfData } from '../pdf.service.js'

const entry = {
  record: {
    kind: 'evolution' as const,
    status: 'signed' as const,
    versionNumber: 1,
    generatedAt: '2026-07-06T10:42:00Z',
    signedAt: '2026-07-06T11:00:00Z',
    sections: [
      { key: 'motivo_consulta' as const, title: 'Motivo de consulta', content: 'Control.', source: 'generated' as const, required: true },
    ],
  },
  location: { name: 'Centro Médico Naco', address: null },
  startedAt: '2026-07-06T10:42:00Z',
}

const data: ExpedientePdfData = {
  patient: { firstName: 'María', lastName: 'Peña', dateOfBirth: '1972-03-15', documentNumber: '001-1234567-8', documentType: 'cedula' },
  doctor: { fullName: 'Ana Herrera', specialty: 'Cardiología', licenseNumber: '145-23' },
  generatedAt: '2026-07-06T12:00:00Z',
  entries: [entry, { ...entry, startedAt: '2026-05-22T09:00:00Z' }],
}

describe('generateExpediente', () => {
  it('renders a multi-consultation pdf with a cover page', async () => {
    const pdf = new PdfService()
    const buffer = await pdf.generateExpediente(data)
    expect(buffer.length).toBeGreaterThan(1500)
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-')
  })

  it('renders an empty expediente (zero entries) without throwing', async () => {
    const pdf = new PdfService()
    const buffer = await pdf.generateExpediente({ ...data, entries: [] })
    expect(buffer.length).toBeGreaterThan(500)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @rezeta/api test -- pdf.service.expediente`
Expected: FAIL — `generateExpediente is not a function`

- [ ] **Step 3: Implement**

In `pdf.service.ts` add the interface (as above) and:

```typescript
function buildExpedienteCover(doc: PDFKit.PDFDocument, data: ExpedientePdfData): void {
  const patientFullName = `${data.patient.firstName} ${data.patient.lastName}`.trim()
  const docId = data.patient.documentNumber
    ? `${(data.patient.documentType ?? 'Doc.').toUpperCase()} ${data.patient.documentNumber}`
    : null

  doc.font('Helvetica-Bold').fontSize(20).fillColor(T.teal)
  doc.text('Expediente clínico', MARGIN, MARGIN + 120)
  doc.moveDown(0.5)
  doc.font('Helvetica-Bold').fontSize(14).fillColor(T.n900)
  doc.text(patientFullName)
  doc.font('Helvetica').fontSize(10).fillColor(T.n600)
  const meta = [calcAge(data.patient.dateOfBirth), docId].filter(Boolean).join('  ·  ')
  if (meta) doc.text(meta)
  doc.moveDown(1)
  doc.fontSize(9).fillColor(T.n500)
  doc.text(`Médico tratante: Dr. ${data.doctor.fullName ?? ''}${data.doctor.specialty ? ` · ${data.doctor.specialty}` : ''}`)
  if (data.doctor.licenseNumber) doc.text(`Exequátur: ${data.doctor.licenseNumber}`)
  doc.text(`Consultas incluidas: ${data.entries.length}`)
  doc.text(`Generado: ${formatDate(data.generatedAt)}`)
  doc.moveDown(1)
  doc.fontSize(8).fillColor(T.n400)
  doc.text(
    'Copia fiel del expediente clínico emitida a solicitud del paciente (Ley General de Salud 42-01, art. 28).',
    { width: CONTENT_W },
  )
}

// on the PdfService class:
  generateExpediente(data: ExpedientePdfData): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'LETTER', margin: MARGIN })
    buildExpedienteCover(doc, data)
    for (const entry of data.entries) {
      doc.addPage()
      buildHistoriaMedica(doc, { ...entry, patient: data.patient, doctor: data.doctor })
    }
    return toBuffer(doc)
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @rezeta/api test -- pdf.service`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat(api): expediente pdf generator with cover page"
```

---

### Task 2: API — export endpoint

**Files:**
- Modify: `apps/api/src/modules/consultation-records/consultation-records.service.ts` (add `getExpedienteData`)
- Modify: `apps/api/src/modules/patients/patients.controller.ts` (add the route)
- Modify: `apps/api/src/modules/patients/patients.module.ts` (import `ConsultationRecordsModule`, provide `PdfService` if not already)
- Test: extend `consultation-records.service.spec.ts` and `patients.controller` spec

**Interfaces:**
- Consumes: `ConsultationRecordsRepository`, `PrismaService`, `generateExpediente` (Task 1).
- Produces:

```typescript
// ConsultationRecordsService
getExpedienteData(patientId: string, tenantId: string): Promise<ExpedientePdfData>
// throws PATIENT_NOT_FOUND if the patient is missing/deleted; entries [] is a valid result
// Route: GET /v1/patients/:id/record-export → application/pdf stream
```

- [ ] **Step 1: Write the failing service test**

Add to `consultation-records.service.spec.ts` (extend `mockPrisma` with `patient: { findFirst: vi.fn() }` and `consultationRecord: { findMany: vi.fn() }`):

```typescript
describe('getExpedienteData', () => {
  it('collects signed records newest-first with their consultation context', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue({
      id: 'p1',
      firstName: 'María',
      lastName: 'Peña',
      dateOfBirth: new Date('1972-03-15'),
      documentType: 'cedula',
      documentNumber: '001-1234567-8',
      owner: { fullName: 'Ana Herrera', specialty: 'Cardiología', licenseNumber: '145-23' },
    })
    mockPrisma.consultationRecord.findMany.mockResolvedValue([
      {
        ...makeRecordRowForExport('rec2', '2026-07-06T10:42:00Z'),
        consultation: { startedAt: new Date('2026-07-06T10:42:00Z'), location: { name: 'Naco', address: null } },
      },
      {
        ...makeRecordRowForExport('rec1', '2026-05-22T09:00:00Z'),
        consultation: { startedAt: new Date('2026-05-22T09:00:00Z'), location: { name: 'Naco', address: null } },
      },
    ])
    const data = await svc.getExpedienteData('p1', 't1')
    expect(mockPrisma.consultationRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 't1', patientId: 'p1', status: 'signed', deletedAt: null }),
      }),
    )
    expect(data.entries).toHaveLength(2)
    expect(data.patient.firstName).toBe('María')
    expect(data.doctor.fullName).toBe('Ana Herrera')
  })

  it('throws PATIENT_NOT_FOUND for a missing patient', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue(null)
    await expect(svc.getExpedienteData('p1', 't1')).rejects.toMatchObject({
      response: { code: 'PATIENT_NOT_FOUND' },
    })
  })
})
```

with the row helper:

```typescript
function makeRecordRowForExport(id: string, signedAt: string) {
  return {
    id,
    consultationId: 'c-' + id,
    patientId: 'p1',
    versionNumber: 1,
    kind: 'evolution',
    status: 'signed',
    sections: [],
    generatedAt: new Date(signedAt),
    signedAt: new Date(signedAt),
    signedBy: 'u1',
    createdAt: new Date(signedAt),
    updatedAt: new Date(signedAt),
    deletedAt: null,
  }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @rezeta/api test -- consultation-records.service`
Expected: FAIL — `getExpedienteData is not a function`

- [ ] **Step 3: Implement the service method**

In `consultation-records.service.ts`:

```typescript
  async getExpedienteData(patientId: string, tenantId: string): Promise<ExpedientePdfData> {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, tenantId, deletedAt: null },
      include: { owner: true },
    })
    if (!patient) {
      throw new NotFoundException({
        code: ErrorCode.PATIENT_NOT_FOUND,
        message: 'Patient not found',
      })
    }
    const rows = await this.prisma.consultationRecord.findMany({
      where: { tenantId, patientId, status: 'signed', deletedAt: null },
      orderBy: { signedAt: 'desc' },
      include: { consultation: { include: { location: true } } },
    })
    // Only the latest signed version per consultation (append-only versions).
    const latestByConsultation = new Map<string, (typeof rows)[number]>()
    for (const row of rows) {
      const existing = latestByConsultation.get(row.consultationId)
      if (!existing || row.versionNumber > existing.versionNumber) {
        latestByConsultation.set(row.consultationId, row)
      }
    }
    return {
      patient: {
        firstName: patient.firstName,
        lastName: patient.lastName,
        dateOfBirth: patient.dateOfBirth ? patient.dateOfBirth.toISOString() : null,
        documentNumber: patient.documentNumber,
        documentType: patient.documentType,
      },
      doctor: {
        fullName: patient.owner.fullName,
        specialty: patient.owner.specialty,
        licenseNumber: patient.owner.licenseNumber,
      },
      generatedAt: new Date().toISOString(),
      entries: [...latestByConsultation.values()].map((row) => ({
        record: {
          kind: row.kind as ConsultationRecordKind,
          status: 'signed' as const,
          versionNumber: row.versionNumber,
          generatedAt: row.generatedAt.toISOString(),
          signedAt: row.signedAt?.toISOString() ?? null,
          sections: row.sections as RecordSection[],
        },
        location: row.consultation.location
          ? { name: row.consultation.location.name, address: row.consultation.location.address }
          : null,
        startedAt: row.consultation.startedAt.toISOString(),
      })),
    }
  }
```

(import `ExpedientePdfData` from `../../lib/pdf.service.js`; verify the `location` relation name on `Consultation` in `schema.prisma`.)

- [ ] **Step 4: Add the controller route**

In `patients.controller.ts` (mirror the existing decorator conventions of that controller; `import type { Response } from 'express'`):

```typescript
  @Get(':id/record-export')
  async recordExport(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const data = await this.recordsSvc.getExpedienteData(id, tenantId)
    const buffer = await this.pdf.generateExpediente(data)
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="expediente-${id}.pdf"`,
    })
    res.send(buffer)
  }
```

Inject `ConsultationRecordsService` and `PdfService` into `PatientsController`'s constructor; add `ConsultationRecordsModule` to `PatientsModule` imports (it exports the service) and `PdfService` to its providers if not present. Add a controller spec case asserting delegation (mock both services, assert `res.set` called with `application/pdf`).

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @rezeta/api test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api
git commit -m "feat(api): patient expediente export endpoint"
```

---

### Task 3: Frontend — export button

**Files:**
- Modify: `apps/web/src/hooks/consultations/use-consultation-record.ts` (add `downloadExpediente`)
- Modify: `apps/web/src/pages/PatientDetail/HistoriaTab.tsx` (button in the list header)
- Modify: `apps/web/src/pages/PatientDetail/strings.ts`
- Test: extend `apps/web/src/pages/PatientDetail/__tests__/HistoriaTab.test.tsx`

**Interfaces:**
- Consumes: `apiClient.download`, `triggerDownload` (phase 1); `HistoriaTab` list header (phase 1 Task 10).
- Produces: `downloadExpediente(patientId: string): Promise<void>`.

- [ ] **Step 1: Add the string**

In `apps/web/src/pages/PatientDetail/strings.ts`:

```typescript
  historiaExport: 'Exportar expediente',
```

- [ ] **Step 2: Write the failing test**

Add to `HistoriaTab.test.tsx`:

```typescript
  it('renders the expediente export button and triggers the download', () => {
    const spy = vi.spyOn(recordHooks, 'downloadExpediente').mockResolvedValue()
    render(<HistoriaTab patientId="p1" />)
    fireEvent.click(screen.getByRole('button', { name: /Exportar expediente/ }))
    expect(spy).toHaveBeenCalledWith('p1')
  })
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @rezeta/web test -- HistoriaTab`
Expected: FAIL — `downloadExpediente` does not exist

- [ ] **Step 4: Implement**

In `use-consultation-record.ts`:

```typescript
export async function downloadExpediente(patientId: string): Promise<void> {
  const blob = await apiClient.download(`/v1/patients/${patientId}/record-export`)
  triggerDownload(blob, `expediente-${patientId}.pdf`)
}
```

In `HistoriaTab.tsx`, replace the list header contents with title + button (per mockup):

```tsx
        <div className="flex items-center justify-between px-4 py-3 border-b border-n-100">
          <span className="font-mono text-[11px] uppercase tracking-[0.10em] text-n-400">
            {s.historiaListTitle}
          </span>
          <Button variant="secondary" size="sm" onClick={() => void downloadExpediente(patientId)}>
            <i className="ph ph-download-simple" /> {s.historiaExport}
          </Button>
        </div>
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @rezeta/web test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web
git commit -m "feat(web): expediente export button in historia tab"
```

---

### Task 4: Changelog + full verification

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Prepend the changelog entry**

```markdown
## [YYYY-MM-DD] Historia médica — exportación del expediente (fase 3)

### Added

- `GET /v1/patients/:id/record-export`: expediente completo del paciente en un solo PDF (portada + historias firmadas, la versión más reciente por consulta, orden descendente) — derecho de copia del paciente (Ley 42-01 art. 28).
- `generateExpediente` en `PdfService` (portada con paciente, médico tratante, conteo de consultas y fecha de emisión).
- Botón «Exportar expediente» en la pestaña Historia del detalle de paciente.
```

(replace `YYYY-MM-DD` with the actual completion date)

- [ ] **Step 2: Run the full gates**

Run: `pnpm lint && pnpm -r typecheck && pnpm test && pnpm test:coverage`
Expected: PASS, ≥95% per-file

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: changelog for historia medica phase 3"
```
