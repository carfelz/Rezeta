# Claude Design Handoff — Rezeta

This is the smaller of the two handoffs. Most issues found during the live audit are implementation bugs that don't require Design re-work — Claude Code can fix them by following the existing handoff frames in `handoff/frames/*-hybrid.png`.

The items below are the cases where Design input would actually help, either because the existing frames don't cover the situation, or because the implemented behavior diverged in a way that needs a Design judgment call rather than a one-line fix.

---

## D1. The legacy `/consultas/nueva` patient+location picker — does it stay or go?

### Background

The patient detail page links to `/consultas/nueva?patientId=X` (only patientId). Today the gate renders only when both `patientId` and `locationId` are in the URL; otherwise the user sees a legacy patient+location picker form.

The redesign was supposed to replace the legacy form with the gate, but that handoff appears not to have been explicit enough — a UI now exists _between_ the click and the gate. The handoff frames don't show this intermediate screen.

### Question for Design

What should `/consultas/nueva?patientId=X` look like when `locationId` isn't yet known?

Two reasonable directions:

**Direction A — Inline location chip on the gate.**
Render the gate as today, but with a small "Ubicación" picker chip (or a thin select bar) between the header and the recent-protocols row. Default to the doctor's primary location if known. The doctor can tap to change.

**Direction B — Pre-fill location from context.**
Always pass `locationId` from the entry point (patient detail, dashboard, agenda). The doctor's primary location becomes the default. The legacy form goes away entirely. The gate works as documented.

### What we'd need from Design

- A frame for the gate with an inline location picker (Direction A) — ideally a chip-style mini-select that fits above the recent-protocols row without disrupting the existing layout. If you go with Direction B, no new frame needed; just remove the legacy form.
- The behavior when `patientId` is also missing — does the gate render with both empty pickers, or does it redirect to `/pacientes`?

### Recommendation

Direction B if the engineering team agrees that "primary location" is a real concept (the `Location.isOwned` flag suggests it is). Otherwise Direction A.

---

## D2. Where does the SwitchProtocolDialog live — modal or popover?

### Background

The implementation renders the SwitchProtocolDialog as a small popover anchored bottom-left of the "Cambiar" trigger in the protocol strip. The handoff component spec (`02-components.md`) calls it `SwitchProtocolDialog` and treats it as a modal pattern. Frame `06-hybrid.png` would normally show this state.

### Question for Design

Should switching the active protocol mid-consultation be a modal (centered, dimmed overlay, deliberate) or a popover (anchored, lightweight, dismissible)?

### Tradeoffs

- **Modal** treats it as a meaningful action with continuity implications. The doctor's progress in the current protocol gets translated/discarded; that's a state change worth slowing them down for.
- **Popover** treats it as a casual reselection. Faster to use, but may lead to unintentional protocol switches mid-flow.

### What we'd need from Design

- Confirmation of the intended pattern.
- If modal: existing frames are fine, just specify modal width and content.
- If popover: a frame showing the popover at the right position, with explicit anchoring guidance (top-aligned to "Cambiar"? bottom-aligned? full-width below strip?).

### Recommendation

Modal. The protocol switch carries data implications (discards working copy, marks usage as `switched`), and the gravity of that is more honestly conveyed by a modal.

---

## D3. The right rail in PROTOCOLO (canvas) view

### Background

The current implementation hides the right rail entirely in canvas mode. The handoff design (`05-hybrid.png`) shows the right rail visible in canvas mode with ALERTAS, PASOS DEL PROTOCOLO, and ÓRDENES.

The implementation choice may have been a misreading — the changelog reads `removed inline SOAP rail (now rendered at page level via RightRail); single-column ProtoStep card spine`. Possibly the developer thought "single-column" meant "no right rail" rather than "the body is single-column, but the rail is separate."

### Question for Design

Is the right rail visible in canvas mode, or hidden? If visible, what changes about its content?

### What we'd need from Design

