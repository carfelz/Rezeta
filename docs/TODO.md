# TODO — Historia Médica follow-ups

> Status snapshot 2026-07-07. Source: final reviews of PR #27 (historia médica) and PR #28
> (run-mode vitals/notes capture). Items 1–5 also exist as Claude Code task chips.

## Pending code tasks

1. ~~**Expose historia médica version history**~~ — done 2026-07-08: API adds
   `GET …/record/versions` and `GET …/record/versions/:versionNumber` (`a440a45`); web UI
   adds a read-only version selector in `RecordDocument.tsx`, each version with its own PDF
   download (`de26a80`, `9ef2a5b`).

2. ~~**Fix consultation-record version race (P2002)**~~ — done 2026-07-08: `ensureDraft`
   re-reads `findLatest` on P2002 and returns the racing winner instead of erroring;
   `regenerate` re-reads and retries the create once, rethrowing on a second collision
   (`feacfe6`).

3. ~~**Make editor crash-recovery drafts mapping-aware**~~ — done 2026-07-08:
   `saveLocalDraft`/`loadLocalDraft` (`apps/web/src/store/editor.store.ts`) persist and
   restore `historia_mapping` alongside `blocks`; old blocks-only drafts still load fine
   (`79d9764`).

4. **Decide CIE/ICD coding for definitive diagnoses** — decision doc drafted 2026-07-08;
   decision on 2026-07-12: **deferred** pending verification that historia clínica diagnosis
   CIE coding is actually inspected in a DR ARS/MISPAS audit (the load-bearing §3 assumption).
   Free-text convention in `CLAUDE.md` stands unchanged until then. Doc stays DRAFT:
   `docs/superpowers/specs/2026-07-08-cie-coding-decision.md` (`8602dbf`).

5. ~~**Add optimistic-concurrency guard to usage content updates**~~ — done 2026-07-08:
   `expectedUpdatedAt` precondition on `updateProtocolUsage` rejects a stale `content`
   write with 409 `PROTOCOL_USAGE_STALE` + Spanish reload toast; modification-only PATCHes
   are unaffected (`146c764`).

## Untracked but recommended

6. ~~**Seeded-template audit for historia quality**~~ — done 2026-07-08: both seed
   fixtures (`apps/api/src/lib/starter-fixtures/index.ts`, `packages/db/src/seed.ts`) gain
   `clinical_notes`/`vitals` blocks that route to motivo/diagnóstico/plan/evolución/examen
   físico (`b9dd7e6`).

7. ~~**Dogfooding pass**~~ — done 2026-07-07: a live manual pass through the consultation
   flow (fill vitals/notes → sign → order queue → historia) surfaced 17 findings, fixed on
   `fix/e2e-consultation-flow-findings` (see `CHANGELOG.md` entries dated 2026-07-07 and
   `docs/superpowers/plans/2026-07-07-06-e2e-findings-fixes.md`). Historia PDF
   download/export expediente were not covered by that pass — still worth a follow-up
   click-through.

## Follow-ups from the E2E consultation flow fixes (2026-07-07)

8. **F7 recurrence** — root cause was a non-settling request (no timeout); if a dead-save
   recurs, capture HAR + console before reload.
9. ~~**UX**: consolidate duplicated Obligatorio toggle~~ — done 2026-07-08: the
   `clinical_notes` detail panel no longer duplicates the checkbox; the header toggle is
   the single control of `required` (`782d39c`).
10. ~~**`settings/AuditLog` `ENTITY_TYPE_LABELS`**~~ — done 2026-07-08: gains
    `Onboarding`/`ConsultationRecord` plus the remaining kebab-case/historical entity keys
    (falls back to a friendly label instead of the raw string) (`782d39c`).
11. ~~**Order flush**: silent per-mutation toasts~~ — done 2026-07-08: the three order
    create hooks take `opts?: { silent }`; the flush passes `{ silent: true }` on all three
    so a multi-group sign no longer produces a per-group toast storm, leaving only the
    single `errorFlushOrders` on failure (`9b03617`).
12. ~~**Test: imaging flush path**~~ — done 2026-07-08:
    `use-flush-order-queue.test.ts` gains an imaging-group flush case (`9b03617`).
13. ~~**Test: read-only single-label regression**~~ — done 2026-07-08: new
    `BlockRenderer.vitals-notes.test.tsx` pins single-label rendering for
    `clinical_notes`/`vitals` in the non-chromeless path (`782d39c`).
14. ~~**Order flush retry**~~ — done 2026-07-08: `Prescription`/`ImagingOrder`/`LabOrder`
    gain `clientRequestId` + a `(consultationId, clientRequestId)` unique constraint; a
    P2002 on retry returns the already-created row instead of duplicating (`f84932a`).
15. ~~**Watch: order-queue snapshot lost across reload**~~ — done 2026-07-08: the
    suspected race — the mirror effect in `use-order-queue-session.ts` running against
    pre-restore values while racing the restore effect on mount/`consultationId` change —
    was hardened defensively with a `hydrated` ref gate so the mirror effect never runs on
    pre-restore values (`77de51e`), and hydrate-on-every-path behavior (every restore-effect
    exit sets `hydrated.current = true`) is pinned with four new test cases (`b6afb41`). The
    original repro was never reproduced: under React's effect ordering, the two effects run
    in declaration order within the same commit, so the interleaving the gate guards against
    cannot even be observed as false in this codebase today — this is defensive hardening,
    not a confirmed root-cause fix.

## Deliberately deferred (product decisions on record)

- **INDOTEL digital-signature certificate** (Reglamento §8.14.k) — the "sign" steps are
  application-level signatures for now; a certified digital signature is a future
  iteration. Recorded as a non-goal in
  `docs/superpowers/specs/2026-07-06-historia-medica-design.md` §11.
