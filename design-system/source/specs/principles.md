# Design Principles

> This document captures the visual personality, voice, microcopy standards, and the do/don't pairs for the Medical ERP design system.

---

## Visual Personality

> "Software serio para médicos que trabajan horas."

The interface behaves like a well-typeset clinical notebook: typography carries hierarchy, borders create structure, color appears only when it means something. It is precise, editorial, unadorned — not clinical-sterile, not playful. It communicates the confidence of a professional tool built for the daily practice of medicine.

**Three words:** Dense. Deliberate. Trustworthy.

---

## The Anchor Decision

The 2px vertical teal rule is the product's signature. It marks:
- The active item in the sidebar navigation
- Selected or highlighted cards
- Protocol block headers
- Active section starts in forms

This single element replaces colored backgrounds, elevated shadows, and thick borders as the primary hierarchy device. It is economical, readable at any scale, and becomes the product's visual fingerprint.

**It lives on the left edge — always vertical, always 2px, always `--color-p-500`.**

---

## Color Philosophy

The palette is silent. One brand color. Everything else is neutral or semantic.

**Brand teal (`#2D5760`) appears in three places only:**
1. Primary action buttons and focus rings
2. The 2px active/selected rule
3. Links and interactive text

**Semantic colors appear in one place only:** indicating clinical or administrative state (success, warning, danger, info). Never for decoration, never for visual interest, never as a second accent.

**Zero additional accents.** Adding a second brand color dilutes clinical readability and destabilizes the hierarchy system. The neutrals carry all decorative weight.

---

## Typography Philosophy

Three fonts, three weights (400 / 500 / 600). No other combinations are permitted.

| Font | Role |
|---|---|
| Source Serif 4 | Headings, protocol titles, patient names, display — editorial with scientific heritage |
| IBM Plex Sans | UI, body, tables, forms, data — humanist, excellent at small sizes |
| IBM Plex Mono | Overlines, labels, keyboard hints, data values — technical, monospaced |

Hierarchy is typographic first. Don't use color or weight to compensate for a missing typographic step.

---

## Do / Don't Pairs

### Color

**Do:** Use `--color-p-500` only for primary actions, the active rule, and links.  
**Don't:** Use brand teal for section backgrounds, decorative dividers, or hover states.

**Do:** Use semantic colors (success/warning/danger/info) exclusively for clinical or administrative status.  
**Don't:** Use green to mean "featured" or red to mean "important" in a decorative sense.

**Do:** Keep the palette to one brand color plus the four semantic sets.  
**Don't:** Introduce a second brand accent or a gradient.

### Borders and Shadows

**Do:** Use borders as the primary hierarchy device. `--border-default` for cards, `--border-soft` for inner dividers, `--border-accent` for the active state.  
**Don't:** Use shadows to distinguish surface levels in static content — reserve `--shadow-floating` for truly elevated elements (modals, toasts, popovers).

**Do:** Apply the 2px teal rule for active/selected state via `::before` on the left edge.  
**Don't:** Use a colored background highlight as the primary selected-state indicator.

### Radius

**Do:** Choose from the three tokens only — `--radius-sm` (3px) for controls, `--radius-md` (5px) for cards, `--radius-lg` (8px) for large containers.  
**Don't:** Use arbitrary radius values (4px, 6px, 10px, 50%) or a pill radius on non-toggle elements.

### Typography

**Do:** Use Source Serif 4 for headings, protocol titles, and patient names.  
**Don't:** Mix serif and sans-serif at the same level of the hierarchy (e.g., sibling headings in different fonts).

**Do:** Keep to weight 400, 500, or 600.  
**Don't:** Use weight 700+ or apply bold to running body text.

**Do:** Use IBM Plex Mono for overlines, data labels, keyboard shortcuts, and code.  
**Don't:** Use mono for body text or action labels.

### Icons

**Do:** Use Phosphor Icons in the `Regular` weight at 16px inline, 18px for callouts, 22px for domain grids.  
**Don't:** Use the Fill variant except for the active item in primary navigation.

