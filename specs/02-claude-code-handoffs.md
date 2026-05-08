# Claude Code Handoff Prompts — Rezeta Bug Fixes

Each prompt below is a self-contained brief for a Claude Code session. Paste the relevant prompt (including the _Context_, _Problem_, _Fix_, and _Acceptance criteria_ sections) at the start of a session, then start with the implementation.

Prompts are ordered by priority — work top-to-bottom unless circumstances change. The first three are the highest-leverage and the smallest in scope.

---

## Prompt 1 — Fix the gate routing so it shows on the most common entry point

### Context

The consultation gate (`ConsultationGate.tsx`) is the spine of the Hybrid redesign in `specs/protocol-in-consultation-spec.md`. Its purpose is to force a protocol decision before SOAP opens.

Currently `apps/web/src/pages/ConsultaNueva.tsx` only renders the gate when both `patientId` and `locationId` are in the URL:

```ts
const showGate = Boolean(patientId && locationId)
```

The patient detail page links to `/consultas/nueva?patientId=…` with no `locationId`. So in the most common entry point — opening a patient and clicking "Nueva consulta" — the gate is bypassed and the user sees a legacy patient+location picker instead.

### Problem

The gate must show as soon as the user lands on `/consultas/nueva`, regardless of whether `locationId` was pre-populated. The legacy patient+location picker form should be deleted entirely.

### Fix

1. In `ConsultaNueva.tsx`, delete the legacy fallback form (the `<div className="max-w-md mx-auto mt-12">…</div>` block that renders when `showGate` is false). Replace with the gate, with location picking inline.

2. The gate should:
   - Always render the breadcrumb / header / overline / serif title section
   - Show a small "Ubicación" picker as a chip or inline select above the recent-protocols row when `locationId` is empty. Default it to the doctor's primary location if there's a way to identify that (`/v1/locations` first item, or whichever has `isOwned: true`).
   - Once `locationId` is set, behave as today.

3. If `patientId` is also missing (someone visits `/consultas/nueva` directly), show a small inline "Paciente" picker with the same treatment.

4. Update `PacienteDetalle.tsx`'s "Nueva consulta" link if it makes sense to also pass `locationId` from the doctor's primary location — but the gate must work without it.

5. Replace both API call patterns in `handleGateSelect` and `handleCreate` with the `useCreateConsultation` mutation hook for consistent cache invalidation. (See Prompt 2 — fixing this in conjunction is cleanest.)

### Acceptance criteria

- Visiting `/consultas/nueva` (no params) renders the gate with empty patient + location pickers shown inline.
- Visiting `/consultas/nueva?patientId=X` renders the gate with patient pre-filled and location picker shown inline.
- Visiting `/consultas/nueva?patientId=X&locationId=Y` renders the gate with both pre-filled, no inline pickers.
- The legacy `<Field label="Paciente"> + <Field label="Ubicación"> + Crear consulta` block is gone from `ConsultaNueva.tsx`.
- All existing tests still pass; add new tests for the three URL-shape variants.

### Files likely to change

- `apps/web/src/pages/ConsultaNueva.tsx` (significant)
- `apps/web/src/components/consultations/ConsultationGate.tsx` (small additions for inline pickers)
- `apps/web/src/pages/PacienteDetalle.tsx` (optional — if you want to pass `locationId`)
- Tests for ConsultaNueva (update for new URL shapes)

---

## Prompt 2 — Make consultation creation atomic and replace the fake suggestions hook

### Context

Two related bugs in the gate flow that should be fixed together:

**Bug A — non-atomic creation.** `ConsultaNueva.tsx` creates a consultation and then attempts to attach a protocol in two separate API calls:

```ts
const consultation = await apiClient.post('/v1/consultations', {…})
if (protocolId) {
  try {
    await apiClient.post(`/v1/consultations/${consultation.id}/protocols`, { protocolId })
  } catch {
    // Non-fatal: consultation was created; protocol can be added from inside
  }
}
```

If the second call fails, the user lands on a blank consultation with no protocol — which defeats the entire gate concept. The catch block silently swallows the error.

**Bug B — fake suggestions.** `apps/web/src/hooks/consultations/use-protocol-suggestions.ts` returns `useGetProtocols({ status: 'active', sort: 'updatedAt_desc' }).slice(0, 4)`. It has no patient context. Every patient sees the same four protocols with the same "MÁS PROBABLE" badge, regardless of whether they've ever seen any of those protocols.

