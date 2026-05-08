# Rezeta — Full Audit (Static + Live)

**Date:** 7 May 2026
**Repo state:** `carfelz/Rezeta` at `de2aa31` (`chore: fixing db errors - fixing tech-debt`)
**Live target:** http://localhost:5173/
**Logged in as:** Dr. Carlos Feliz (`test@test.com`), Cardiología, Consultorio Privado / Centro Médico Real

This is the second full audit. The first was a static code audit; this round adds a live walkthrough acting as senior QA. Findings are organized by severity. Each one names the symptom, the evidence, why it matters, and where the fix lands.

The runtime itself is clean — no console errors anywhere, all API calls return 200, networking is healthy. Almost every finding is a UX, logic, or labeling defect rather than a stability problem.

---

## Status of the original 14 findings

The new commit (auth refactor + migration consolidation) was clean technical work but **did not address any of the 14 findings** from the previous audit. Two small wins worth noting:

- The visual-fidelity instruction we drafted last round was added to CLAUDE.md.
- A `No TODO Markers` rule was added with ESLint enforcement.

Everything else from the original audit still applies. The most important ones (#1 fake suggestions, #2 non-atomic gate create, #3 view-mode in localStorage, #4 1207-line `Consulta.tsx`, #5 duplicate `ProtocolPickerModal`, #8 stale CLAUDE.md) are now also reconfirmed by live testing below.

---

## Critical (functional bugs affecting users today)

### L1. The gate is bypassed for the most common entry point

**Symptom.** Clicking "Nueva consulta" from a patient's detail page navigates to `/consultas/nueva?patientId=X` (only patientId in URL). Instead of the gate, the user sees the legacy patient + location picker form. The gate appears _only after_ the user has selected a location from the dropdown.

**Evidence.** `apps/web/src/pages/ConsultaNueva.tsx`:

```ts
const preselectedPatientId = searchParams.get('patientId') ?? ''
const preselectedLocationId = searchParams.get('locationId') ?? ''
// ...
const showGate = Boolean(patientId && locationId)
```

The patient detail's "Nueva consulta" button passes only `patientId`. `PacienteDetalle.tsx` produces a link of the shape `/consultas/nueva?patientId=…` with no `locationId`. So `showGate` is false on first render and the legacy form is shown until the user picks a location.

**Why it matters.** This is the _entire point_ of the redesign. The handoff (`specs/protocol-in-consultation-spec.md`) and the chosen Hybrid flow exist to force a protocol decision before SOAP opens. For the most natural user path — open a patient, click "Nueva consulta" — that decision is currently postponed by an extra screen of friction, and the user can complete the consultation entirely without ever seeing the gate.

**Fix.** Two options, both reasonable:

1. **Make the entry points always pre-fill location.** Defaults could come from the doctor's primary location (`/v1/locations` first item or a `default` flag), the appointment if one exists, or the last-used location for that doctor.
2. **Make the gate work without location.** Show the gate on `?patientId=X` with a small location picker inline above the recent-protocols row. Drop the legacy form entirely. This is the simpler architectural answer — there's no good reason for two different "create consultation" UIs to coexist.

I recommend option 2: the legacy form is dead weight that wasn't supposed to survive the redesign.

---

### L2. The gate's "MÁS PROBABLE" badge lies — confirmed visually

**Symptom.** I created Roberto Castro's _first ever_ consultation. He has 0 prior visits in the system. I created the protocol "HTA — Seguimiento" two minutes earlier. The gate showed:

- HTA — Seguimiento with **"MÁS PROBABLE"** badge prominently
- Subtitle: **"Última: reciente · v2"** — implying recent use with this patient

In a clinical context, "MÁS PROBABLE" combined with "Última: reciente" reads as "this patient has been on this protocol before, you're likely picking it up where you left off." That's a clinically meaningful claim, and it's false.

**Evidence.** Network shows the gate calling `GET /v1/protocols?status=active&sort=updatedAt_desc` — the generic protocol list. There is NO call to `/v1/patients/:patientId/protocol-suggestions` (which is the actual recommendations endpoint, fully implemented in `apps/api/src/modules/protocol-recommendations/` and wired into `app.module.ts`).

The hook in question (`apps/web/src/hooks/consultations/use-protocol-suggestions.ts`) does:

```ts
const { data = [] } = useGetProtocols({ status: 'active', sort: 'updatedAt_desc' })
return { suggestions: data.slice(0, MAX_SUGGESTIONS) }
```

No patient context. Identical results for every patient.

**Why it matters.** Patient safety. A doctor scanning a gate for a new patient may infer the patient has a chronic condition based on which protocol is highlighted as "most probable." Even if the doctor is sophisticated enough to ignore the badge, the labeling "Última: reciente" is factually wrong.

**Fix.** Replace the hook body to call the real endpoint with `patientId`:

```ts
export function useProtocolSuggestions(patientId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['protocol-recommendations', patientId],
    queryFn: () =>
      apiClient.get<ProtocolRecommendation[]>(`/v1/patients/${patientId}/protocol-suggestions`),
    enabled: enabled && Boolean(patientId),
  })
}
```

Update `ConsultationGate.tsx` to pass `patientId`. The backend already exists.

---

### L3. Hardcoded "Dr. Test García" appears for every doctor

**Symptom.** On the gate (`/consultas/nueva?patientId=X&locationId=Y`):

- Subtitle reads `Roberto Castro · Dr. Test García`
- Empty-state body: `Dr. García usa 2.1 protocolos por paciente en promedio.`

Top right shows **Dr. Carlos Feliz** logged in. The two should match.

**Evidence.** `apps/web/src/pages/ConsultaNueva.tsx`:

```tsx
subtitle={`${patientFullName} · Dr. Test García`}
```

The "2.1 protocolos" line is also a hardcoded string, presumably pulled in during initial design implementation as a placeholder and never replaced.

**Why it matters.** Beyond looking unprofessional ("who's Dr. Test García?"), the "2.1 protocolos por paciente en promedio" line is a _fake statistic_ presented as if it were real. In a clinical app this is a credibility problem — if the obvious-looking stat is fake, what else is?

**Fix.** Two changes in `ConsultaNueva.tsx`:

1. Replace `'Dr. Test García'` with the doctor's actual name from `useAuth()`. Use `user.fullName` or compose from what's available.
2. Either source the "2.1 protocolos por paciente" stat from a real endpoint (compute over this doctor's last-N consultations server-side), or remove the line entirely. If the data isn't ready, the line should be removed — fake stats are worse than no stats.

The Consulta page itself (`Consulta.tsx`) does this correctly — it shows "Roberto Castro · Dr. Carlos Feliz" once the consultation opens. The bug is isolated to the gate page.

---

### L4. The original 14 critical findings are all unchanged

For completeness, these were filed in the previous audit and are still active:

1. **Fake suggestions hook** — see L2 above for the live confirmation.
2. **Orphan consultation on partial failure** — `CreateConsultationSchema` still has no `protocolId`. The gate still does two sequential `apiClient.post` calls with the second wrapped in an empty-catch.
3. **View-mode in localStorage, not `User.preferences`** — schema not touched. Doctor's preference doesn't follow them across devices.
4. **`Consulta.tsx` is 1207 lines** — `SoapView.tsx` and `ProtoStep.tsx` still don't exist.
5. **`ProtocolPickerModal` defined twice** — `apps/web/src/components/protocols/ProtocolPickerModal.tsx` is still orphaned; `Consulta.tsx` line 405 still defines its own inline copy.
6. **`Consultation.protocolsApplied` legacy field** — still in `schema.prisma` next to the `protocolUsages` relation.
7. **`protocol-recommendations` vs `protocol-suggestions` naming collision** — both modules still mounted, frontend still confused about which is which.
8. **CLAUDE.md says protocol-to-consultation is "deferred"** — still says it.
9. **CLAUDE.md `@imports` missing several specs** — `protocol-in-consultation-spec.md`, `protocol-engine-slices.md`, `audit-log-spec.md`, etc. not imported.
10. **Routes don't match spec** — actual is `/consultas/nueva`, spec says `/pacientes/:id/consultas/nueva`.
11. **`ProtocolUsage.status` enum drift** — Prisma comment lists three values, TS enum has four (added `'switched'`).
12. **`ProtocolUsage.checkedState` (legacy) coexists with `modifications`** — known dual storage.
13. **Inconsistent API patterns in `ConsultaNueva.tsx`** — gate uses raw `apiClient.post`, fallback uses React Query mutation.
14. **Open questions Q1–Q5 from the handoff likely never answered** — no decision record in `specs/`.

---

## High (UX issues that meaningfully degrade the experience)

### L5. Patient rows aren't clickable — only the eye icon is

**Symptom.** On `/pacientes`, clicking anywhere on a row except the small "Ver paciente" eye icon does nothing. Common UX expectation is row-click → detail.

**Evidence.** `read_page` on `/pacientes` shows only the three action buttons (Ver / Editar / Eliminar) per row are interactive. The patient name, document, age, and status text aren't wrapped in a link or a clickable surface.

**Why it matters.** Doctors using this 30+ times a day will hit-test that small eye icon repeatedly. It's slow on mobile/tablet, and it goes against established table-list patterns (Linear, Notion, Asana, etc.).

**Fix.** Wrap the row body in a `Link` to the patient detail. Keep the explicit action icons for power-user clarity, but the row itself should also navigate.

---

### L6. Status badge "active" is in English while the rest of the UI is Spanish

**Symptom.** On `/protocolos`, the status badge under each protocol reads `active`. The rest of the page uses Spanish — "Nuevo protocolo", "Buscar protocolos…", "Diagnóstico", "Más reciente", etc.

**Evidence.** Visible in the protocols list. By contrast, location type badges on `/ajustes/ubicaciones` show `Propio` / `Externo` (correctly translated). So the localization layer exists; this badge specifically wasn't run through it.

**Why it matters.** Inconsistent localization signals "this app is being built but isn't quite finished." More tactically: the doctor user base is Spanish-first, English protocol status is harder to scan.

**Fix.** Map the protocol status enum (`active | draft | archived`) to Spanish equivalents (`activo | borrador | archivado`) where it's rendered. Single point of fix in whatever helper produces the badge label — probably in `apps/web/src/components/protocols/` or a `lib/strings.ts` helper.

---

### L7. Right rail is not sticky — disappears as you scroll through the SOAP form

**Symptom.** On `/consultas/:id` in SOAP view, the right rail (Protocolos card / Órdenes médicas with prescription tabs) only appears at the top of the page. Scroll down through Subjetivo / Examen físico / Evaluación / Plan and the right rail content is gone — you have to scroll back up to add a prescription or look at the protocol panel.

**Evidence.** Verified by scrolling on a freshly-created empty consultation. The right rail is a sibling block that follows the natural document flow, not a sticky container.

**Why it matters.** A doctor filling out the Plan section often wants to add a prescription at the same time. They shouldn't have to scroll up, scroll down, scroll up. This is hostile to actual clinical workflow.

**Fix.** Make the right rail `position: sticky; top: <header offset>;` so it stays visible while the body scrolls. The container max-height should be `calc(100vh - <offsets>)` with internal scroll if its own content overflows.

---

### L8. The right rail vanishes entirely in PROTOCOLO (canvas) view

**Symptom.** Toggle from SOAP to PROTOCOLO and the right rail disappears completely — no alerts panel, no empty state, just an empty right column. The body shows the protocol step spine on the left only.

**Evidence.** Confirmed visually. The CHANGELOG note (line 349) says: `apps/web/src/components/consultations/CanvasView.tsx: removed inline SOAP rail (now rendered at page level via RightRail); single-column ProtoStep card spine`. So the canvas was specifically designed without a right rail.

**Why it matters.** The handoff's design (`05-hybrid.png`) shows the right rail with ALERTAS and PASOS DEL PROTOCOLO and ÓRDENES even in canvas mode. The current implementation deviates — it hides the right rail completely in canvas, which means in canvas mode the doctor loses access to:

- Allergy and condition alerts (clinically important)
- Prescription/lab order quick actions
- Previous-consultations summary

The view toggle is supposed to be about presentation of the body, not about whether the rail exists.

**Fix.** Keep the right rail mounted regardless of view mode. The body component should be the only thing that swaps between SOAP and Canvas. Move the rail out of the body components and into the page-level layout (this is also why `SoapView.tsx` and `CanvasView.tsx` should be symmetric — both _body-only_).

---

### L9. Page H1 stays "Nueva consulta" forever

**Symptom.** After creating a consultation, the URL becomes `/consultas/{uuid}` and the breadcrumb correctly says `Consulta · 7 may de 2026`. But the H1 still reads **"Nueva consulta"** even hours later, after content has been entered, and presumably even after signing.

**Evidence.** Visible on the consultation page. The handoff's design shows the title transitioning to a date-stamped form once the consultation has any content.

**Why it matters.** The H1 is the strongest visual cue on the page. A doctor reviewing yesterday's consultation should not see "Nueva consulta" as the title — it makes the page feel state-less.

**Fix.** Title should reflect state:

- Status `draft` with no content → "Nueva consulta"
- Status `draft` with any content → date + chief complaint, e.g., "Consulta del 7 may · Seguimiento HTA"
- Status `signed` → "Consulta del 7 may · firmada"

---

### L10. SwitchProtocolDialog renders as anchored popover, not centered modal

**Symptom.** Clicking "Cambiar" in the protocol strip opens the switch-protocol dialog as a popover anchored to the bottom-left of the trigger area. It's small (~470px wide), positioned in the lower-left of the body, and feels like an autocomplete dropdown.

**Evidence.** Confirmed visually. The handoff (`02-components.md`, SwitchProtocolDialog section) describes this as a modal pattern with a centered overlay.

**Why it matters.** Switching protocols mid-consultation is a meaningful action with implications for data continuity. A popover treats it as a casual selection; a modal treats it as a deliberate change. The misplacement also makes the action discoverable only if the user happens to look at the lower-left.

**Fix.** Use the `Modal` primitive (which exists at `apps/web/src/components/ui/Modal.tsx`) instead of whatever popover container is currently wrapping the dialog content. Center on screen, dim background overlay, escape-to-close.

---

### L11. MissingFieldsPanel has an empty white box artifact

**Symptom.** Click "Firmar y cerrar" on a consultation with required fields missing. The MissingFieldsPanel opens with `FALTANTES (3)` overline, then an _empty white row_ with an × close button on the right, then the three missing-field rows. The empty row has no apparent function.

**Evidence.** Confirmed visually. The empty white row sits between the panel header and the first item.

**Why it matters.** Looks like a styling regression or an unused container. Doesn't break functionality, but it's visually distracting on what's supposed to be a focused alert panel.

**Fix.** Inspect `apps/web/src/components/consultations/MissingFieldsPanel.tsx`. Likely a header/divider element with empty text or padding-only that should be removed, or a wrapper that's rendering an extra row.

---

### L12. "Publicar v2" button on a brand-new v1 protocol

**Symptom.** Create a new protocol. The protocol editor loads with a "Publicar v2" button at the top right while the breadcrumb shows `· v1`. The Historial sidebar shows only `v1 · 7 may`. Publishing then increments to v2.

**Evidence.** Reproduced. The button label always reads `Publicar v{currentVersion + 1}`.

**Why it matters.** For a brand-new protocol that's never been published, "Publicar v2" is wrong on its face — there is no v1 yet to be replaced. The mental model should be: v1 is what gets published the first time, v2 is the second iteration, etc. The current behavior treats the saved-but-unpublished draft as v1 already and so always offers v(N+1), which is confusing on the first publish.

**Fix.** When the latest version is unpublished (no `publishedAt`), the button should read `Publicar v1` (or just `Publicar` if you want to drop the version label on first publish). After first publish, subsequent edits should label `Publicar v2`, `Publicar v3`, etc. Logic: `nextVersionLabel = lastPublishedVersion ? `v${lastPublishedVersion + 1}` : 'v1'`.

---

### L13. "2 bloques · 2 secciones" counter is misleading on empty protocols

**Symptom.** A protocol with two empty sections and zero content blocks displays `2 bloques · 2 secciones`. The two are the same two items being counted twice.

**Evidence.** The created HTA — Seguimiento protocol has only the auto-created Motivo and Decisión sections, both showing "Sección sin bloques." The header counter still says `2 bloques · 2 secciones`.

**Why it matters.** Someone authoring a protocol doesn't have a quick way to tell "is this protocol substantive yet?" When the section count equals the block count, the protocol is structurally empty.

**Fix.** Decide on one of:

- Count only leaf blocks (non-section): `0 bloques · 2 secciones`. This is the most informative.
- Drop the bloques count when it equals sections: `2 secciones`.
- Replace with `0 pasos · 2 secciones` (using a "pasos" framing that maps better to clinical use).

---

## Medium (cosmetic, label, or layout)

### L14. "Receta 1" naming and ambiguous medication actions

**Symptom.** The Órdenes médicas right-rail panel shows a header `Receta 1` even before any medication exists. Two buttons are visible: `+ Añadir medicamento` and `+ Nueva receta`. Their semantic distinction isn't obvious.

**Why it matters.** The plural-recetas-per-consultation model is unusual in DR practice — typically a doctor writes one prescription per visit, even if it has multiple drugs. Showing "Receta 1" preemptively suggests there should be a Receta 2, which adds complexity the user may not need.

**Fix.** Two options:

- **Hide the receta header until the first medication is added.** Then it appears as `Receta 1` automatically. If they click "Nueva receta" they get `Receta 2`.
- **Combine to a single flat list.** "Medicamentos" with no receta grouping; only group when they print.

I recommend hiding the header when empty + clarifying what "Nueva receta" actually does (probably a tooltip: "Crear un grupo aparte de medicamentos en la misma consulta").

---

### L15. Date format inconsistency

**Symptom.** Different surfaces use different conventions for the same date:

- Agenda title: `Jueves, 7 De Mayo De 2026` (capitalized "De")
- Consultation header: `JUEVES, 7 DE MAYO DE 2026 · 02:40 A.M.` (all caps)
- Breadcrumb: `Consulta · 7 may de 2026` (short month, lowercase)
- Patient detail birth date: `7 de enero de 1990 (36 años)` (long month, lowercase)

**Why it matters.** Spanish convention is lowercase months and prepositions, with the day either spelled out lowercase or as a number ("jueves 7 de mayo de 2026"). The all-caps version in the consultation header is acceptable as a stylistic choice; the title-case "Jueves, 7 De Mayo De 2026" with capital "De" is grammatically wrong.

**Fix.** Centralize date formatting in `lib/strings.ts` with three formats:

- `formatDateLong(date)` → `"jueves, 7 de mayo de 2026"`
- `formatDateLongOverline(date, location)` → `"JUEVES, 7 DE MAYO DE 2026 · 02:40 A.M. · CONSULTORIO PRIVADO"`
- `formatDateShort(date)` → `"7 may de 2026"`

Use these everywhere. Delete inline formatting in `ConsultaNueva.tsx`, `Agenda.tsx`, etc.

---

### L16. Roberto Castro's document number is unformatted

**Symptom.** Pacientes table shows: Roberto Castro `P12345678`, José Luis Martínez `001-2345678-9`, Carmen Pérez `402-3456789-0`, Ana María Reyes `001-1234567-8`.

**Evidence.** Visible directly. P12345678 is a passport number (no hyphens are standard for DR passports). The others are cédulas with the canonical `XXX-XXXXXXX-X` format.

**Why it matters.** Not really a bug — passports legitimately don't have the same format. But the column header is "CÉDULA / DOCUMENTO", and there's no visual indication that one is a passport and the others are cédulas. A doctor doing data entry might wonder why one row looks "wrong."

**Fix.** Show the document type as a small caption under the document number, or as a chip prefix:

- `001-2345678-9` (CÉDULA)
- `P12345678` (PASAPORTE)

The patient detail page already shows "Pasaporte P12345678" correctly. Mirror that in the table.

---

### L17. "Sin guardar" badge versus unsaved-state semantics

**Symptom.** On the consultation page, three controls live in the top right: a "Sin guardar" pill (with an empty dot indicator), a "Guardar borrador" button, and "Firmar y cerrar".

**Why it matters.** The "Sin guardar" badge is a state indicator, but the "Guardar borrador" button next to it is an action. A user may not immediately tell if "Sin guardar" is informational or clickable. There's no autosave indicator to confirm work is being preserved.

**Fix.** Add autosave with visible state:

- `Guardando…` while in flight
- `Guardado · hace 12s` when idle
- `Sin conexión — borrador local` when offline

Keep "Firmar y cerrar" as the primary action. Drop the manual "Guardar borrador" once autosave is reliable.

---

### L18. Empty state: "Aún no tienes protocolos configurados para tu clínica..."

**Symptom.** Empty state on the gate when 0 protocols exist reads:

> Aún no tienes protocolos configurados para tu clínica. Puedes empezar sin protocolo o instalar uno desde la biblioteca.

The phrase "empezar sin protocolo" is awkward Spanish — sounds machine-translated. "Empezar" needs an object: "empezar la consulta," "empezar sin guía," etc.

**Fix.** Suggested rewrite:

> Todavía no tienes protocolos en tu biblioteca. Puedes iniciar la consulta sin guía o instalar uno desde la biblioteca de plantillas.

Run all empty-state strings past a native speaker once.

---

## Low (nits and minor inconsistencies)

### L19. "Saltar y abrir consulta vacía" is verbose

The "Saltar y abrir consulta vacía" button on the gate is grammatically correct but takes two lines on narrower viewports. Shorter alternatives: "Abrir consulta vacía" or just "Saltar paso".

### L20. Sidebar nav doesn't highlight when on consultation routes

Visiting `/consultas/nueva` or `/consultas/:id` leaves all sidebar items un-highlighted. Either Pacientes (the parent context) or a "Consultas" item should remain highlighted. This is a navigation memory cue users rely on.

### L21. Patient detail page title overlap

On `/pacientes/{id}`, the back link `← Pacientes` and the `Editar` button are both at the top, but there's no clear breadcrumb structure. The convention used elsewhere is `Pacientes > Roberto Castro` as breadcrumbs. Make this consistent.

### L22. CHANGELOG repetition

Multiple entries dated `2026-05-06` describe the same week's work. Three entries from the same day with overlapping scopes is hard to bisect. Consider rolling per-day work into one entry per logical change set.

### L23. Login screen wasn't audited

I came in already logged in, so the login flow itself wasn't tested. Worth verifying:

- Wrong-password feedback
- Empty-field validation
- Session-timeout behavior
- Provision-on-first-login flow
- Email verification (if any)

---

## What's working well

To balance the list of defects, real strengths to keep building on:

- **Runtime stability.** No console errors anywhere I navigated. All API calls returned 200. The auth flow is invisible (in the good sense). The recent auth refactor abstracted Firebase cleanly.
- **Visual fidelity (when it renders).** The gate, strip, and canvas previews match the handoff frames very closely. Source Serif 4, the teal accent rule, and Phosphor Icons are applied consistently.
- **Empty states.** Almost every list has a thoughtful empty state with a clear CTA. This is unusually good.
- **Test coverage.** 1573+ tests passing with 90%+ coverage was reported in CHANGELOG and held through the auth refactor.
- **Audit log infrastructure.** Comprehensive, tenant-scoped, and integrated as a NestJS interceptor.
- **CHANGELOG hygiene.** File-level detail makes the recent history bisectable (mostly — see L22).
- **Storybook + preview routes.** Having `_preview/*` routes for component states is excellent — that's what made it possible to visually check the gate and canvas without auth or seed data.

---

## Recommended order for fixes

If only top-three this week, fix in this order — each is small, each blocks the next:

1. **L1 + L2 together** — gate routing + fake suggestions hook. Together they restore the core redesign value. Maybe a day of work.
2. **L3** — hardcoded "Dr. Test García" plus the fake stat. Twenty minutes; embarrassingly visible.
3. **L7** — make the right rail sticky. One CSS change with significant daily-workflow impact.

After those, the SoapView extraction (#4 from the original audit, still unfixed) is the highest-leverage refactor. Schedule it before the consultation module gets any new feature.