- An explicit diff between SOAP-mode right rail and Canvas-mode right rail.
- For Canvas mode specifically: does the PASOS DEL PROTOCOLO panel still show? It feels redundant if the canvas body is already the protocol step spine.
- Does the ALERTAS panel show? (Probably yes — alerts are independent of view mode.)
- Does the ÓRDENES panel show? (Probably yes — same reason.)

### Recommendation

- Keep ALERTAS and ÓRDENES in both modes.
- Drop PASOS DEL PROTOCOLO in canvas mode (the body already shows it).
- Drop CONSULTAS PREVIAS in canvas mode (it's noise when the doctor is heads-down on the protocol).

But this is a UX call, and Design should bless it before we ship.

---

## D4. The MissingFieldsPanel layout — what's that empty white row?

### Background

On clicking "Firmar y cerrar" with required fields incomplete, the MissingFieldsPanel opens. It currently shows:

1. `FALTANTES (3)` overline
2. An empty white row (just a × close button on the right edge)
3. Three rows for the missing fields with light pink/orange backgrounds

The empty white row at position 2 looks like a styling regression or unused container. It doesn't appear in any handoff frame I can find.

### Question for Design

Is the empty row intentional (e.g., a search/filter input that's not yet wired up)? Or is it a styling artifact?

### What we'd need from Design

- The intended structure of the panel: header → items, or header → search → items, or something else.
- A frame showing the panel in its various states (3 fields missing, 1 field missing, all fields complete but unsigned, all fields complete and ready to sign).

### Recommendation

If unintentional, just remove it (Claude Code prompt 10A handles this). If intentional but not yet wired up, the design should specify the intended interaction so the panel doesn't ship in a partial state.

---

## D5. Empty-state composition for protocols with zero blocks

### Background

A new protocol is created with two auto-generated empty sections (Motivo de Consulta, Ruta de Decisión). Today the editor shows these as full-height cards with the text "Sección sin bloques." underneath each. The page header says `2 bloques · 2 secciones`.

When the same empty protocol is selected on the consultation gate, the canvas view shows "Este protocolo no tiene pasos interactivos." — and the right rail collapses to nothing (per D3).

### Question for Design

What should an empty-protocol canvas view look like? Right now it's just dead space.

### Possible answers

- A CTA: "Este protocolo todavía no tiene pasos. ¿Editarlo ahora?" with a link to the protocol editor.
- A redirect: empty protocols can't be selected at all on the gate. (Backend filter.)
- A "draft" state: incomplete protocols are filtered from the gate by default; toggle "incluir borradores" to see them.

### What we'd need from Design

A frame for the "empty protocol on canvas" state, plus guidance on whether empty protocols should appear on the gate at all.

### Recommendation

Filter empty protocols from gate suggestions but keep them in the search ("Buscar entre tus N protocolos…"). A doctor browsing should be able to pull up an in-progress protocol; a doctor on the gate should not be offered structurally empty options.

---

## D6. Visual indicator for document type in the patient list

### Background

The Pacientes table shows a column "CÉDULA / DOCUMENTO" with values like:

- `001-2345678-9` (cédula)
- `P12345678` (passport — different format, no hyphens)
- `402-3456789-0` (RNC for businesses — same shape as cédula)

A doctor looking at the table can't immediately tell "cédula vs. passport vs. RNC." The patient detail page does show "Pasaporte P12345678" correctly, but the list doesn't.

### Question for Design

Should the document type be visually indicated in the list, and if so, how?

### Possible answers

- Type badge: `001-2345678-9` followed by a tiny `CÉDULA` chip
- Type icon: a small emoji-like icon to the left of the document number
- Caption: small gray text below the document number reading `CÉDULA` or `PASAPORTE`

### What we'd need from Design

A frame for the patients list with the document-type indicator added. Specify size, color, position.

### Recommendation

Caption below the document number — quietest, most scannable, fits the existing density of the list.

---

## D7. The protocol editor "Publicar v2" labeling

### Background

A brand-new protocol shows `Publicar v2` as the publish button. Versioned UIs typically show `Publicar` (no version) on first publish, then `Publicar v2`, `Publicar v3` as iterations are made.

This is mostly a code fix (Prompt 9) but the underlying concept is worth a Design decision: do we want version numbers visible in publish actions at all?

### Question for Design

Should the publish button surface the version number, or is "Publicar" enough?

### Tradeoffs

- **With version number** ("Publicar v3"): the doctor sees that publishing will create a new version. Useful when versioning is meaningful (e.g., a clinical protocol with safety implications).
- **Without** ("Publicar"): cleaner UI, fewer numbers to track. The version number is still in the breadcrumb (`HTA — Seguimiento · v2`) and Historial.

### Recommendation

Drop the version from the button label; keep it in the breadcrumb and Historial sidebar where it's actually useful for review.

---

## D8. "Receta 1" and the prescription grouping model

### Background

The Órdenes médicas right rail shows a `Receta 1` header even before any medication has been added. Two CTAs are visible: `+ Añadir medicamento` (adds to the current Receta) and `+ Nueva receta` (creates Receta 2).

The mental model here — multiple Recetas per consultation, each containing medications — is unusual. Most DR practices write one prescription per visit, even with multiple drugs.

### Question for Design

Is "multiple Recetas per consultation" a real workflow we want to support, or is the grouping a vestige of an earlier data model?

### What we'd need from Design

- Confirmation of intent.
- If multiple Recetas per consultation is real: when does a doctor actually create Receta 2? Visual differentiation between Receta 1 and Receta 2 (color? label?) and clearer copy explaining when to use which.
- If it's a vestige: drop the grouping. Show a flat "Medicamentos" list. Add `+ Añadir medicamento` only.

### Recommendation

Flat list. Defer the multi-receta model until a real use case justifies the UI cost.

---

## D9. Date format conventions

### Background

The app uses three different date formats across surfaces:

- Agenda: `Jueves, 7 De Mayo De 2026` (title case with capital "De" — grammatically wrong in Spanish)
- Consultation overline: `JUEVES, 7 DE MAYO DE 2026 · 02:40 A.M. · CONSULTORIO PRIVADO` (all caps)
- Breadcrumb: `Consulta · 7 may de 2026` (short month, lowercase)
- Patient detail: `7 de enero de 1990 (36 años)` (lowercase long form)

### Question for Design

What's the canonical date format hierarchy?

### What we'd need from Design

A small reference card with three or four blessed formats and which surfaces use which. E.g.:

- **Long lowercase** (`jueves, 7 de mayo de 2026`) — page titles, modals
- **Long uppercase** (`JUEVES, 7 DE MAYO DE 2026`) — consultation overline only (mono-style headers)
- **Short** (`7 may de 2026`) — breadcrumbs, table rows
- **Numeric** (`07/05/2026`) — exports, prescription printouts

The "Title Case De" version on Agenda is unambiguously a bug — but having a Design-blessed reference makes future surfaces consistent.

---

## D10. Onboarding flow review (deferred)

### Background

This audit didn't cover the onboarding flow (`/bienvenido`, `/bienvenido/personalizar`) because the test user was already past it. The onboarding spec exists at `specs/onboarding-flow.md` but I haven't compared the current implementation against it.

### Recommendation

After D1–D9 are addressed, run a follow-up Design review of the onboarding flow specifically. New users get a worse first impression of the design system than the post-onboarding experience suggests.

---

## What this handoff is NOT

To be clear about scope:

- **Not** the `Consulta.tsx` god-component refactor — that's pure code architecture.
- **Not** the fake-suggestions hook fix — code bug.
- **Not** the hardcoded "Dr. Test García" text — code bug.
- **Not** the localization gap (`active` instead of `activo`) — code bug.
- **Not** the right-rail stickiness (CSS fix).
- **Not** the gate routing (URL handling fix).

Those should all go to Claude Code without bothering Design. The list above is specifically the cases where Design has to make a judgment before implementation can proceed cleanly.
