# Historia médica (consultation record) — Design

> Status: APPROVED-PENDING-REVIEW · Date: 2026-07-06 · Author: Carlos Feliz (with Claude)
> New feature: generate the legally required DR "historia clínica" document from the protocol
> content of each consultation, with a doctor-editable draft, a separate sign step, and a
> patient-level expediente export.
> UI mockups: `docs/superpowers/specs/2026-07-06-historia-medica-mockups.html` (open in browser).

## 1. Problem

DR law requires doctors to produce a written record for every consultation. Rezeta captures all
clinical content in `ProtocolUsage` blocks but produces no historia document — only order PDFs
(prescriptions, lab, imaging). Doctors currently have nothing to print/hand over as the historia
clínica, and patients have a statutory right to a copy of their record.

## 2. Legal grounding (research summary)

Source: **Reglamento Técnico para la Gestión del Expediente Clínico** (MISPAS, 2ª ed. 2023,
Resolución 0013-2023) — applies to solo private specialists; chapter 8 legalizes electronic records.

- **First encounter (§6.3.1):** ficha de identificación, motivo de consulta, anamnesis
  (antecedentes familiares/personales/quirúrgicos/patológicos), examen físico (incl. vitals),
  prior study results, diagnósticos presuntivos/definitivos, plan de tratamiento.
- **Every subsequent visit — nota de evolución (§6.3.4):** date + **hour**, evolution of the
  clinical picture, vitals, study results, diagnoses, treatment — meds with minimum
  **dose/route/frequency** — signed with the physician's full name.
- **Electronic records must be append-only** (§8.14.g): no deletes/edits of signed data, full
  version history. Audit trail required (§8.14.h–i). Print-on-demand of any record required.
- **Patient copy right (§7.1.7, Ley 42-01 art. 28):** patient may demand a full faithful copy of
  their record → legal basis for the expediente export.
- Flags acknowledged but **out of scope** here: CIE/ICD coding of definitive diagnoses (§6.12.4,
  conflicts with our no-ICD convention — future product decision); INDOTEL digital-signature
  certificate (§8.14.k — our sign step is an application-level signature for now); MISPAS
  notification of electronic-record use (§8.9 — operational, not code).

## 3. Decisions (locked)

1. **Scope:** per-consultation historia with **first-visit vs. evolution distinction**, plus a
   **patient-level expediente export**.
2. **Editability:** the generated historia is a **fully editable draft**. Flow: consultation is
   signed → draft historia is generated → doctor reads/edits it → doctor **signs the historia**
   (separate action) → read-only forever.
3. **Draft shape:** **structured sections, editable text per section.** Legally required sections
   are always present and cannot be removed; the doctor edits text inside sections.
4. **Generation approach (B):** fixed legal section skeleton + deterministic block→section
   mapper by block type, with **optional per-protocol mapping overrides** (phase 2) stored inside
   the protocol content JSON (`historia_mapping`) so they version and snapshot automatically.
5. **Versioning:** one historia per consultation, append-only versions. Post-amendment, the doctor
   can generate a **new version** whose draft includes an "Enmiendas" section; prior versions stay.
6. **Plan meds/studies come from the actual signed `Prescription`/`LabOrder`/`ImagingOrder`
   records**, not from raw `dosage_table`/order blocks — only what was actually ordered appears,
   with the legal dose/route/frequency minimum.

## 4. Data model

`packages/db/prisma/schema.prisma` — new model:

```prisma
model ConsultationRecord {
  id             String    @id @default(uuid()) @db.Uuid
  tenantId       String    @map("tenant_id") @db.Uuid
  consultationId String    @map("consultation_id") @db.Uuid
  patientId      String    @map("patient_id") @db.Uuid      // denormalized for export queries
  versionNumber  Int       @map("version_number")           // append-only, starts at 1
  kind           String    // 'first_visit' | 'evolution'
  status         String    // 'draft' | 'signed'
  sections       Json      // ordered RecordSection[]
  generatedAt    DateTime  @map("generated_at")
  signedAt       DateTime? @map("signed_at")
  signedBy       String?   @map("signed_by") @db.Uuid
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")
  deletedAt      DateTime? @map("deleted_at")

  consultation Consultation @relation(fields: [consultationId], references: [id])
  @@unique([consultationId, versionNumber])
  @@index([tenantId, patientId])
  @@map("consultation_records")
}
```

`RecordSection` (Zod in `packages/shared/src/schemas/`):