The backend `ProtocolRecommendationsModule` exists and is mounted at `GET /v1/patients/:patientId/protocol-suggestions` — but the frontend doesn't call it.

### Problem

A) Make consultation creation + protocol attachment atomic in a single API call. If protocol attachment fails, consultation creation must roll back too.

B) Replace the fake suggestions hook with one that calls the real recommendations endpoint with `patientId`.

### Fix

**A) Atomic create.**

1. In `packages/shared/src/schemas/consultation.ts`, extend `CreateConsultationSchema`:

   ```ts
   export const CreateConsultationSchema = z.object({
     patientId: z.string().uuid(),
     locationId: z.string().uuid(),
     // ...existing fields...
     protocolId: z.string().uuid().optional(), // NEW
   })
   ```

2. In `apps/api/src/modules/consultations/consultations.service.ts`, modify `create()` to wrap the consultation insert and protocol-usage insert in a single Prisma transaction when `protocolId` is provided.

3. In `apps/web/src/hooks/consultations/use-consultations.ts`, ensure `useCreateConsultation` mutation accepts the optional `protocolId` and returns the full `ConsultationWithDetails`.

4. In `ConsultaNueva.tsx`, replace `handleGateSelect` body with a single mutation call:

   ```ts
   const consultation = await createMutation.mutateAsync({
     patientId,
     locationId,
     diagnoses: [],
     ...(protocolId ? { protocolId } : {}),
   })
   void navigate(`/consultas/${consultation.id}`, { replace: true })
   ```

5. Remove the `try { await apiClient.post(…/protocols…) } catch {}` block. The atomic call handles both.

**B) Real suggestions.**

6. Replace the body of `apps/web/src/hooks/consultations/use-protocol-suggestions.ts`:

   ```ts
   export function useProtocolSuggestions(patientId: string | null, enabled: boolean) {
     return useQuery({
       queryKey: ['protocol-recommendations', patientId],
       queryFn: () =>
         apiClient.get<ProtocolRecommendation[]>(`/v1/patients/${patientId}/protocol-suggestions`),
       enabled: enabled && Boolean(patientId),
     })
   }
   ```

   (Update return shape to match — `{ suggestions, isLoading }` if the consumer expects that structure.)

7. Update `ConsultationGate.tsx` to pass the `patientId` prop into the hook.

8. The "MÁS PROBABLE" badge logic should now use the highest-ranked entry from the response (the recommendations endpoint already returns ranked items). If the backend doesn't already return a `mostLikely: boolean` flag, decide here: top-1 by score gets the badge.

### Acceptance criteria

- `CreateConsultationSchema` accepts an optional `protocolId`.
- `POST /v1/consultations` with `protocolId` creates both rows in a transaction; rollback on either failure.
- `ConsultaNueva.tsx` uses one mutation call (no second `apiClient.post`).
- The "MÁS PROBABLE" cards on the gate vary by patient. Two different patients see different (or differently ordered) suggestions.
- A patient with no consultation history shows no "MÁS PROBABLE" badge — or shows it only on a protocol that's actually been used in this clinic, not on a random recently-created one.
- Existing tests for `useCreateConsultation` and `ConsultationGate` updated. New test for the atomic transaction (force protocol attachment to fail; assert consultation row is not in the DB).
- Old `useProtocolSuggestions` test that was just snapshot-checking the no-patient-context output gets replaced.

### Files likely to change

- `packages/shared/src/schemas/consultation.ts`
- `apps/api/src/modules/consultations/consultations.service.ts`
- `apps/api/src/modules/consultations/__tests__/consultations.service.spec.ts`
- `apps/web/src/hooks/consultations/use-consultations.ts`
- `apps/web/src/hooks/consultations/use-protocol-suggestions.ts`
- `apps/web/src/components/consultations/ConsultationGate.tsx`
- `apps/web/src/pages/ConsultaNueva.tsx`

---

## Prompt 3 — Replace hardcoded "Dr. Test García" with the real doctor's name; remove fake stat

### Context

On the gate at `/consultas/nueva?patientId=X&locationId=Y`, two strings are hardcoded:

- Subtitle reads `Roberto Castro · Dr. Test García` regardless of who's logged in.
- Empty-state body text reads `Dr. García usa 2.1 protocolos por paciente en promedio.`

