# Remove the SOAP View — Protocol-First Consultations

**Date:** 2026-06-26
**Status:** Approved design — ready for implementation plan

## Problem

The v2 "workflow-first redesign" removed the SOAP fields from the `Consultation` DB
model and called for removing the SOAP form (plan `2026-05-26-04-frontend-redesign.md`:
"remove the SOAP form"). The DB half shipped, but the **frontend SOAP view was never
removed**. It survives as a non-persisting fallback:

- `SoapView` is rendered in `ProtocolPanel.tsx` whenever no protocol is attached
  (view mode defaults to `'soap'`).
- It is backed by `use-soap-state.ts`, an explicit local stub — the update mutation is a
  no-op (`UpdateConsultationDto = Record<string, never>`). **Anything typed into the SOAP
  boxes is silently discarded.**

This is a data-loss footgun and contradicts the canonical spec. The spec's intended
no-protocol design ("Nota libre" → a `clinical_notes` block backed by a real
`ProtocolUsage`) was never built.

## Decision

Remove the SOAP view entirely and make protocols the **only** content-entry surface.
**"Nota libre" will not be built.** Doctors must add a protocol to document. A consultation
cannot be signed with zero protocols.

(Decisions confirmed 2026-06-26: block empty signing end-to-end; also remove the orphaned
old-gate scaffolding.)

This does not reintroduce a gate. A consultation still opens immediately with patient
context and no protocol (Design Principle #2, "No mandatory gate" — about *entry*). The new
rule governs *content*: clinical documentation requires a protocol, enforced at sign time.

## Scope

### Frontend — delete

| File | Note |
| --- | --- |
| `apps/web/src/components/consultations/SoapView.tsx` | |
| `apps/web/src/components/consultations/SoapTextarea.tsx` | |
| `apps/web/src/components/consultations/ViewModeToggle.tsx` | |
| `apps/web/src/components/consultations/ConsultationGate.tsx` | orphaned old gate |
| `apps/web/src/pages/Consultation/use-soap-state.ts` | no-op stub |
| `apps/web/src/hooks/consultations/use-consultation-view-mode.ts` | |
| Preview-only pages that exist solely to render the above (`GatePreview` and any consultation `*_preview` files referencing view-mode) | dead code |
| Their tests: `SoapTextarea`, `ViewModeToggle`, `ConsultationGate`, `ConsultationGate.source`, `use-consultation-view-mode` | |

Remove `ConsultationViewMode` type and `viewMode`/`setViewMode` from
`apps/web/src/store/ui.store.ts`.

### Frontend — simplify

- **`ProtocolPanel.tsx`**: remove the `viewMode`/`soap` branch. Render `CanvasView` when a
  protocol is active; otherwise render a centered **"Agregar protocolo"** empty state that
  opens `ProtocolPickerModal` (the only content path). `CanvasView` stays unchanged.
- **`ProtocolStrip.tsx` / `ProtocolBar.tsx`**: remove the `ViewModeToggle` and `viewMode`
  props/handling.
- **`Consultation/index.tsx`**: remove `useSoapState` and the SOAP-based
  `computeMissingFields` (it checks `chiefComplaint`/`assessment`/`diagnoses` from SOAP
  state). Missing-field checking is driven solely by the protocol-based validator already in
  `packages/shared` (`computeMissingRequiredFields`).
- **`MissingFieldsPanel.tsx`**: drop the SOAP-field `computeMissingFields`; surface only
  protocol-derived missing required fields (reuse the shared validator).

### Sign rule — block empty consultations

- **Backend** (`apps/api/src/modules/consultations/consultations.service.ts`, `sign()`):
  before the required-fields check, if the consultation has zero `ProtocolUsage` records,
  throw `BadRequestException` with the new error code.
- **Shared** (`packages/shared/src/errors.ts`): add
  `CONSULTATION_REQUIRES_PROTOCOL`.
- **Frontend**: disable **"Firmar y cerrar"** when `protocolUsages.length === 0`, with a
  tooltip explaining a protocol must be added. (The backend guard is the defensive
  source of truth.)

### Docs / specs

- **`specs/updated-specs/01-consultation-workflow.md`**:
  - §4.1 (line 75): drop the "Nota libre" quick-access; the no-protocol panel only prompts
    to add a protocol.
  - §4.4 "No Protocol Mode": rewrite — documentation requires a protocol; there is no
    free-form fallback. Orders still require a protocol context.
  - §5 (line 138): change the sign validation to "at least one `ProtocolUsage` exists"
    (remove "or at minimum a Nota libre"); note the `CONSULTATION_REQUIRES_PROTOCOL` error.
- **`CLAUDE.md`**: confirm the clinical-documentation note reflects "protocol required to
  document; no SOAP/free-note fallback."
- **`specs/updated-specs/00-overview.md`**: no change — its SOAP references describe the
  (accurate) DB-level removal rationale, not a fallback.
- **Dated plan files** (`docs/superpowers/plans/2026-05-26-*`) are historical records and
  are left unchanged.

### Out of scope

Walk-in/planned entry flow, the protocol editor, the picker modal, autosave, amendments —
all unchanged.

## Testing

- **`ProtocolPanel`**: no protocol → renders the "Agregar protocolo" empty state and **no**
  SOAP textareas; with an active usage → renders `CanvasView`.
- **Sign (backend)**: signing a consultation with zero usages throws
  `CONSULTATION_REQUIRES_PROTOCOL`; signing with ≥1 usage proceeds (existing required-field
  checks still apply).
- **Sign (frontend)**: "Firmar y cerrar" is disabled at zero usages, enabled at ≥1.
- Delete obsolete SOAP/view-mode/gate tests; ensure no dangling imports.
- Gates: `pnpm lint` clean, `pnpm test` green, coverage ≥ 90%.

## Risks / notes

- **In-flight unsigned consultations**: SOAP input never persisted, so there is no data to
  migrate — removing the view loses nothing real.
- **Coverage**: deleting `use-consultation-view-mode` and SOAP components removes both code
  and its tests; net coverage should hold. Pre-existing `DatePicker`/`TimePicker`/`calendar`
  coverage gaps are unrelated and out of scope.