```typescript
{
  key: RecordSectionKey,          // closed enum, see §5
  title: string,                  // Spanish display title
  content: string,                // plain text (newlines allowed)
  source: 'generated' | 'edited', // edited = doctor touched it after generation
  required: boolean,              // per kind, see §5
}
```

- **Immutability:** while `status === 'draft'`, section content is editable and the draft can be
  regenerated (discarding edits). Once `status === 'signed'`, the record is frozen — the repo
  layer rejects updates (mirrors the consultation model, satisfies §8.14.g).
- **First-visit detection at generation time:** `kind = 'first_visit'` iff the patient has no
  prior **signed** consultation in the tenant (by `startedAt`).
- All mutations audit-logged (create, edit, regenerate, sign, export) like every other module.

## 5. Section skeleton (fixed, DR §6.3)

`RecordSectionKey` closed enum in `packages/shared`:

| key                    | Title (ES)               | first_visit | evolution |
| ---------------------- | ------------------------ | ----------- | --------- |
| `ficha_identificacion` | Ficha de identificación  | auto        | auto      |
| `motivo_consulta`      | Motivo de consulta       | required    | required  |
| `antecedentes`         | Antecedentes             | required    | optional  |
| `enfermedad_actual`    | Enfermedad actual        | optional    | —         |
| `examen_fisico`        | Examen físico            | required    | required  |
| `evolucion`            | Evolución                | —           | required  |
| `resultados_estudios`  | Resultados de estudios   | optional    | optional  |
| `diagnosticos`         | Diagnósticos             | required    | required  |
| `plan_tratamiento`     | Plan de tratamiento      | required    | required  |
| `enmiendas`            | Enmiendas                | only on post-amendment versions | idem |

- `ficha_identificacion` is auto-filled from the patient record (name, age, sex, cédula/document,
  ARS) and regenerated fresh each time; it is **not** doctor-editable (data corrections belong in
  the patient record).
- **Signing the historia validates that all `required` sections are non-empty** (nota de
  evolución legal minimum). Optional empty sections are omitted from the rendered document/PDF.
- Rendered footer (not a section): doctor full name, specialty, exequátur/license, date + hour
  (§6.1.9).

## 6. Generation — block → section mapper

Pure function in `packages/shared` (no I/O; heavily unit-tested):
`generateRecordSections(input: { kind, patient, protocolUsages, prescriptions, labOrders, imagingOrders, amendments }): RecordSection[]`

Default mapping by block type over each `ProtocolUsage.content.blocks` (recursing into `section`
blocks):

| Block type                       | Destination                                                        |
| -------------------------------- | ------------------------------------------------------------------ |
| `vitals`                          | `examen_fisico` — formatted line "PA 140/90 mmHg · FC 78 lpm · …" from `values` |
| `clinical_notes`                  | matched by normalized label: motivo→`motivo_consulta`, antecedentes→`antecedentes`, examen/físico/exploración→`examen_fisico`, diagnóstico→`diagnosticos`, plan→`plan_tratamiento`; unmatched → `enfermedad_actual` (first visit) / `evolucion` (evolution) |
| `checklist`                       | narrative section¹ — checked/critical items summarized             |
| `steps`                           | narrative section¹ — completed/skipped summary                     |
| `decision`                        | narrative section¹ — "Decisión: {condition} → {selected branch}"   |
| `dosage_table` / `lab_order` / `imaging_order` | **ignored** — plan content comes from actual order records |
| `alert` / `text`                  | excluded (reference material)                                      |

- ¹ *Narrative section* = `evolucion` on evolution visits, `enfermedad_actual` on first visits
  (`evolucion` does not exist on a first-visit record, and vice versa — see §5).
- `plan_tratamiento` is composed from the consultation's signed `PrescriptionItem`s
  (drug + dose + route + frequency + duration), plus ordered studies ("Laboratorio: …",
  "Imágenes: …") from `LabOrderItem`/`ImagingOrderItem`.
- Only filled content maps (empty `clinical_notes.content`, `vitals` without `values`, unchecked
  checklists produce nothing).
- **Phase 2 override:** optional `historia_mapping` object in the protocol content JSON
  (therefore in `ProtocolVersion.content` and snapshotted into `ProtocolUsage.content`):
  `{ [blockId]: { section?: RecordSectionKey; include?: boolean; label?: string } }`.
  The mapper consults it before the defaults. `dosage_table`/order blocks stay locked (legal).
  Protocol editor gets a "Historia médica" tab (see mockup screen 1) with per-block include
  toggle, destination select, label override, and "Restaurar automático".

