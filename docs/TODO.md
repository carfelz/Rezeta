# TODO — Historia Médica follow-ups

> Status snapshot 2026-07-07. Source: final reviews of PR #27 (historia médica) and PR #28
> (run-mode vitals/notes capture). Items 1–5 also exist as Claude Code task chips.

## Pending code tasks

1. **Expose historia médica version history** — prior `ConsultationRecord` versions
   (created after amendments) are retained append-only but unreachable: no version list in
   `GET /v1/consultations/:id/record`, no UI. Spec §7.2 promised it. API: extend the GET
   response or add `…/record/versions`. UI: read-only version selector in
   `RecordDocument.tsx` when >1 version exists, each with its own PDF download.

2. **Fix consultation-record version race (P2002)** — `ensureDraft`/`regenerate`
   (`consultation-records.service.ts`) compute `versionNumber` optimistically; concurrent
   calls collide on `@@unique([consultationId, versionNumber])` and the loser surfaces a raw
   500. Catch P2002 → re-read `findLatest` / retry once.

3. **Make editor crash-recovery drafts mapping-aware** — `saveLocalDraft`
   (`apps/web/src/store/editor.store.ts`) persists only `blocks`; a `historia_mapping`-only
   edit isn't recoverable after a crash. Extend the payload + restore path, keeping
   backward compat with blocks-only stored drafts.

4. **Decide CIE/ICD coding for definitive diagnoses** *(research/decision, no code)* —
   DR Reglamento §6.12.4 formally requires CIE coding of definitive diagnoses; conflicts
   with the project's "no ICD-10, free-text diagnoses" convention (CLAUDE.md). Produce a
   short decision doc: optional CIE-10 typeahead field vs. free-text-primary vs. full
   coding; consider solo-specialist UX, ARS/SISALRIL audit expectations, CIE-10-ES data
   licensing, and where codes would live in the record sections model.

5. **Add optimistic-concurrency guard to usage content updates** — PR #28 introduced the
   first client path that replaces `ProtocolUsage.content` wholesale; two tabs on the same
   open consultation last-write-wins the entire content. Add a stale-write precondition
   (updatedAt / revision counter → 409 `PROTOCOL_USAGE_STALE` + Spanish reload toast).
   Modification-event-only PATCHes stay unaffected (append-only merge).

## Untracked but recommended

6. **Seeded-template audit for historia quality** — generated historias map content by
   `clinical_notes` labels ("Motivo de consulta", "Diagnóstico", …) and vitals blocks.
   Audit/enrich the seeded templates (`apps/api/src/lib/starter-fixtures/`,
   `packages/db/src/seed.ts`) so out-of-the-box protocols produce well-mapped historias.
   Content task more than code.

7. ~~**Dogfooding pass**~~ — done 2026-07-07: a live manual pass through the consultation
   flow (fill vitals/notes → sign → order queue → historia) surfaced 17 findings, fixed on
   `fix/e2e-consultation-flow-findings` (see `CHANGELOG.md` entries dated 2026-07-07 and
   `docs/superpowers/plans/2026-07-07-06-e2e-findings-fixes.md`). Historia PDF
   download/export expediente were not covered by that pass — still worth a follow-up
   click-through.

## Follow-ups from the E2E consultation flow fixes (2026-07-07)

8. **F7 recurrence** — root cause was a non-settling request (no timeout); if a dead-save
   recurs, capture HAR + console before reload.
9. **UX**: consolidate duplicated Obligatorio toggle in template editor `clinical_notes`
   detail panel (header + panel bind same state).
10. **`settings/AuditLog` `ENTITY_TYPE_LABELS`** lacks `Onboarding`/`ConsultationRecord`
    entries (falls back to raw string).
11. **Order flush**: silent per-mutation toasts double up with `errorFlushOrders` on
    failure; consider a silent flag. Also on success, each persisted group fires its own
    success toast — a multi-group sign produces a per-group success-toast storm; suppress
    per-mutation success toasts during a flush too.
12. **Test: imaging flush path** in `use-flush-order-queue` (code-identical to tested
    meds/labs; 5-line test).
13. **Test: read-only single-label regression** for `clinical_notes`/`vitals` in
    `BlockRenderer` non-chromeless path.
14. **Order flush retry**: a create that times out client-side after succeeding
    server-side re-POSTs on retry (no idempotency key) — consider idempotency or
    reconciliation.

## Deliberately deferred (product decisions on record)

- **INDOTEL digital-signature certificate** (Reglamento §8.14.k) — the "sign" steps are
  application-level signatures for now; a certified digital signature is a future
  iteration. Recorded as a non-goal in
  `docs/superpowers/specs/2026-07-06-historia-medica-design.md` §11.
