# Consultation Module Redesign — Handoff Package

**Direction locked:** Hybrid (Flow F gate + Flow E canvas as a per-doctor mode toggle)
**Source mocks:** `Flow Hybrid — Gate + Mode Toggle.html`, `Edge Cases - Consultation.html`
**Target codebase:** `medical_app/`
**Authoritative spec already in repo:** `medical_app/specs/protocol-in-consultation-spec.md`

---

## Read these in order

1. **`01-frames.md`** — every screen state, frame by frame, with screenshots.
2. **`02-components.md`** — new and changed components, props, variants.
3. **`03-state-and-data.md`** — how this redesign fits the existing data model. **No schema changes** beyond what `protocol-in-consultation-spec.md` already specifies; this document only adds two UI-state fields.
4. **`04-code-mapping.md`** — file-by-file: what changes, what gets created.
5. **`05-slices.md`** — recommended PR-sized work, with acceptance criteria.
6. **`06-open-questions.md`** — assumptions I made; please answer before slice 3.

---

## What this redesign changes

The current consultation puts SOAP at the centre and protocol in a small right-rail card titled "Agrega un protocolo para guiar esta consulta." Protocol utilization stays low because protocol is presented as optional decoration, not as the structure of the visit.

The hybrid redesign:

- **Adds a Start Gate** (`ConsultaNueva.tsx` becomes a real screen instead of a redirect): doctor picks a motivo / protocolo before SOAP opens. Skip is always one click. This is the single biggest lever on utilization.
- **Promotes the protocol strip** to a full-width band under the consultation header, replacing the right-rail "Protocolo" card. Progress, current step, and "Cambiar / Ver pasos" live here.
- **Adds a `Vista` toggle** (SOAP ↔ Canvas) inside that strip. SOAP stays the default. Canvas is Flow E rendered on the same data — protocol steps are the spine, SOAP fields auto-fill from step content. Per-doctor preference, persisted.
- **Standardises off-protocol behaviour**: skip, switch, off-protocol notes, conditional steps all have explicit UI rather than ad-hoc free text.

What it does NOT change:

- Data model (already covered by `protocol-in-consultation-spec.md`).
- API contracts.
- Order queue / prescriptions / imaging / labs (existing `OrderQueuePanel.tsx` is reused as-is in both views).
- Patient context, vitals, diagnoses, signing flow.

---

## Visual reference

All frames are in `frames/`:

- `01-hybrid.png` … `07-hybrid.png` — Hybrid main flow
- `01-edge.png` … `08-edge.png` — Edge cases

`02-components.md` and `04-code-mapping.md` reference these by filename.

---

## Tokens

`tokens.json` is the design-system token export in Tokens Studio for Figma format, derived from `rezeta-tokens.css`. No new tokens; everything in these mocks uses existing ones.

---

## Out of scope

- Mobile / tablet layouts (existing app is desktop-first; revisit after web ships).
- Protocol editor changes (separate module).
- Learning system / `ProtocolSuggestion` UI (already specced separately).
- i18n beyond Spanish.