## 7. API

All under the existing consultations/patients modules, tenant-scoped, standard auth:

1. **`PATCH /v1/consultations/:id/sign`** (existing) — additionally creates `ConsultationRecord`
   v1 as `draft` after signing. Non-fatal like the invoice outcome: failure is reported in the
   response (`recordOutcome`) and the draft can be created on demand later.
2. **`GET /v1/consultations/:id/record`** — latest version (draft or signed) + version list.
3. **`PATCH /v1/consultations/:id/record`** — update section contents (draft only; sets
   `source: 'edited'` per touched section). Rejects with `RECORD_ALREADY_SIGNED` otherwise.
4. **`POST /v1/consultations/:id/record/regenerate`** — re-derives the draft from protocol
   content, discarding edits (frontend confirms). Draft only. If the latest version is signed
   **and** the consultation has amendments, creates the next version (draft) with `enmiendas`.
   Also the path for generating a historia for consultations signed before this feature shipped.
5. **`POST /v1/consultations/:id/record/sign`** — validates required sections non-empty
   (`RECORD_REQUIRED_SECTIONS_MISSING` with keys), freezes, sets `signedAt`, `signedBy`.
6. **`GET /v1/consultations/:id/record/pdf`** — generates and streams the historia PDF on
   demand (`generateHistoriaMedica` in `apps/api/src/lib/pdf.service.ts`, same visual language
   and streaming pattern as the existing order PDF endpoints — no GCS storage; the PDF is a
   deterministic render of the frozen sections).
7. **`GET /v1/patients/:id/record-export`** (phase 3) — compiles all signed historias
   (newest-first) into one expediente PDF with a cover page (patient identification, doctor,
   generation date, consultation count) and streams it. Synchronous for MVP.

New error codes (closed enum, `packages/shared/src/errors.ts`): `RECORD_NOT_FOUND`,
`RECORD_ALREADY_SIGNED`, `RECORD_NOT_DRAFT`, `RECORD_REQUIRED_SECTIONS_MISSING`,
`RECORD_CONSULTATION_NOT_SIGNED` (no drafts for open consultations).

## 8. Frontend

Spanish UI strings, colocated per convention. See mockups for both screens.

- **Post-sign summary screen:** new "Historia médica" card → historia review page.
- **Historia review (draft):** amber bar "Borrador — editable hasta la firma" with Regenerar /
  Editar / Firmar historia. Sections rendered with the 2px teal rule; per-section "Editado" flag
  when `source === 'edited'`. Editar switches sections to textareas (single save).
- **Historia review (signed):** green strip, read-only, Descargar PDF (printing happens from the
  downloaded PDF; no separate print action in phase 1).
- **Patient detail → "Historia" tab:** consultation list with status chips (Borrador ámbar /
  Firmada verde / "Generar historia" for pre-feature consultations), selected item marked with
  the teal rule; document pane on the right; **Exportar expediente** button at panel top.
- **Phase 2:** protocol editor "Historia médica" tab (mapping table per mockup screen 1).

## 9. Testing

95% per-file coverage gate (`pnpm test:coverage`) applies.

- **Mapper unit tests:** every block type, label matching (accents/case), first-visit vs.
  evolution routing, empty-content skips, `historia_mapping` overrides, section recursion,
  plan composition from order records.
- **API tests:** draft creation on sign (incl. failure → `recordOutcome`), edit draft, edit
  signed → rejected, regenerate discards edits, regenerate after amendment → new version,
  sign validation of required sections, first-visit detection, tenant isolation.
- **PDF smoke tests:** historia PDF and expediente export render non-empty buffers with expected
  text fragments.
- **Frontend tests:** historia tab states, draft bar actions, edited flags, export button.

## 10. Delivery phases

1. **Phase 1 — core:** `ConsultationRecord` model + migration, section skeleton + default
   mapper, draft lifecycle endpoints (get/edit/regenerate/sign), historia PDF, post-sign card +
   historia review UI, patient Historia tab (list + document).
2. **Phase 2 — per-protocol mapping:** `historia_mapping` schema + mapper support + protocol
   editor tab.
3. **Phase 3 — expediente export:** patient-level export endpoint + cover page + UI button.

## 11. Non-goals

- CIE/ICD coding of diagnoses (flagged for a separate product decision).
- INDOTEL-certified digital signatures (application-level sign only for now).
- Editing `ficha_identificacion` inside the historia (belongs to the patient record).
- Async export jobs, WhatsApp/email delivery (v2 of orders spec covers sending).
