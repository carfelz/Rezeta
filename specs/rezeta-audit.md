# Rezeta — Code Audit

Based on a read of `carfelz/Rezeta` at `main` (commit ~7 May 2026). Findings are ordered by severity. For each: the symptom, the evidence, why it's a problem, and what to do.

---

## Critical (functional bugs that affect users today)

### 1. The gate's "suggested protocols" are fake — every patient sees the same list

**Symptom.** The consultation gate (`ConsultationGate.tsx`) shows a row labeled `PARA {patient} · SUS CONSULTAS ANTERIORES` with "MÁS PROBABLE" highlighted on the top card. This UI implies the cards are ranked based on what this doctor has actually used with this patient before.

**Evidence.** The hook powering it is a no-op for the personalization aspect:

```ts
// apps/web/src/hooks/consultations/use-protocol-suggestions.ts
export function useProtocolSuggestions(enabled: boolean) {
  const { data = [] } = useGetProtocols({
    status: 'active',
    sort: 'updatedAt_desc',
  })
  return { suggestions: data.slice(0, MAX_SUGGESTIONS), ... }
}
```

It calls the generic protocols list endpoint sorted by `updatedAt_desc`. There is no `patientId`, no `userId`, no ranking logic. Every patient sees the same four protocols.

Meanwhile, the API has a fully-built `ProtocolRecommendationsModule` mounted at `GET /v1/patients/:patientId/protocol-suggestions` — controller, service, repository, tests, all wired into `app.module.ts`. The frontend just doesn't call it.

**Why it matters.** This is the single biggest lever the redesign was supposed to pull. The handoff's Slice 2 acceptance criterion #2 reads: _"Top-3 cards prioritise protocols this doctor has used with this patient before."_ It's not implemented, but the UI is lying about it being implemented — which is worse than not having the feature.

**Fix.** Replace the body of `use-protocol-suggestions.ts` to call `/v1/patients/${patientId}/protocol-suggestions`, take a `patientId` argument, and pass it from `ConsultationGate.tsx`. The backend module is ready.

---

### 2. The gate creates orphan consultations on partial failure

**Symptom.** If a doctor picks "Seguimiento HTA" on the gate and the protocol attachment fails for any reason (network blip, validation, race), the doctor lands on a blank consultation with no protocol — and the failure is swallowed silently.

**Evidence.** `ConsultaNueva.tsx`:

```ts
const consultation = await apiClient.post('/v1/consultations', { patientId, ... })
if (protocolId) {
  try {
    await apiClient.post(`/v1/consultations/${consultation.id}/protocols`, { protocolId })
  } catch {
    // Non-fatal: consultation was created; protocol can be added from inside
  }
}
void navigate(`/consultas/${consultation.id}`, { replace: true })
```

The two operations are not atomic. The catch block discards the error.

The handoff Slice 2 explicitly required: _"Modify `POST /v1/consultations` to accept `protocolId?`. Implement 'create + addUsage' atomic path. Clicking a card creates the consultation + adds the protocol in one round trip."_ This wasn't done — `CreateConsultationSchema` in `packages/shared/src/schemas/consultation.ts` has no `protocolId` field.

**Why it matters.** Beyond the silent-failure UX issue, this also defeats the gate's purpose. The point of the gate is that the doctor commits to a protocol _before_ SOAP opens. If they land on a SOAP form with no protocol attached, they're back to the original problem the redesign was supposed to fix.

