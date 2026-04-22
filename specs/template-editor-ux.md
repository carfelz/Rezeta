# Template Editor UX

> Living document. Last updated: April 2026.
>
> This document specifies the user experience for the template editor surface. Templates are the structural blueprints behind `ProtocolType`s; they are not browsed by doctors in the flow of creating a protocol. See `protocol-template-schema.md` Section 2 for the three-layer model and `onboarding-flow.md` for how templates are first created.

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Where the Editor Lives](#2-where-the-editor-lives)
3. [Platform Strategy](#3-platform-strategy)
4. [Editor Layout](#4-editor-layout)
5. [Block Row UX](#5-block-row-ux)
6. [Adding Blocks](#6-adding-blocks)
7. [Required Toggle](#7-required-toggle)
8. [Placeholder Hints](#8-placeholder-hints)
9. [Nesting Rules](#9-nesting-rules)
10. [Lock State](#10-lock-state)
11. [Save Behavior](#11-save-behavior)
12. [Keyboard & Accessibility](#12-keyboard--accessibility)
13. [Out of Scope](#13-out-of-scope)

---

## 1. Design Philosophy

The template editor is not the protocol editor. It shares block _concepts_ with the protocol editor but optimizes for a completely different task:

- **The template author decides what shape future protocols should take.** They are not writing clinical content.
- **The only authored content is structural.** Block type, block title, "required" flag, optional placeholder hint, nesting.
- **There is nothing to preview.** A template with empty placeholder-only blocks has no clinical meaning — rendering it as if it were a protocol would be noise, not signal.
- **Fast scanning beats deep editing.** The author wants to see the whole template shape at a glance, with minimal chrome.

These constraints drive the design: a flat list of one-line rows, collapse-expand for detail, no three-panel layout, no preview surface.

## 2. Where the Editor Lives

Templates are managed under `/ajustes/plantillas`:

- `/ajustes/plantillas` — list of tenant-owned templates with create, edit, delete affordances
- `/ajustes/plantillas/new` — create a new template from scratch
- `/ajustes/plantillas/:id/edit` — edit an existing template (read-only if locked — see Section 10)

Templates are **never** reached from the protocol creation flow. That flow opens a type picker, not a template picker. The only way to see the template editor is to navigate into settings.

Onboarding is the sole exception: the "Personalizar" path in the onboarding flow routes the user through a lightweight review that uses the same editor component but inside a guided shell. See `onboarding-flow.md`.

## 3. Platform Strategy

| Platform                        | Template editor                                           |
| ------------------------------- | --------------------------------------------------------- |
| Desktop web                     | ✅ Full editor                                            |
| Tablet web (landscape, ≥1024px) | ✅ Full editor                                            |
| Mobile web / PWA                | ❌ Not supported — banner directs user to a larger device |
| Native mobile (v2)              | ❌ Not supported                                          |

Templates are configured rarely, usually during onboarding on a desktop. Optimizing the template editor for mobile is deliberate non-goal work.

## 4. Editor Layout

### Overall Structure

A single centered column. No palette, no preview. Max content width ~760px.

```
┌──────────────────────────────────────────────────────────┐
│  Header: title · status · lock indicator · save / cancel │
├──────────────────────────────────────────────────────────┤
│  Name + suggested specialty (form fields)                │
├──────────────────────────────────────────────────────────┤
│  Block list                                              │
│    ├─ Section row (teal accent)                          │
│    │   └─ Block row (indented)                           │
│    │   └─ Block row (indented)                           │
│    ├─ Section row                                        │
│    │   └─ Block row                                      │
│    └─ (…)                                                │
├──────────────────────────────────────────────────────────┤
│  Add-block palette (horizontal strip of buttons)         │
└──────────────────────────────────────────────────────────┘
```

### Header

Left to right:

- **Template title** (large) — click to rename inline; the field tracks the `ProtocolTemplate.name` column, not any in-schema title
- **Status chip** — `Nueva`, `Editada`, or `Bloqueada` (when locked)
- **Lock indicator** — if locked, a small banner below the header names the blocking type(s): `Bloqueada por los tipos: Emergencia` (see Section 10)
- **Cancelar** secondary button — discards unsaved changes
- **Guardar plantilla** primary button — persists all changes in one save (see Section 11)

### Name + Suggested Specialty

Two form fields above the block list:

- **Nombre** (required, text) — the user-facing name of the template (e.g., "Intervención de emergencia")
- **Especialidad sugerida** (optional, text) — free-text hint, stored in the template's `metadata.suggested_specialty`; displayed to the doctor when they later manage types or (in v2) browse templates

Neither field has any enforcement beyond "non-empty name". The specialty field is informational only.

### Block List

Every block in the template is rendered as a **row**. Rows come in two visual forms:

- **Section rows** — full-width, 2px teal left rule matching the brand signature, slight visual emphasis (section-only type chip, bolder title)
- **Block rows inside sections** — indented 20px from the section edge, no left rule, lighter weight

Rows render in document order. Reordering is done by a drag handle on the left side of each row, operating within the parent (section order at the top level, block order within a section).

There is no tree indicator, no expand-all/collapse-all. The indent alone encodes the one-level hierarchy.

### Add-Block Palette

A horizontal strip of buttons below the block list:

```
[ + Sección ]  [ + Texto ]  [ + Checklist ]  [ + Pasos ]  [ + Decisión ]  [ + Tabla dosis ]  [ + Alerta ]
```

Clicking a button appends a new block of that type at the appropriate position (see Section 6). The "Sección" button appends at the root level; the other buttons append into the currently-focused section, or into the root if no section is focused.

## 5. Block Row UX

### Row Anatomy (Collapsed State)

Every row, collapsed, shows in one line:

```
[⋮⋮ drag]  [TYPE CHIP]  title or placeholder hint ……………………  [✓ Requerida]  [⋯ menu]
```

- **Drag handle** — always visible, left edge
- **Type chip** — small mono-label indicating block type (`SECCIÓN`, `TEXTO`, `CHECKLIST`, `PASOS`, `DECISIÓN`, `TABLA DOSIS`, `ALERTA`). Sections get a visually distinct chip.
- **Title or placeholder hint** — the block's title if set; otherwise a muted italic rendering of the placeholder hint; otherwise a neutral "(sin título)"
- **Required toggle** — a checkbox labeled `Requerida` (for sections) or `Requerido` (for other blocks). Section 7 covers the semantics.
- **Context menu** (`⋯`) — duplicate, delete, move up, move down

Rows are always visible in this collapsed form. This is the default and the most common state.

### Row Anatomy (Expanded State)

Clicking anywhere on the row body (outside the checkbox or menu) expands it inline. The expanded state reveals a small detail panel below the row with type-specific fields:

- **Section:** title input (required), description input (optional), "Collapsed by default" toggle (informational for the protocol viewer)
- **Text / alert / checklist / steps / decision / dosage_table:** title input (optional), placeholder hint textarea (optional)

No real content authoring happens here. A `checklist` in the template editor has a placeholder hint like "List the items the doctor should verify before starting" — it does not carry actual items. Actual items are authored later, in the protocol editor, when a doctor creates a protocol from a type pointing at this template.

### Only One Row Expanded at a Time

Clicking a second row collapses the first. This keeps the list compact and keeps focus on one edit at a time.

### Deletion

The context menu's "Eliminar" item deletes the row. Required blocks (see Section 7) have "Eliminar" disabled with a tooltip: _"Un bloque requerido no puede eliminarse mientras la plantilla esté activa; desactiva 'Requerido' primero."_ This is UI guidance only — the server-side rule is that required flags can be toggled on/off freely while editing a template.

Deleting a section cascades: all child blocks are removed with it. A confirm dialog surfaces this: _"¿Eliminar la sección 'Evaluación inicial' y sus 2 bloques hijos?"_

## 6. Adding Blocks

### Click-to-Append

The add-block palette appends blocks based on the current focus context:

- **No row focused, "+ Sección" clicked:** new section appended at the end of the root list
- **No row focused, any other button clicked:** new block appended at the end of the last section in the list. If the template has no sections yet, the button is disabled with a tooltip: _"Añade primero una sección para contener este bloque."_
- **A section row is focused, any non-section button clicked:** new block appended as the last child of that section
- **A block row inside a section is focused, any non-section button clicked:** new block appended immediately after the focused row, within the same section
- **"+ Sección" clicked with any focus state:** new section appended at the root level, after the currently-focused section (or at the end if focus is on a child block)

After insert, the new row is auto-focused and auto-expanded so the author can fill in details immediately.

### Default State of a New Block

- Title empty
- Placeholder hint empty
- Required: false
- For sections: empty `blocks` array, `collapsed_by_default: false`

The block is valid to save even in this default state — placeholders and titles are all optional on the template. The only hard constraint is "a section must have a non-empty title before the template saves."

## 7. Required Toggle

### What It Means

The `Requerida`/`Requerido` checkbox on each row is the template author's primary control. It sets the `required: true` flag in the block schema.

Semantics of `required: true` (from `protocol-template-schema.md` Section 5):

| Action on the derived protocol | Required block | Optional block |
| ------------------------------ | :------------: | :------------: |
| Delete the block               |       ❌       |       ✅       |
| Rename the block               |       ✅       |       ✅       |
| Reorder                        |       ✅       |       ✅       |
| Change block type              |       ❌       |       ✅       |
| Edit block content             |       ✅       |       ✅       |
| Add sibling blocks             |       ✅       |       ✅       |

The template editor does not need to communicate all of this — the label `Requerida` and the inability to delete a required block in the protocol editor later are enough.

### Default

All new blocks default to `required: false`. Authors opt in to requiring.

### Sections vs Blocks

The toggle appears on every row — section and non-section. A required section's children can be freely optional; a required section with no required children means "this heading must exist, but the contents are up to the doctor."

## 8. Placeholder Hints

### Purpose

Placeholder hints are authoring aids for the future doctor using a protocol. They render as muted italic guidance text where the block's content would go in the protocol editor:

```
Placeholder hint in the template:
  "Criterios clínicos que activan este protocolo…"

Protocol editor view (in the Indicaciones section):
  ┌──────────────────────────────────────────────┐
  │ Texto                                        │
  │ ┌──────────────────────────────────────────┐ │
  │ │ Criterios clínicos que activan este…     │ │  ← muted italic
  │ │                                          │ │
  │ └──────────────────────────────────────────┘ │
  └──────────────────────────────────────────────┘
```

When the doctor types real content, the placeholder disappears.

### Where Placeholders Live

In the template's JSON schema, placeholders live on:

- Block-level `placeholder` field on any non-section block
- `placeholder_blocks` array on sections, holding pre-seeded children whose placeholders travel with them when a protocol is created from a type

### Optionality

Placeholders are optional. A template that ships with no placeholders is valid — it just gives the doctor less guidance when they author protocols against it.

### Not to Be Confused With Content

A placeholder like _"Epinefrina 0.3 mg IM"_ would be wrong — that is clinical content for a specific protocol, not a hint for the template. Authors should write placeholders as instructions ("List the medications to administer…") rather than examples. The editor does not enforce this, but the onboarding copy and documentation should lean on the distinction.

## 9. Nesting Rules

- **Sections at the root only.** Sections cannot be children of other sections.
- **Non-section blocks in a section or at the root.** A non-section block at the root is allowed but discouraged; the template creation UI always suggests adding a section first.
- **No deeper nesting.** A checklist cannot contain a decision; a section cannot contain a section; no tree beyond two levels.

These rules are enforced both in the UI (the "+ Sección" button is the only way to create a root-level section; non-section buttons attach to sections or the root) and on the server (schema validation).

## 10. Lock State

### Rule

A template is locked iff any non-deleted `ProtocolType` in the same tenant references it. See `protocol-template-schema.md` Section 3 for the authoritative rule.

### UI When Locked

The editor still opens (doctors can view a locked template), but:

- The header shows a persistent banner: _"Esta plantilla está bloqueada por uno o más tipos. Bórralos primero para poder editarla."_ followed by a list of blocking types (as clickable links to `/ajustes/tipos`).
- All interactive controls are disabled: drag handles, checkboxes, title inputs, add-block palette, context menus.
- The "Guardar plantilla" button is disabled with a tooltip: _"No se puede guardar una plantilla bloqueada."_
- "Cancelar" still works — it simply navigates away.
- The status chip reads `Bloqueada`.

### Unlocking

The UI does not offer "delete the blocking types from here" for safety reasons. The doctor must:

1. Click a blocking type's link → go to `/ajustes/tipos/:id`
2. Delete that type (which itself requires no protocols reference it — the type CRUD page handles this)
3. Return to the template editor

This deliberate multi-step flow makes accidental cascading deletions hard.

## 11. Save Behavior

### Single Save Button

There is one save action: **"Guardar plantilla"**. It persists the entire current state of the template in one atomic request:

- Name and suggested specialty
- The full `blocks` array (structure, titles, required flags, placeholder hints)

No auto-save, no draft vs publish, no versioning. Every save overwrites the template's current state. This simplicity is load-bearing: because no version history exists, the total lock (Section 10) is what protects downstream protocols from silent invalidation.

### Validation Before Save

On save, the editor runs client-side validation:

- Template name non-empty
- All sections have non-empty titles
- No empty sections that are also required (a required section with zero children is legal; a required empty section with an empty title is not — the title check catches this)
- All block IDs unique (the editor auto-generates these; this check is a safety net)

Server-side validation re-runs all of the above, plus the lock check (Section 10) and schema-shape validation.

If validation fails, the save button stays disabled and failing rows highlight in red with an inline message.

### Dirty State

The editor tracks unsaved changes. If the user tries to navigate away with unsaved changes, a confirm dialog appears: _"Tienes cambios sin guardar. ¿Descartar y salir?"_

No local autosave in this editor. Templates are low-churn authoring — autosave adds complexity for no benefit.

### Post-Save

On successful save, the editor stays open, the dirty state clears, and a toast confirms: _"Plantilla guardada."_ The user can continue editing or navigate away.

## 12. Keyboard & Accessibility

### Keyboard Shortcuts

| Shortcut                 | Action                                     |
| ------------------------ | ------------------------------------------ |
| Ctrl/Cmd + S             | Save template                              |
| Escape                   | Collapse the currently expanded row        |
| Tab / Shift+Tab          | Navigate between row fields                |
| Enter (on a row)         | Expand/collapse the row                    |
| Delete (on selected row) | Open delete confirmation (if not required) |

### Accessibility

- All interactive elements have visible focus rings per the design system
- Block type chips have ARIA labels describing the type
- Required checkboxes have `aria-describedby` explaining the semantic consequence
- Drag handles have keyboard-accessible move-up/move-down alternatives in the context menu (so reorder never requires a mouse)
- The lock banner is marked `role="status"` and announced by screen readers on open
- Color is never the sole indicator: the lock state uses both color and the "Bloqueada" chip; required state uses both the checkbox and the persisted text label

## 13. Out of Scope

Explicitly deferred, to keep MVP's template editor small enough to ship alongside everything else:

| Feature                                                         | Target                                                  |
| --------------------------------------------------------------- | ------------------------------------------------------- |
| Preview panel showing how the template's structure would render | Never (no meaningful preview of a placeholder-only doc) |
| Template versioning / draft-publish                             | v2                                                      |
| Comparison view between template revisions                      | v2                                                      |
| Duplicate entire template as a starting point                   | v2 (minor; nice-to-have)                                |
| Import/export template JSON                                     | v2                                                      |
| Template tags and search within `/ajustes/plantillas`           | v2 (MVP list is small enough not to need search)        |
| Forking a tenant's template to another tenant                   | v3                                                      |
| Real-time collaboration                                         | v2+                                                     |
| Comments / annotations on blocks                                | v2+                                                     |
| Approval workflow (multi-signer)                                | v2 (clinics)                                            |

If any of these surface as urgent from early user feedback, revisit at the scope level before expanding the editor.
