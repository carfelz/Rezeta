# 05 · Slices

PR-sized work in dependency order. Each slice ends with the app deployable.

---

## Slice 1 — Protocol Strip (visual lift, no behaviour change)

**Goal:** Move protocol context from the right rail into a full-width strip under the consultation header. Users should feel the change is "the protocol is now obviously active."

**Scope:**
- Create `ProtocolStrip.tsx`.
- Modify `Consulta.tsx`: render `ProtocolStrip` when `protocolUsages.length > 0`. Remove the existing right-rail "Protocolo activo" card.
- Strip wires to existing data — no new endpoints.

**Acceptance criteria:**
1. When a consultation has 0 usages, no strip renders, current "Agrega un protocolo" empty state stays visible (in-rail) for backward compatibility.
2. With 1 usage: strip shows protocol title, version chip, progress (X/N), "Ver pasos", "Cambiar". No view-mode toggle yet.
3. "Cambiar" opens the existing `ProtocolPickerModal` with `currentProtocolId` set.
4. "Ver pasos" opens a popover listing all steps with their status from `usage.modifications`.
5. No regression: signing, vitals, SOAP fields, order queue all behave identically.
6. Storybook stories: `single`, `with-progress`, `with-completed-steps`.

**Out:** view-mode toggle, multi-protocol pills, switch dialog, gate.

**Estimate:** 2 days.

---

## Slice 2 — Start Gate

**Goal:** Doctor sees motivo gate on `/consulta/nueva`; picking a card creates Consultation + ProtocolUsage in one step.

**Scope:**
- Create `ConsultationGate.tsx`, `RecentForPatientGrid`, `ProtocolSearch`, `SpecialtyBuckets`.
- Modify `pages/ConsultaNueva.tsx`.
- Modify `POST /v1/consultations` to accept `protocolId?`.
- Add `GET /v1/patients/:id/protocol-suggestions` (or fall back to client-side ranking — pick before starting).

**Acceptance criteria:**
1. Navigating to `/consulta/nueva?patientId=X` shows the gate, not an immediate redirect.
2. Top-3 cards prioritise protocols this doctor has used with this patient before.
3. Clicking a card creates the consultation + adds the protocol in one round trip; user lands on the consultation route with `ProtocolStrip` already populated.
4. "Continuar sin protocolo" creates a blank consultation (current behaviour).
5. Empty state shows when `protocols.length === 0`.
6. Search filters in place; specialty buckets open the picker filtered.

**Out:** view-mode toggle.

**Estimate:** 3 days.

---

## Slice 3 — View Mode Toggle + Canvas View

**Goal:** Doctors can flip between SOAP and Canvas. Per-doctor preference persists.

**Scope:**
- Create `SoapView.tsx` (extracted), `CanvasView.tsx`, `ProtoStep.tsx`, `ViewModeToggle.tsx`.
- Modify `Consulta.tsx` to mount whichever view is active.
- Add `consultationViewMode` to `User.preferences`.
- Add hook `use-consultation-view-mode.ts`.

**Acceptance criteria:**
1. Strip shows the segmented toggle. Default `soap`.
2. Switching to `canvas` re-renders body with steps as spine; SOAP fields show as the "Resultado SOAP" rail.
3. All edits in either view persist to the same `Consultation` + `ProtocolUsage` rows.
4. Order queue is reachable from both views.
5. Toggle persists across refresh and across sessions.
6. If no usage exists, toggle is hidden (Canvas needs a protocol).

**Estimate:** 4 days.

**Open question to resolve before start:** Q3 (per-doctor vs per-consultation persistence).

---

## Slice 4 — Edge cases: skip / switch / off-protocol / resume

**Goal:** First-class UI for the workflows doctors hit weekly.

**Scope:**
- `SkipStepDialog`, `SwitchProtocolDialog`, `OffProtocolNote`, `ResumeBanner`.
- New modification kinds in `ProtocolUsage.modifications`.
- `PATCH /v1/consultations/:id/protocol-usages/:usageId/status` for switch.

**Acceptance criteria:**
1. Skipping a step records reason; step renders strikethrough + tooltip; counts toward progress.
2. Switching protocol opens the diff dialog; on confirm, old usage `status='switched'`, new usage starts; preserved/moved/discarded sets match the dialog.
3. Off-protocol note: doctor adds free text inside the consultation body; "Convertir en paso" creates a `ProtocolSuggestion`; "Mover a Subjetivo" appends + deletes the note.
4. Resume banner shows when `now - updated_at > 10 min` and consultation is `in_progress`.
5. All modifications appear correctly in the audit trail.

**Estimate:** 4 days.

---

## Slice 5 — Validation + missing fields panel + conditional steps

**Goal:** Sign blocking is loud and helpful; conditional steps appear/disappear from triggers.

**Scope:**
- `MissingFieldsPanel`.
- Conditional-step rendering in `ProtocolStrip`, `ProtoStep`, right-rail step list.
- Sign button disabled state from required-fields check.

**Acceptance criteria:**
1. Pressing "Firmar y cerrar" with missing required fields opens panel; sign button stays disabled.
2. Each missing item links to the field; clicking scrolls + focuses.
3. Once required fields are filled, sign re-enables without page reload.
4. PA ≥160 (or whatever protocol declares) makes the conditional step appear with badge in <300ms; clearing the trigger removes it (with confirm if doctor entered content there).

**Estimate:** 3 days.

---

## Slice 6 — Multi-protocol on one consultation (rare path)

**Goal:** Doctors with HTA + DM2 in same visit can run both protocols on one consultation.

**Scope:**
- Multi pills in `ProtocolStrip`.
- Add-second-protocol affordance ("+ Añadir protocolo").
- Right-rail step list interleaves with origin tags.

**Acceptance criteria:**
1. Strip switches to multi mode when `usages.length > 1`.
2. Clicking a pill swaps the active context (which protocol the body emphasizes).
3. Vitals & motivo remain shared; per-protocol steps stay scoped.
4. Each usage signs/completes independently.

**Estimate:** 3 days. *Defer if utilization metrics show the feature is unused after slices 1–5 ship.*