The actual logged-in user is shown in the topbar (e.g., "Dr. Carlos Feliz"). The Consulta page (post-creation) correctly shows the real doctor name.

### Problem

A) The gate's subtitle must use the real authenticated doctor's name.

B) The "2.1 protocolos por paciente" stat is fake. Either pull it from a real endpoint or remove the line entirely.

### Fix

A) In `apps/web/src/pages/ConsultaNueva.tsx`, replace the hardcoded `'Dr. Test García'` literal with the doctor name from `useAuth()`. Use `user.fullName` (from `AuthUser`) or whatever the existing pattern is in `Consulta.tsx`. There may be other hardcoded `García` references in `ConsultationGate.tsx` and the empty-state component — grep and replace.

B) For the "2.1 protocolos por paciente" line:

- **Preferred path:** if there's data to compute it from, expose it via `GET /v1/users/me/stats` returning something like `{ avgProtocolsPerPatient: 2.1 }`. Compute server-side as `protocolUsages.count / patients.count` for the doctor's last 90 days.
- **Pragmatic path:** delete the line. A fake stat is worse than no stat.

If you go pragmatic, also delete it from `08-edge.png`'s description in the handoff so future audits don't flag the empty state as missing it.

### Acceptance criteria

- Searching the codebase for `'García'`, `'Garcia'`, or `'Dr. Test'` returns zero matches in `apps/web/`.
- Logging in as a different doctor shows that doctor's name on the gate subtitle.
- Either the "promedio de protocolos" line shows real data, or it's removed.
- Tests updated.

### Files likely to change

- `apps/web/src/pages/ConsultaNueva.tsx`
- `apps/web/src/components/consultations/ConsultationGate.tsx` (probably)
- (Optional) `apps/api/src/modules/users/users.controller.ts` if you add a stats endpoint

---

## Prompt 4 — Make the consultation right rail sticky and present in both view modes

### Context

On `/consultas/:id`, the right rail (Protocolos / Órdenes médicas / Consultas previas / Alertas) is part of the page's natural document flow rather than a sticky sidebar. As the doctor scrolls down through the SOAP form (Subjetivo → Examen → Evaluación → Plan), the right rail content disappears.

Additionally, toggling from SOAP to PROTOCOLO view causes the right rail to vanish entirely (see `CHANGELOG` line 349: `removed inline SOAP rail`). The handoff design (`05-hybrid.png`) shows the right rail in canvas mode too, with ALERTAS, PASOS DEL PROTOCOLO, and ÓRDENES.

### Problem

The right rail must:

A) Stay visible while the page body scrolls (sticky).
B) Render in both SOAP and PROTOCOLO view modes — the toggle is about the body presentation, not about whether the rail exists.

### Fix

A) **Make the rail sticky.**

- Locate the right-rail container in `Consulta.tsx`. It's currently a sibling block in the layout grid.
- Apply `position: sticky; top: var(--header-offset, 80px); max-height: calc(100vh - var(--header-offset, 80px) - 1rem); overflow-y: auto;` (use the project's spacing tokens).
- Verify the rail's content fits within `max-height` on small screens; add internal scroll if it overflows.

B) **Lift the rail out of the view-mode-switching body.**