**Do:** Treat icons as supporting elements — pair with a text label whenever space allows.  
**Don't:** Use literal medical imagery (stethoscopes, red crosses, syringes as decorative motifs) — the system's professionalism comes from restraint, not clipart.

### Spacing

**Do:** Use only the defined spacing tokens (`--space-1` through `--space-16`).  
**Don't:** Use arbitrary pixel values (e.g., 15px, 18px, 22px) for gaps and padding.

### States

**Do:** Implement focus rings (`--shadow-focus`) on all interactive elements for keyboard navigation.  
**Don't:** Remove or override `outline` without replacing it with the system focus ring.

---

## Voice and Microcopy

The UI language is **Spanish by default**. English is a toggle. Write copy in Spanish first.

### Personality

The voice is that of a well-trained colleague — direct, specific, and respectful of the doctor's time. Never marketing. Never hedging. Never apologetic.

| Quality | What it means |
|---|---|
| **Direct** | State the fact, then what to do. No preamble. |
| **Specific** | Use the patient's name, the exact amount, the protocol version, the date. |
| **Clinical, not casual** | "Contraindicación absoluta" not "¡Cuidado!" |
| **Actionable** | Every status message implies the next step. |
| **Precise** | Prefer "RD$ 3,450.00" over "un pago". Prefer "v2.3" over "una nueva versión". |

### Message Patterns

**Confirmations — title + detail, never just a title:**
```
✓ Pago recibido
  RD$ 3,450.00 acreditados a la cuenta de Ana María Reyes.
  Factura F-2026-01142 marcada como pagada.
```

**Warnings — what + why:**
```
⚠ Revisión pendiente
  El protocolo "Dolor torácico agudo" tiene 3 bloques sin revisar
  desde la última actualización de guías ACC/AHA.
```

**Danger — severity label + specific contraindication + instruction:**
```
✗ Contraindicación absoluta
  Amoxicilina registrada como alergia previa (anafilaxia, 2024).
  No prescribir sin evaluación especializada.
```

**Info — what changed + what it means for the user:**
```
ℹ Nueva versión del protocolo
  Se publicó la v2.3 de "Manejo de anafilaxia en adultos".
  Tus copias de trabajo no se verán afectadas.
```

### Labels and CTAs

| Context | Preferred | Avoid |
|---|---|---|
| Create appointment | "Nueva cita" | "Agendar" / "Crear" |
| Create consultation | "Nueva consulta" | "Iniciar visita" |
| Save draft | "Guardar borrador" | "Guardar" alone (ambiguous with publish) |
| Sign and publish | "Firmar y publicar" | "Finalizar" |
| Archive patient | "Archivar paciente" | "Eliminar" (never delete in medical records) |
| Cancel action | "Cancelar" | "Volver" / "No" |
| Empty state CTA | Specific verb: "Agendar primera cita" | Generic: "Agregar" |

### Empty States

Use Source Serif 4 for the title, IBM Plex Sans for the description. Title: what's missing. Description: why it matters, what to do.

```
(serif)  Aún no hay pacientes registrados
(sans)   Registra a tu primer paciente para empezar a gestionar
         citas, consultas y prescripciones desde un solo lugar.
[btn]    Registrar paciente
```

### Numeric and Data Formatting

- Currency: `RD$ 3,450.00` — always two decimals, DOP prefix.
- Dates: `18 abr 2026` (abbreviated month, no leading zero on day).
- Times: `9:30 AM` (12-hour, no leading zero).
- Patient age: `42 años` not `42 yrs`.
- Protocol version: `v2.3` not `Version 2.3`.

---

## Accessibility Baseline

- All text/background combinations meet WCAG AA (4.5:1 for normal text, 3:1 for large text).
- Every interactive element must have a visible focus ring — use `--shadow-focus` or `--shadow-focus-danger`.
- Minimum touch target: 44px (`--size-touch-min`).
- Color is never the sole signal — pair every semantic color with an icon or text label.
- Icon-only buttons must have `aria-label`.