**Fix.** Add optional `protocolId` to `CreateConsultationSchema`, plumb it through the controller and service so the consultation row + first ProtocolUsage row are written in one transaction. Then collapse the two `apiClient.post` calls in `ConsultaNueva.tsx` into one, and use the `useCreateConsultation` mutation hook for cache invalidation consistency (see also Finding #11).

---

### 3. View-mode preference uses localStorage and doesn't follow the doctor

**Symptom.** A doctor who sets their preferred view mode (SOAP vs Canvas) on one device starts fresh on every other device, in incognito sessions, and after clearing browser data.

**Evidence.** `User` model in `packages/db/prisma/schema.prisma` has no `preferences` field. The hook `use-consultation-view-mode.ts` (per the changelog) stores under `localStorage` key `rezeta:consultation-view-mode`.

The handoff's Q3 (open question that was supposed to be answered before Slice 3) was specifically: _"View-mode persistence: per-doctor or per-consultation?"_ with a recommendation of per-doctor stored on `User.preferences`. The implementation chose the third option (per-browser via localStorage) without that being asked, and skipped adding the schema field.

**Why it matters.** The handoff Slice 3 acceptance criterion #5 reads: _"Toggle persists across refresh and across sessions."_ Across browser sessions on the same device, yes. Across devices, no. For a doctor who works at 2-4 health centers per week (per CLAUDE.md), this matters more than usual.

**Fix.** Either (a) accept that localStorage is fine and update the spec/handoff to match, or (b) add `preferences Json @default("{}")` to the User model, write a migration, and switch the hook to read/write through a new `/v1/users/me/preferences` PATCH endpoint with localStorage as a fallback for offline/lag.

---

## High (architectural drift that will produce more bugs)

### 4. `Consulta.tsx` is a 1207-line god component — the SOAP extraction the handoff required never happened

**Symptom.** The main consultation page has 1207 lines containing: types, helpers, `SaveBadge`, `VitalInput`, `VitalsSection`, `DiagnosesSection`, `SectionBlock`, `SoapTextarea`, an inline `ProtocolPickerModal` (see #5), `SignModal`, `AmendmentModal`, `AsideCard`, and the page itself. Any change here requires holding 1200 lines in your head.

**Evidence.** `04-code-mapping.md` in the handoff explicitly required the extractions:

> | `components/consultations/SoapView.tsx` | Extracted from `pages/Consulta.tsx`. |
> | `components/consultations/ProtoStep.tsx` | Single step in Canvas view. |
> | `pages/Consulta.tsx` | Delete current SOAP markup → moves to `SoapView.tsx`. Mount `ProtocolStrip`, `ResumeBanner`, `MissingFieldsPanel`, view-mode-aware body. |

`find apps/web -iname "SoapView*" -o -iname "ProtoStep*"` returns nothing. Neither file exists.

**Why it matters.** Every future change to SOAP rendering will land in the god component. The redesign explicitly called for this extraction so the SOAP and Canvas views are interchangeable bodies the page mounts based on `viewMode`. Right now, Canvas is a side-mount and SOAP is the page itself — they're not symmetric, which makes the toggle harder to reason about.

**Fix.** Extract `SoapView.tsx` (everything currently rendered when `viewMode === 'soap'`), then mount it conditionally:

```tsx
{viewMode === 'soap' ? <SoapView ... /> : <CanvasView ... />}
```

`Consulta.tsx` should end up around 200–300 lines — page-level state, layout, header, strip, both view mounts, dialogs.

---

### 5. `ProtocolPickerModal` is defined twice — the dedicated file is orphaned

**Symptom.** Future maintenance changes to the protocol picker may go to the wrong file and silently not take effect.

**Evidence.** `apps/web/src/components/protocols/ProtocolPickerModal.tsx` exists as a standalone component. `apps/web/src/pages/Consulta.tsx` line 405 defines its own local `function ProtocolPickerModal(...)` and uses that one (line 1148) without importing the dedicated file.

**Why it matters.** Two implementations with the same name will diverge. A bug fix applied to one won't appear in the other. The dedicated file may have features the inline one lacks (or vice versa).

**Fix.** Diff the two implementations, pick the better one, delete the other, import the survivor.

---

### 6. `Consultation.protocolsApplied` legacy field shadows the `ProtocolUsage` relation

**Symptom.** Two ways to know "what protocols were used in this consultation" — a `String[]` on Consultation, and a `ProtocolUsage[]` relation. Future analytics, exports, or audit queries may use one and miss data that's only in the other.

**Evidence.** From `packages/db/prisma/schema.prisma`:

```prisma
model Consultation {
  ...
  protocolsApplied String[]  @default([]) @map("protocols_applied")
  protocolUsages   ProtocolUsage[]
}
```

No comment marking `protocolsApplied` as legacy. No migration plan to remove it.

**Why it matters.** `protocolsApplied` predates the protocol engine. Anything that writes only to one source will produce inconsistent reads. This is the kind of bug that surfaces six months later as "why does the dashboard say X but the export says Y?"

**Fix.** Add a `// LEGACY — superseded by protocolUsages relation. Do not write.` comment, then either backfill + drop in a migration, or build a view/getter that reconciles the two so consumers don't have to choose.

---

### 7. `protocol-recommendations` and `protocol-suggestions` are different things with collision-prone names

**Symptom.** Whenever you (or Claude Code) read a file mentioning "protocol suggestions", you have to re-derive which of the two systems is meant.

**Evidence.** Two API modules that are conceptually unrelated:

- `ProtocolRecommendationsController` → `GET /v1/patients/:patientId/protocol-suggestions` — ranked recommendations for the gate based on patient/doctor history.
- `ProtocolSuggestionsController` → `GET /v1/protocols/:protocolId/suggestions` — accumulated improvements doctors have suggested for a protocol template (the learning system).

The frontend only has `useProtocolSuggestions` (which, per #1, doesn't call either endpoint correctly). When a future feature wants to call the recommendations endpoint, naming a hook will be confusing.

**Why it matters.** The user-facing word "suggestions" is doing double duty in the URL, the backend module names, and any future frontend hooks. The eventual collision is when someone writes `useProtocolSuggestions` thinking "the gate ones" and gets back the other set, or vice versa.

**Fix.** Rename one of them. The cleanest split: keep `protocol-suggestions` for the learning system (matches the existing `ProtocolSuggestion` Prisma model), and rename the gate one to `protocol-recommendations` end-to-end including the URL: `GET /v1/patients/:patientId/protocol-recommendations`. The frontend hook for the gate becomes `useProtocolRecommendations(patientId)`.

---

## Medium (documentation drift and spec/code disagreement)

### 8. CLAUDE.md is stale — says protocol-to-consultation is deferred while it's heavily under development

**Symptom.** Every Claude Code session starts with instructions that contradict the actual state of the codebase. New work on consultation features begins from a wrong premise.

**Evidence.** CLAUDE.md "Current Version" section:

> **v0.0.1 — MVP shipped (2026-05-01).** All seven MVP modules are complete and deployed.
> Features explicitly deferred: ... protocol-to-consultation integration.

But `apps/web/src/components/consultations/` contains 13 files implementing exactly that, with full test coverage, plus matching backend.

**Fix.** Update CLAUDE.md's "Current Version" section to reflect that protocol-to-consultation integration is in active development (Hybrid redesign per `specs/protocol-in-consultation-spec.md`). Move it out of "deferred."

---

### 9. CLAUDE.md `@imports` list is missing several specs that actually exist

**Evidence.** CLAUDE.md imports the original design and mvp specs. The `specs/` folder also contains, but CLAUDE.md does not import:

- `specs/protocol-in-consultation-spec.md` (1729 lines — the authoritative spec for the current work)
- `specs/protocol-engine-slices.md`
- `specs/remaining-mvp-slices.md`
- `specs/audit-log-spec.md`
- `specs/audit-log-implementation-prompt.md`

**Why it matters.** Code can't `@`-reference what it doesn't know exists. When implementing slices, it'll guess instead of consulting the spec.

**Fix.** Add the relevant ones to CLAUDE.md's import list. Consider also adding a `specs/README.md` index so future specs get discovered automatically rather than requiring CLAUDE.md updates each time.

---

### 10. Routes don't match the spec

**Evidence.**

- CLAUDE.md/handoff says: `/pacientes/:id/consultas/:id`
- `App.tsx` has: `/consultas/:id` and `/consultas/nueva` (no patient nesting)

**Why it matters.** Anyone designing future deep links, breadcrumbs, or sharing flows from the spec will assume nested routes. Whoever uses the actual app will do something different. Eventually a feature ships against the wrong assumption.

**Fix.** Either reconcile by nesting the routes (more work, requires updating all internal links and `useNavigate` calls) or update the spec and CLAUDE.md to match the actual flat routing. The flat version is fine — it's just a doc/code drift issue.

---

### 11. `ProtocolUsage.status` enum drift between Prisma comment and TypeScript

**Evidence.**

```prisma
status String @default("in_progress") @db.VarChar(20) // in_progress | completed | abandoned
```

But `packages/shared/src/types/protocol.ts` was extended with `'switched'` (per recent changelog), making the actual valid set `in_progress | completed | abandoned | switched`.

**Why it matters.** The DB column is `varchar(20)` with no constraint, so it works at runtime. But anyone reading the schema (a new contributor, Claude Code in a new session) will believe the comment and may treat `'switched'` as invalid.

**Fix.** Update the Prisma comment to include `switched`. Better, define a single source of truth (a TS const or a Postgres `CHECK` constraint) and stop trusting comments.

---

## Low (tech debt and code smells)

### 12. `ProtocolUsage` has both `checkedState` (legacy) and `modifications` (current)

Schema acknowledges this in a comment: `// Legacy field kept for backward compat with existing code`. Acceptable for now, but the path to removing `checkedState` should be planned — every consumer that still reads it adds future migration cost.

### 13. Inconsistent API patterns in `ConsultaNueva.tsx`

The "show gate" branch uses raw `apiClient.post`. The "fallback picker" branch uses `useCreateConsultation` mutation. This means React Query's cache invalidation runs in one branch and not the other — patients/consultations lists may be stale after a gate-flow creation. Pick one pattern (the mutation hook) and use it everywhere.

### 14. The handoff's open questions Q1–Q5 were almost certainly never answered before implementation

The handoff explicitly flagged these as blocking Slice 1 (specifically Q3 was a Slice 3 blocker). There's no `06-open-questions.md` answers file in `specs/`, no commit referencing the questions, and Q3's actual outcome (localStorage) wasn't a listed option. Future open-questions checkpoints should produce a written decision record in `specs/decisions/` so Code can cite the answer rather than re-derive it.

---

## What's working well (keep doing this)

- **Auth provider abstraction.** The recent refactor (`apps/api/src/lib/auth/`) cleanly isolates Firebase behind an `IAuthProvider` interface. Excellent boundary work — swapping auth providers is now plausible.
- **Test coverage discipline.** 1573 tests passing, 90%+ coverage across all packages, enforced via CI. CHANGELOG entries explicitly cite coverage numbers per change.
- **Audit log infrastructure.** `apps/api/src/common/audit-log/` plus the `AuditLog` Prisma model is comprehensive — tenant-scoped, with redaction rules for sensitive fields, integrated as a NestJS interceptor.
- **Design system rigor.** `apps/web/src/components/ui/` has 30+ primitives with Storybook stories and tests for all of them. Tokens-only, no raw hex, consistent.
- **CHANGELOG hygiene.** Entries are detailed, file-level, dated, and ordered. Easy to bisect "when did X start drifting."
- **Storybook in routine use.** Multiple new components have `.stories.tsx` files alongside, used as a live spec.

---

## Recommended order of operations

If you only have time for the top three this week:

1. **Fix #1 (fake suggestions hook).** Highest user impact, smallest code change. The backend already exists; this is a 30-line frontend swap.
2. **Fix #2 (atomic create-with-protocol).** Eliminates the orphan-consultation class of bug. One schema field, one service method change, one frontend collapse.
3. **Fix #8 (CLAUDE.md staleness).** Smallest change, highest leverage on every subsequent Claude Code session. Five-minute edit.

After those, the SOAP extraction (#4) is the biggest force-multiplier on future work in the consultation module.

The data model issues (#6, #11, #12) are not urgent but get harder to fix the longer they're left. Schedule a "data model cleanup" PR within the next month.

The naming collision (#7) is a "do it now while there are zero callers in collision territory" situation. Once a feature ships using one of the names, the rename gets harder.
