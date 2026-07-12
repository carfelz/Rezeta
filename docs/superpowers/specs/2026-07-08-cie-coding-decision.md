# CIE/ICD coding for definitive diagnoses — decision doc

> **STATUS: DRAFT — pending Carlos's decision**
> Date: 2026-07-08 · Author: Claude (research), decision owner: Carlos Feliz
> Raised by: `docs/superpowers/specs/2026-07-06-historia-medica-design.md` §2, which flagged this
> conflict as out of scope for the historia médica feature and deferred it here.

## 1. The conflict

DR's **Reglamento Técnico para la Gestión del Expediente Clínico** (MISPAS, 2ª ed. 2023,
Resolución 0013-2023) **§6.12.4** formally requires that definitive diagnoses in the clinical
record be coded using CIE (the Spanish-language name for ICD, WHO's International Classification
of Diseases).

`CLAUDE.md` "Domain Conventions" currently states the opposite: **"No ICD-10 coding — diagnoses
are free-text. Latin American markets do not typically use ICD-10 in ambulatory care."**

Today, diagnoses have no structured field at all — they live as free text inside a
`clinical_notes` block (`{ type: 'clinical_notes', label, content: string }` in
`ProtocolUsage.content`) whose label happens to normalize to "diagnóstico". The historia médica
generator (`generateRecordSections`) matches on that label to build the `diagnosticos` record
section. Nothing today validates, structures, or codes that text. This doc is scoped narrowly:
**should Rezeta add CIE coding to definitive diagnoses, and if so, how much?**

## 2. Options

### Option A — Optional CIE-10 typeahead alongside free text
Doctor types the diagnosis as free text (unchanged UX). A typeahead suggests matching CIE-10
codes as they type; if they pick one, a `code` is stored alongside the text. Free text remains
valid and sufficient on its own — nothing blocks saving or signing without a code.

- **Pros:** satisfies §6.12.4 for doctors who choose to code, at near-zero UX cost for those who
  don't; matches the "solo specialist, low friction" product principle; incremental — ships
  schema support now, UI later.
- **Cons:** doesn't *fully* satisfy §6.12.4 (which reads as mandatory), so some compliance risk
  remains for uncoded records; typeahead needs a licensed/curated code+label dataset (§3).

### Option B — Free-text only, document the compliance risk
Keep the current convention exactly as-is. Add a note to the historia médica doc (and/or a risk
register) acknowledging that definitive diagnoses are not CIE-coded, contrary to §6.12.4.

- **Pros:** zero implementation cost; consistent with "diagnoses are free-text" and the broader
  MVP philosophy of not building infrastructure ahead of demonstrated need.
- **Cons:** leaves a known, named regulatory gap open indefinitely; if MISPAS or an ARS audit
  enforces §6.12.4 literally, every historia in the system is non-compliant on this one field;
  weakest position if a doctor's records are ever formally audited.

### Option C — Mandatory CIE coding on all definitive diagnoses
Diagnosis entries become a structured field with a required `code` (validated against a CIE-10
dataset) plus free text. Consultation cannot be signed without a coded definitive diagnosis.

- **Pros:** fully satisfies §6.12.4; enables downstream reporting/analytics by diagnosis code
  (useful for SISALRIL/ARS claims data if ever pursued).
- **Cons:** directly reverses the CLAUDE.md convention and adds real friction to every
  consultation for a solo-specialist product whose stated differentiator is low-friction
  documentation; requires a licensed, versioned code dataset with search UX good enough not to
  slow doctors down; presumptive (non-definitive) diagnoses would need a separate rule, adding
  scope. Out of proportion to a v1.5-stage product.

## 3. Considerations

- **ARS/SISALRIL audit expectations (assumption, not verified):** SISALRIL's provider claims
  catalog (`consultacps`) uses an internal "SIMON" code, not CIE, for billing line items. Whether
  SISALRIL or MISPAS inspections check historia clínica diagnosis coding specifically (vs. billing
  codes) was not confirmed via public sources in this pass — **treat as an assumption to validate**
  with a colleague who has been through an ARS/MISPAS audit, not a confirmed fact.
- **Licensing/data source:** WHO's classic ICD-10 requires a non-exclusive, time-limited license
  from WHO to redistribute; it is not simply public domain. Spain's **CIE-10-ES** (Ministerio de
  Sanidad, latest edition 2024) is a localized, Spanish-language clinical-modification dataset —
  licensing terms for embedding it in a commercial product were not confirmed here. WHO's newer
  **ICD-11** is openly licensed (CC BY-ND 3.0 IGO) and free to use, but is not what §6.12.4 or DR
  practice references (DR's own MSP portal, `msp.gob.do`, offers a free CIE-10 lookup tool, which
  suggests DR practice is anchored to CIE-10, not CIE-11). **Recommend confirming CIE-10-ES (or
  MSP's own code set) licensing terms before committing to any dataset**, regardless of which
  option is chosen.
- **Where a code would live (schema sketch, not a commitment):** a `code` field on the diagnosis
  entry — today that means an optional `code?: string` alongside `content` on the `clinical_notes`
  block payload, or a new discriminated block subtype if diagnoses need to become structured
  entries rather than a single free-text blob. On the historia side, `generateRecordSections`
  would render a `codes` list (or inline `(CIE-10: J06.9)` suffixes) into the `diagnosticos`
  record section next to the existing free text. No Prisma schema change is required to stay
  schema-tolerant: `ProtocolUsage.content` is already JSONB.

## 4. Recommendation

**Option A, phased:**
1. **Now (schema-tolerant):** no code changes beyond staying schema-tolerant — don't add anything
   that would block a future optional `code` field on diagnosis content. No commitment to a
   dataset or UI yet.
2. **v1.5:** ship the optional CIE-10 typeahead described in Option A — free text stays primary,
   a code is stored only when the doctor picks one from the typeahead, nothing about signing or
   validation changes for doctors who skip it.

This keeps the low-friction, free-text-first convention intact for the common case, narrows the
§6.12.4 compliance gap for doctors who want it, and avoids committing to a licensed dataset or a
mandatory-coding UX before the licensing question in §3 is resolved.

---

**Decision (2026-07-12, Carlos):** **Deferred** — do not adopt A, B, or C yet. The §3
"ARS/SISALRIL audit expectations" point is an unverified assumption, and it is load-bearing:
whether MISPAS/ARS inspections actually check historia clínica diagnosis coding (vs. billing
codes) determines whether §6.12.4 is a real compliance risk or a dormant one. Confirm this with
someone who has been through an ARS/MISPAS audit before choosing an option.

**Blocking action before this can be re-decided:** verify whether historia clínica definitive-
diagnosis CIE coding is actually inspected in a DR ARS/MISPAS audit. Until then this doc stays
DRAFT and the current free-text convention in `CLAUDE.md` stands unchanged.
