# Protocol Editor UX

> Living document. Last updated: April 2026.
>
> This document specifies the user experience for the protocol editor and viewer surfaces.

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Platform Strategy](#2-platform-strategy)
3. [Desktop Editor Layout](#3-desktop-editor-layout)
4. [Block Editing UX](#4-block-editing-ux)
5. [Saving & Versioning Flow](#5-saving--versioning-flow)
6. [Single-User Editing Lock](#6-single-user-editing-lock)
7. [Mobile Viewer](#7-mobile-viewer)
8. [Template vs Protocol Editor Differences](#8-template-vs-protocol-editor-differences)
9. [Empty States & Onboarding](#9-empty-states--onboarding)
10. [Keyboard & Accessibility](#10-keyboard--accessibility)

---

## 1. Design Philosophy

The editor optimizes for **deliberation over velocity**. Medical protocols are not drafts; they are clinical commitments that guide real patient care. Every design decision flows from this:

- **Form-style editing.** Blocks are structured records with labeled fields, not free-flowing Markdown. This matches how doctors think about protocols (filling in standard documents, not composing prose) and makes validation straightforward.
- **Manual save, explicit versioning.** Every saved version is intentional. No accidental autosave clutter in the version history.
- **Single-user editing.** Two doctors cannot silently collide on the same protocol. Conflicts are prevented rather than merged.
- **Mobile is for consulting, not authoring.** The bedside use case is optimized separately and cleanly.
- **Preview is always visible.** Doctors author by what the end product will look like.

## 2. Platform Strategy

| Platform | Editor | Viewer |
|----------|--------|--------|
| Desktop web | ✅ Full editor | ✅ Full viewer |
| Tablet web (landscape) | ✅ Full editor (min 1024px width) | ✅ Full viewer |
| Mobile web / PWA | ❌ No editor | ✅ Optimized viewer |
| Native mobile (v2) | ❌ No editor | ✅ Optimized viewer |

**Minimum desktop editor width: 1024px.** Below that, the three-panel layout collapses and the user is shown the mobile viewer with a banner: "To edit protocols, please use a device with a larger screen."

## 3. Desktop Editor Layout

### Overall Structure

```
┌──────────────────────────────────────────────────────────────┐
│  Top bar: title · template · saved · status · lock · actions │
├───────────┬───────────────────────────────┬──────────────────┤
│           │                               │                  │
│  Palette  │          Canvas               │   Live Preview   │
│  (left)   │          (center)             │   (right)        │
│           │                               │                  │
│  ~116px   │          flexible             │   ~220px         │
│           │                               │                  │
└───────────┴───────────────────────────────┴──────────────────┘
```

### Top Bar

Contains, left to right:

- **Protocol title** (large) — click to rename inline
- **Template source** — shows which template this protocol was built from, or "Blank" if standalone
- **Last saved timestamp** — human-readable ("hace 12 min")
- **Status badge** — `Borrador` (draft), `Activo` (active), `En revisión` (under review), `Archivado`
- **Historial button** — opens version history drawer
- **Vista previa button** — expands preview to full screen (hides palette + canvas)
- **Guardar versión button** (primary) — opens the save-version modal

### Left Panel: Block Palette

A fixed-width vertical list of available block types. Section appears first with a visual divider because it's structurally different (a container, not a leaf block).

**Interactions:**
- **Click to insert** at current cursor position (default)
- **Drag to insert** at specific position in canvas (desktop)
- Hover shows a tooltip with a short description

**Palette items for MVP:**

| Block | Icon | Color accent |
|-------|------|--------------|
| Section | § | Teal (container) |
| Text | T | Neutral |
| Checklist | ☐ | Neutral |
| Steps | 1. | Neutral |
| Decision | ◇ | Neutral |
| Dosage | Rx | Neutral |
| Alert | ! | Amber (semantic) |

### Middle Panel: Canvas

The authoring surface. Protocols scroll vertically. Each section is a card with a colored left accent (teal) to distinguish it from leaf blocks.

**Block states:**
- **Unselected** — 0.5px neutral border
- **Selected** — 2px blue border (the currently active block)
- **Required (from template)** — small "REQUERIDA" label in the corner; delete button is disabled

**Interactions at canvas level:**
- Click a block to select it
- Drag handle on each block to reorder within parent
- "+ Add block" button at the bottom of each section
- "+ Add section" button at the bottom of the protocol
- Right-click / context menu: Duplicate, Delete, Move up, Move down

### Right Panel: Live Preview

The preview panel renders the protocol **as a doctor at the bedside would see it** — the same visual language as the mobile viewer, just scaled down.

- Updates in real time as the canvas is edited
- Read-only (no checkbox toggling, no editing)
- Scrolls independently from the canvas
- Collapsible (doctors who prefer maximum canvas space can hide it)

## 4. Block Editing UX

Each block type has a dedicated form UI. Every form follows the same pattern: **type chip at top, labeled fields below, add/remove controls at the bottom where relevant.**

### Section

- Title input (required)
- Description input (optional)
- "Collapsed by default" toggle
- Child blocks rendered in-place
- "+ Añadir bloque" button at bottom

### Text

- Single large textarea with Markdown support
- Markdown toolbar (bold, italic, list, link) shown above the textarea when focused
- Character count at bottom-right

### Checklist

- Optional title input
- One row per item, each with:
  - Text input (main)
  - "Crítico" toggle (small, right-aligned)
  - Delete button (x)
- "+ Añadir ítem" button at bottom

### Steps

- Optional title input
- One row per step, each with:
  - Auto-numbered order display (e.g., "1.", "2.")
  - Title input
  - Detail input (optional, smaller)
  - Delete button
  - Drag handle to reorder
- "+ Añadir paso" button at bottom

### Decision

- Condition input (large textarea)
- One card per branch, each with:
  - Label input (short)
  - Action input (multiline)
  - Delete button (disabled if only 2 branches remain)
- "+ Añadir rama" button at bottom

### Dosage Table

- Optional title input
- Tabular editor with fixed columns: Medicamento, Dosis, Vía, Frecuencia, Notas
- One row per medication
- Delete button per row
- "+ Añadir fila" button at bottom

### Alert

- Severity dropdown (Info, Advertencia, Peligro, Éxito)
- Optional title input
- Content textarea (plain text)
- Preview of how it will render, shown inline

## 5. Saving & Versioning Flow

### Manual Save Only

- The canvas tracks "dirty" state (unsaved changes)
- A subtle indicator appears in the top bar: "Cambios sin guardar"
- If the user attempts to navigate away with unsaved changes, a confirmation modal blocks the action
- Ctrl/Cmd+S triggers the save flow

### Save Flow

When the user clicks "Guardar versión":

1. A modal opens asking for a **change summary** (optional but encouraged)
2. The modal previews the diff vs the last saved version (simple added/removed/modified block count)
3. Two actions: "Guardar como borrador" or "Guardar y publicar"
4. On save, a new `ProtocolVersion` row is created, and `Protocol.current_version_id` is updated if publishing

### Version History

Accessed via "Historial" in the top bar. Shows:

- Chronological list of versions
- Version number, author, date, change summary
- Status of each version (draft, published, current)
- Actions per version: View, Compare with current, Restore as new version
- Restore creates a new version with restored content (never destructive)

### Autosave Draft (Safety Net)

Even though the user saves manually, a **local autosave** runs every 30 seconds to prevent data loss from browser crashes, network issues, etc. This is stored in browser local storage, keyed by protocol ID, and restored with a banner on next visit: "Se recuperó un borrador local no guardado. ¿Usarlo o descartarlo?"

This is **not** a server-side version — it only survives until the user explicitly saves or discards.

## 6. Single-User Editing Lock

### How It Works

- When a user opens a protocol in edit mode, the backend acquires a **soft lock** keyed by `protocol_id` + `user_id`
- The lock has a TTL (e.g., 5 minutes) that refreshes while the user is actively editing
- While the lock is active, other users who open the protocol see a read-only view with a banner: "Siendo editado por Dr. Ana Pérez desde hace 3 min"
- If a lock is stale (TTL expired without refresh), it is released automatically — so a user who closes their browser mid-edit doesn't lock the protocol forever

### Override Flow

A second user can request to take over:

- They see a "Solicitar acceso" button in the read-only banner
- This sends a notification to the current editor
- The current editor can either "Liberar control" (yields the lock) or "Continuar editando" (keeps it)
- If no response in 2 minutes, the request is canceled — no forced overrides in MVP

### UX for the Editing User

The editing user sees no lock indicator. Holding the lock is implicit in being in the editor — surfacing it would be redundant.

### UX for the Other User

- The other user opens the protocol and gets a read-only view identical to the "viewer" UI, with a persistent banner: "Siendo editado por Dr. Ana Pérez desde hace 3 min"
- They can still access version history and see the last saved state
- They can request access via the banner (see Override Flow above)

## 7. Mobile Viewer

### Design Goals

- **Readable at arm's length** — base body font 14px, titles 17px
- **Tappable even while running** — 44px minimum touch targets
- **Fast to scan** — sections collapsible, critical content visually emphasized
- **No edit chrome** — no floating action buttons, no edit pencil icons

### Layout

- Status bar (9:41 · Location context)
- Protocol title (large, 17px, 500 weight)
- Metadata row: status chip + version + updated-at
- Scrollable list of sections
  - Each section in a white card with 0.5px border
  - Collapsible: tap header to expand/collapse
  - Default: first 2 sections expanded, rest collapsed
- Fixed tab bar at bottom (Agenda / Protocolos / Pacientes / Yo)

### Block Rendering on Mobile

| Block | Mobile treatment |
|-------|-----------------|
| Section | Collapsible card with caret indicator |
| Text | Rendered Markdown, 14px body |
| Checklist | Tappable checkboxes (session-scoped state) with critical items bolded red |
| Steps | Numbered cards, title bold, detail muted |
| Decision | Condition as header, branches as tappable chips that reveal action |
| Dosage | Horizontal scroll table or stacked card layout at narrow widths |
| Alert | Colored callout with icon, severity-specific background |

### Session-Scoped Checkbox State

When a doctor taps a checkbox in the mobile viewer:

- The state is saved **only** to the current session (browser storage)
- It does **not** modify the protocol's content — protocols are read-only on mobile
- In v2, this state links to `ProtocolUsage` to track real-time protocol application
- Session state clears when the user closes the protocol or after 8 hours of inactivity

### Navigation

- Back button in top-left returns to protocol list
- Search icon in top-right for full-text search across protocols
- Long-press a protocol title to add to favorites (future)

## 8. Template vs Protocol Editor Differences

The same three-panel editor is used for both templates and protocols, with these differences:

| Aspect | Template editor | Protocol editor |
|--------|-----------------|-----------------|
| What's being authored | The structure others will fill | Actual clinical content |
| Required toggle | Visible on every block/section | Hidden (read from template) |
| Placeholder fields | Editable (author sets hints) | Hidden (shown as placeholders in inputs) |
| Delete locked blocks | Allowed (author decides structure) | Blocked for `required: true` blocks |
| Default content | Typically empty + placeholders | Typically populated from template |
| Version semantics | Template versions | Protocol versions |

The editor's mode is passed in via URL (`/templates/:id/edit` vs `/protocols/:id/edit`) and the UI adapts.

## 9. Empty States & Onboarding

### First-time protocol creation

When a user clicks "New Protocol" and has no protocols yet:

1. Modal opens: "¿Desde dónde empezamos?"
2. Options:
   - Grid of system templates (Emergency, Procedure, Pharmacological, Diagnostic, Physiotherapy)
   - "Empezar desde cero" (blank)
3. After selection, the editor opens with the template already applied and the protocol title field focused

### First-time editor visit

The first time a user lands on the editor, a lightweight 3-step tooltip tour highlights:

1. The palette ("Arrastra bloques aquí")
2. The canvas ("Edita tu protocolo directamente")
3. The save button ("Guarda una versión cuando estés listo")

Dismissible. Not shown again after dismissal.

### Empty canvas (blank protocol)

If the user chose "empezar desde cero," the canvas shows a centered prompt:

> Este protocolo está vacío.
> Añade tu primera sección o bloque desde la paleta de la izquierda.

Plus a large "+ Añadir sección" button as the primary action.

## 10. Keyboard & Accessibility

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl/Cmd + S | Save version |
| Ctrl/Cmd + Z / Shift+Z | Undo / Redo (within current session only) |
| Ctrl/Cmd + / | Toggle preview panel |
| Tab / Shift+Tab | Navigate between block fields |
| Enter (in palette) | Insert selected block type at cursor |
| Delete (on selected block) | Delete selected block (if not required) |
| Ctrl/Cmd + D | Duplicate selected block |

### Accessibility

- All interactive elements have visible focus rings (2px blue outline)
- Block type chips have ARIA labels describing the type
- Required blocks have `aria-describedby` pointing to a "cannot be deleted" explanation
- Preview panel is marked `aria-live="polite"` so screen readers announce changes when users pause
- Color is never the sole indicator of meaning (critical items have both color and weight; severity levels have both color and icon)
- All text meets WCAG AA contrast on both light and dark backgrounds
- Keyboard-only flow supported end-to-end — no action requires a mouse