- Currently `CanvasView.tsx` has its own non-rail layout. The page-level `Consulta.tsx` should own the rail.
- The body should be a single child container that swaps between `<SoapView />` and `<CanvasView />` based on `viewMode`.
- This is also the right time to do the SoapView extraction (issue #4 from the original audit). Moving SOAP markup into `apps/web/src/components/consultations/SoapView.tsx` makes the page level easier to reason about and unblocks future view modes.

### Acceptance criteria

- Scroll down on a long consultation in SOAP view: right rail stays in viewport.
- Toggle to PROTOCOLO view: right rail still renders (Alertas, Pasos del protocolo, Órdenes).
- Switching view modes does not cause layout shift in the rail (its width stays constant).
- `Consulta.tsx` line count drops significantly (target: under 600 lines after SOAP extraction).
- Existing tests for consultation rendering still pass; add a test that mounts the page in canvas mode and asserts the right rail is in the DOM.

### Files likely to change

- `apps/web/src/pages/Consulta.tsx`
- `apps/web/src/components/consultations/CanvasView.tsx` (remove rail, body-only)
- `apps/web/src/components/consultations/SoapView.tsx` (NEW — extracted from Consulta.tsx)
- `apps/web/src/components/consultations/RightRail.tsx` (verify or refactor)

---

## Prompt 5 — De-duplicate `ProtocolPickerModal` and refactor `Consulta.tsx`

### Context

There are two implementations of `ProtocolPickerModal`:

1. `apps/web/src/components/protocols/ProtocolPickerModal.tsx` (standalone file)
2. An inline `function ProtocolPickerModal(...)` defined inside `apps/web/src/pages/Consulta.tsx` at line ~405

Consulta.tsx uses its own inline version (line ~1148). The standalone file is orphaned — never imported anywhere.

`Consulta.tsx` is also 1207 lines and contains many components that should live elsewhere: `SaveBadge`, `VitalInput`, `VitalsSection`, `DiagnosesSection`, `SoapTextarea`, `ProtocolPickerModal`, `SignModal`, `AmendmentModal`, `AsideCard`.

### Problem

Two implementations with the same name will diverge — bug fixes applied to one won't appear in the other. And `Consulta.tsx` is unmaintainable at 1207 lines.

### Fix

1. Diff the two `ProtocolPickerModal` implementations. Pick the better one. (The standalone file is likely cleaner since it's been refactored separately; the inline one may have ad-hoc behavior added in `Consulta.tsx`.) Merge any unique logic from one into the other.

2. Delete the inline `ProtocolPickerModal` definition from `Consulta.tsx`. Import the standalone version instead.

3. Extract the following sub-components from `Consulta.tsx` into their own files under `apps/web/src/components/consultations/`:
   - `SaveBadge`
   - `VitalsSection` + `VitalInput`
   - `DiagnosesSection`
   - `SoapTextarea`
   - `SignModal`
   - `AmendmentModal`
   - `AsideCard`

   Each gets its own `.tsx` and a corresponding `__tests__/*.test.tsx`.

4. Run Prompt 4 (right-rail extraction) in conjunction. Together they should reduce `Consulta.tsx` to a thin page-level orchestrator (target: under 300 lines).

### Acceptance criteria

- `grep -rn 'function ProtocolPickerModal' apps/web/src` returns exactly one match.
- `Consulta.tsx` is under 300 lines.
- All extracted sub-components have unit tests.
- No regression in the consultation rendering / signing / amending flows.
- `pnpm test` passes; `pnpm lint` zero errors.

### Files likely to change

- `apps/web/src/pages/Consulta.tsx` (much smaller)
- `apps/web/src/components/consultations/SoapView.tsx` (likely created in Prompt 4)
- `apps/web/src/components/consultations/SaveBadge.tsx` (NEW)
- `apps/web/src/components/consultations/VitalsSection.tsx` (NEW)
- `apps/web/src/components/consultations/DiagnosesSection.tsx` (NEW)
- `apps/web/src/components/consultations/SignModal.tsx` (NEW)
- `apps/web/src/components/consultations/AmendmentModal.tsx` (NEW)
- Tests for each extracted component

---

## Prompt 6 — Move view-mode preference to `User.preferences`

### Context

The handoff (Q3 in `06-open-questions.md`) explicitly asked: "View-mode persistence: per-doctor or per-consultation?" The recommendation was _per-doctor_ stored on `User.preferences`. The implementation chose neither — it stores in `localStorage`. So the doctor's preference doesn't sync across devices, doesn't survive incognito, doesn't survive cache clear.

For a doctor who works at 2-4 health centers per week (per CLAUDE.md), a per-device preference is genuinely worse than per-doctor.

### Problem

The view-mode preference must persist per-doctor across devices.

### Fix

1. **Schema:** Add a `preferences Json @default("{}")` field to the `User` model in `packages/db/prisma/schema.prisma`. Generate a migration.

2. **API:** Add `PATCH /v1/users/me/preferences` to update arbitrary preference keys (validated against a Zod schema). Add `GET` exposure via the existing `/v1/auth/provision` response so the frontend has the preferences at boot.

3. **Schema-shared:** Define `UserPreferences` in `packages/shared/src/types/user.ts` with at least `consultationViewMode: 'soap' | 'canvas'`.

4. **Frontend:**
   - `apps/web/src/hooks/consultations/use-consultation-view-mode.ts`: read from `useAuth().user.preferences.consultationViewMode` first; fall back to `localStorage` if preferences haven't loaded yet (during initial render); write through to a `useUpdateUserPreferences` mutation.
   - On successful PATCH, update local query cache.
   - Keep localStorage as a write-through cache for offline situations and for snappy first-render.

5. Add a regression test for the case where two browser sessions on different devices (simulated via two `QueryClient` instances) for the same user converge.

### Acceptance criteria

- A doctor sets view mode to Canvas on Device A, opens Device B, and Device B starts in Canvas mode.
- Old localStorage values are migrated on first read (or simply ignored — they'll get overwritten on next preference update).
- API endpoint has tests.
- Schema migration is reversible.

### Files likely to change

- `packages/db/prisma/schema.prisma`
- New migration in `packages/db/prisma/migrations/`
- `apps/api/src/modules/users/users.controller.ts` (new endpoint)
- `apps/api/src/modules/users/users.service.ts`
- `apps/api/src/modules/users/__tests__/`
- `packages/shared/src/types/user.ts` or `auth.ts`
- `apps/web/src/hooks/consultations/use-consultation-view-mode.ts`

---

## Prompt 7 — Update CLAUDE.md to reflect actual project state

### Context

CLAUDE.md is loaded at the start of every Claude Code session, so its accuracy materially affects every future task. Two things are stale:

1. The "Current Version" section states _"protocol-to-consultation integration"_ is **deferred**, but the codebase has 13+ files implementing exactly that with full test coverage.

2. The `@imports` list is missing several specs that exist in `specs/`:
   - `specs/protocol-in-consultation-spec.md` (1729 lines — the authoritative spec for the in-flight redesign)
   - `specs/protocol-engine-slices.md`
   - `specs/remaining-mvp-slices.md`
   - `specs/audit-log-spec.md`
   - `specs/audit-log-implementation-prompt.md`

### Problem

Future sessions start with a wrong premise about scope and miss available spec context.

### Fix

1. In CLAUDE.md, edit the "Current Version" section. Move `protocol-to-consultation integration` out of the deferred list. Add a new line under the table:

   > **In progress (Hybrid redesign per `specs/protocol-in-consultation-spec.md`):** consultation gate, protocol strip, view-mode toggle, multi-protocol canvas. See `specs/protocol-in-consultation-spec.md` and the `_preview/*` routes for component previews.

2. In the "Specification Documents" `@import` list, add:

   ```
   @./specs/protocol-in-consultation-spec.md
   @./specs/protocol-engine-slices.md
   @./specs/remaining-mvp-slices.md
   @./specs/audit-log-spec.md
   ```

3. Optional: add a `specs/README.md` that indexes all specs with one-line descriptions, so future specs get discovered automatically without CLAUDE.md edits.

### Acceptance criteria

- CLAUDE.md no longer claims `protocol-to-consultation integration` is deferred.
- All specs in `specs/` (except superseded ones) are imported in CLAUDE.md.
- A new Claude Code session, asked "is the protocol-strip already implemented?", answers yes and references the spec.

### Files likely to change

- `CLAUDE.md`
- `specs/README.md` (NEW, optional)

---

## Prompt 8 — Translate the protocol status badge

### Context

On `/protocolos`, the status badge under each protocol reads `active` (English). The rest of the UI is Spanish. Compare to `/ajustes/ubicaciones` which correctly shows `Propio` / `Externo`.

### Problem

Localization inconsistency. The doctor user base is Spanish-first.

### Fix

1. Locate where the protocol status badge label is composed. Likely in `apps/web/src/pages/Protocolos.tsx` or a `ProtocolListItem` component, possibly using `protocol.status` directly without a translation map.

2. Add a translation map in `apps/web/src/lib/strings.ts`:

   ```ts
   export const PROTOCOL_STATUS_LABELS: Record<ProtocolStatus, string> = {
     active: 'activo',
     draft: 'borrador',
     archived: 'archivado',
   }
   ```

3. Use it at the rendering site instead of the raw status enum.

4. While you're there, audit other status enums in the codebase (consultation status, invoice status, etc.) and verify they're all going through translation maps rather than rendered raw.

### Acceptance criteria

- `grep -rn '"active"' apps/web/src/components` and `apps/web/src/pages` finds zero user-visible occurrences (raw enum values may still appear in queryKeys or types — those don't matter).
- All status badges render in Spanish.
- A future locale toggle (English) would only need to change `PROTOCOL_STATUS_LABELS`, not every render site.

### Files likely to change

- `apps/web/src/lib/strings.ts`
- `apps/web/src/pages/Protocolos.tsx` (or wherever the badge is)

---

## Prompt 9 — Fix protocol editor "Publicar v2" on a brand-new v1 protocol

### Context

Creating a new protocol shows the editor with a `Publicar v2` button at the top right and `· v1` in the breadcrumb. Historial sidebar shows only `v1 · 7 may`. This is confusing — there's no v1 yet to publish v2 over; v1 is the unpublished draft.

### Problem

The button label should reflect what publishing will produce. On the first publish of a brand-new protocol, that's v1, not v2.

### Fix

In `apps/web/src/pages/ProtocolEditor.tsx` (or wherever the publish button is rendered), compute the next version label:

```ts
const lastPublishedVersion = protocol.versions.find((v) => v.publishedAt)?.version
const nextVersionLabel = lastPublishedVersion ? `v${lastPublishedVersion + 1}` : 'v1'
```

Use `Publicar ${nextVersionLabel}`.

Also update the publish modal's title from `Publicar nueva versión` and the confirm button to use the same label.

### Acceptance criteria

- Brand-new unpublished protocol: button reads `Publicar v1`. Modal confirm reads `Publicar v1`.
- After first publish: editor reloads, button reads `Publicar v2`. Modal confirm reads `Publicar v2`.
- After second publish: button reads `Publicar v3`. Etc.

### Files likely to change

- `apps/web/src/pages/ProtocolEditor.tsx`
- Tests for the editor

---

## Prompt 10 — Clean up minor UI bugs

A grab bag of small fixes that should be batched into one PR:

### A. MissingFieldsPanel empty-row artifact

File: `apps/web/src/components/consultations/MissingFieldsPanel.tsx`
The panel renders an empty white row between the `FALTANTES (3)` overline and the first missing-field item. Inspect the JSX, identify the empty container, remove it.

### B. Status badge in Spanish

See Prompt 8.

### C. Patient row click navigation

File: `apps/web/src/pages/Pacientes.tsx`
Wrap each row in a `Link` to the patient detail. Keep the explicit Ver/Editar/Eliminar action icons; the row body should also navigate.

### D. Consulta H1 reflects state

File: `apps/web/src/pages/Consulta.tsx`
Replace the static "Nueva consulta" with:

```ts
const title =
  !consultation.chiefComplaint && !consultation.subjective && !consultation.objective
    ? 'Nueva consulta'
    : consultation.status === 'signed'
      ? `Consulta del ${formatDateShort(consultation.consultedAt)} · firmada`
      : `Consulta del ${formatDateShort(consultation.consultedAt)}`
```

### E. Sidebar nav highlights on consultation routes

File: `apps/web/src/components/layout/Sidebar.tsx`
Mark `/pacientes` as active when the route matches `/consultas/*` or `/pacientes/*`.

### F. Date format unification

Files: `apps/web/src/pages/Agenda.tsx`, `apps/web/src/pages/ConsultaNueva.tsx`, anywhere date formatting is inlined.
Move all date formatting helpers to `apps/web/src/lib/strings.ts` and replace inline calls.

### G. Empty-state copy

File: probably `apps/web/src/components/consultations/ConsultationGate.tsx`
Replace "Aún no tienes protocolos configurados para tu clínica. Puedes empezar sin protocolo o instalar uno desde la biblioteca." with:
"Todavía no tienes protocolos en tu biblioteca. Puedes iniciar la consulta sin guía o instalar uno desde la biblioteca de plantillas."

### Acceptance criteria

- All seven fixes in a single PR.
- Lint clean, tests pass.
- A second pass through `/pacientes`, `/consultas/:id`, gate empty state, and Agenda confirms the bugs are gone.

---

## Working notes

- All prompts assume `pnpm dev` is running and the API is reachable on localhost.
- Run `pnpm lint && pnpm test` before declaring any prompt done.
- Prompts 1, 2, 4, and 5 are linked. Doing them in this order avoids touching the same files twice.
- After all ten prompts, re-run the original audit's "Recommended order of operations" — most should be ticked off.
