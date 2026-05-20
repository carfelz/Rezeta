# Rezeta Design System

> A medical ERP designed for doctors in the Dominican Republic — built around protocols, multi-location practice, and editorial restraint.

---

## Product context

**Rezeta** is a medical ERP for Latin American (specifically Dominican Republic) medical specialists. It scales from solo practitioner to multi-location clinic. The differentiating feature is a **protocol engine** that lets doctors define reusable clinical protocols from templates (checklists, algorithms, decision trees, dosage tables, etc.).

- **Target market:** solo specialists in the DR who consult at 2–4 different health centers per week.
- **Primary differentiator:** native multi-location support (free tier includes unlimited locations) + first-class protocol engine.
- **Default UI language:** Spanish. English is a toggle.
- **Currency:** DOP primary (`RD$ 3,450.00`), USD secondary.
- **Document types:** `cedula`, `passport`, `rnc` (Dominican tax ID).

### MVP surfaces

The product is a single web application (`apps/web`) with these routes:

| Route | Purpose |
|---|---|
| `/dashboard` | Daily snapshot — today's appointments, recent patients, alerts |
| `/agenda` | Calendar / week view, multi-location |
| `/pacientes` | Patient list (doctor-owned, follows them across locations) |
| `/pacientes/:id` | Patient detail + history |
| `/pacientes/:id/consultas/:id` | SOAP-note consultation |
| `/protocolos` | Protocol library (templates + instances) |
| `/protocolos/:id/edit` | Protocol editor (the signature surface) |
| `/facturacion` | Billing / invoices |
| `/ajustes` | Settings (locations, account, billing, language) |

### Non-goals

Rezeta is **not** a hospital information system, telemedicine platform, insurance claim processor, or generic international EHR.

---

## Sources used

This system was built from the `carfelz/Rezeta` GitHub repository — specifically:

| Source path | Why it was read |
|---|---|
| `CLAUDE.md` | Project memory, design decisions, stack |
| `design-system/tokens.css` | All CSS custom properties — the source of truth |
| `design-system/components.css` | Component implementations |
| `design-system/reference.html` | Component library specimens |
| `design-system/app-prototype.html` | 9-screen navigable MVP prototype |
| `specs/design-system/principles.md` | Voice, tone, do/don't pairs |
| `specs/design-system/components.md` | Component spec sheet |
| `specs/design-system/tokens.md` | Token rationale |
| `specs/design-system/implementation.md` | Implementation rules |
| `specs/mvp-scope.md` | Feature surfaces in MVP |

The original files are kept under `source/` for reference. Nothing was lost.

---

## Index — what lives where

```
.
├── README.md                    ← you are here
├── SKILL.md                     ← skill manifest (Claude Code compatible)
├── colors_and_type.css          ← merged tokens + semantic CSS vars (h1, p, code…)
├── shadcn-tokens.css            ← Rezeta tokens mapped to shadcn variable names
├── source/                      ← original repo files, untouched
│   ├── tokens.css
│   ├── components.css
│   ├── reference.html
│   ├── app-prototype.html
│   └── specs/
├── assets/                      ← logos, marks, brand assets
├── preview/                     ← design-system tab cards
├── ui_kits/
│   └── web_app/                 ← the Rezeta web app, recreated
│       ├── README.md
│       ├── index.html           ← interactive 5-screen prototype
│       └── *.jsx                ← Sidebar, TopBar, ProtocolBlock, etc.
└── slides/                      ← (none — no deck templates were provided)
```

The brand uses **Phosphor Icons (regular weight)** via the `@phosphor-icons/web` CDN. No icon files are bundled — link from CDN.

Fonts (**Source Serif 4**, **IBM Plex Sans**, **IBM Plex Mono**) are loaded from Google Fonts. No local font files are needed.

---

## Visual personality

> "Software serio para médicos que trabajan horas."

The interface behaves like a **well-typeset clinical notebook**: typography carries hierarchy, borders create structure, color appears only when it means something. It is precise, editorial, unadorned — not clinical-sterile, not playful.

**Three words: Dense. Deliberate. Trustworthy.**

### The anchor decision

The **2px vertical teal rule** (`#2D5760`, `--color-p-500`) on the **left edge** is the product's signature. It marks:

- The active item in the sidebar
- Selected/highlighted cards
- Protocol block headers
- Active section starts in forms

This single element replaces colored backgrounds, elevated shadows, and thick borders as the primary hierarchy device.

---

## VISUAL FOUNDATIONS

### Color

- **Brand:** one color only — deep teal-slate `#2D5760`. Not SaaS blue, not clinical green.
- **Brand teal appears in three places only:** primary action buttons, the 2px active/selected rule, and links/interactive text.
- **Neutrals** are cool true-greys with a hair of warmth at the light end. Optimized for long reading sessions.
- **App background** is `#FAFAF7` (paper, `--color-n-25`), not pure white. White (`--color-n-0`) is reserved for cards, surfaces, and active sidebar items.
- **Semantic colors** (success, warning, danger, info) appear **exclusively** for clinical or administrative state — never decoration. Each is a paired bg / border / text triplet.
- **No gradients. No second accent. No purple.**

### Typography

Three families. Three weights (400 / 500 / 600). No other combinations permitted.

| Family | Role |
|---|---|
| **Source Serif 4** | Display, headings, protocol titles, patient names — editorial, scientific heritage |
| **IBM Plex Sans** | UI, body, tables, forms — humanist, excellent at small sizes |
| **IBM Plex Mono** | Overlines, kicker labels, data values, keyboard hints |

**Hierarchy is typographic first.** Don't use color or weight to compensate for a missing typographic step. No weights above 600. Body never bold.

### Spacing

Base unit **4px**. Tokens: `--space-1` (4) through `--space-16` (64), with no 14, 18, 20, 22, 26, 30, etc. The scale is `4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64`. Page padding is `28px 32px` (small) or `48px` margin (xl). Sidebar is **240px**, topbar **56px**.

### Backgrounds

- **No imagery on chrome surfaces.** No hero photography, no illustrations, no patterns, no textures.
- The app background is paper (`--color-n-25` `#FAFAF7`). Cards sit on top in pure white (`--color-n-0`). Row alternates use `--color-n-50`.
- **No gradients anywhere.** Not on buttons, not on backgrounds, not on hover states.

### Borders & shadows

**Borders carry hierarchy; shadows are secondary.**

- `--border-default` (1px `--color-n-200`) — cards, inputs, table borders
- `--border-soft` (1px `--color-n-100`) — inner dividers
- `--border-strong` (1px `--color-n-300`) — emphasized dividers
- `--border-accent` (**2px `--color-p-500`**) — active state signature
- `--border-dashed` (1px dashed `--color-n-200`) — empty states, drop targets

Three shadow levels, used sparingly:

- `--shadow-flat` — none. Default.
- `--shadow-raised` — barely-perceptible 1px+1px. Hover-elevated cards.
- `--shadow-floating` — modals, toasts, popovers only.

Focus rings are explicit and double-ringed: `0 0 0 2px white, 0 0 0 4px var(--color-p-300)`.

### Corner radii

**Three values — never any other.**

- `--radius-sm` 3px — buttons, inputs, chips, badges
- `--radius-md` 5px — cards, modals, callouts
- `--radius-lg` 8px — large containers (rare)

No 4px, no 6px, no 10px, no 50% pill radius (except on toggles and avatars).

### Cards

White (`--color-n-0`) on paper bg, `1px solid --color-n-200` border, `--radius-md` (5px) corners, `padding: 20px`. No shadow by default. Hover row in a list: bg shifts to `--color-n-25`. **Selected** state: border becomes `--color-p-500` plus a 3px teal rule on the inset left edge.

### Animation & motion

**Restrained.** Two transition tokens only:

- `--transition-fast` (100ms ease) — buttons, hover color changes
- `--transition-medium` (150ms ease) — modals, accordions

**No bounce, no spring, no parallax, no scroll-triggered animation.** Modals fade + slight rise. Toasts slide in from the bottom-right. Toggle knobs slide left ↔ right.

### Hover & press states

- **Buttons primary:** bg `--color-p-500` → hover `--color-p-700` → active `--color-p-900`. Color-shift only, never scale.
- **Buttons secondary:** bg `--color-n-0` → hover `--color-n-50` → active `--color-n-100`.
- **Buttons ghost:** transparent → hover `--color-n-100` → active `--color-n-200`.
- **List items / nav items:** hover bg `--color-n-50`, text darkens to `--color-n-800`.
- **Icon buttons:** hover bg `--color-n-50`, no scale.

Press states never use scale or shrink — they use a darker color tier.

### Transparency & blur

**Avoid.** The only translucency in the system is the modal overlay (`rgba(14,14,13,0.35)`). No frosted glass, no `backdrop-filter`, no opacity tweens on chrome.

### Imagery

When real imagery is used (rare — patient photos in profile, maybe), it sits inside a card with a 1px `--color-n-200` border and `--radius-md` corners. **No filters, no overlays, no warm/cool grading.** Treat photographs as data, not decoration.

### Layout rules

- Max content width **1440px**.
- Sidebar **240px fixed left**. Topbar **56px fixed top** (left edge starts at `240px`).
- Page content padding `28px 32px` (default) or `32px 48px` (large). Wide pages drop the max-width.
- Density target: **information-dense**, but minimum touch target `44px` (WCAG).

---

## CONTENT FUNDAMENTALS

### Voice

> The voice is that of a well-trained colleague — direct, specific, and respectful of the doctor's time. **Never marketing. Never hedging. Never apologetic.**

| Quality | Means |
|---|---|
| **Direct** | State the fact, then what to do. No preamble. |
| **Specific** | Use the patient's name, the exact amount, the protocol version, the date. |
| **Clinical, not casual** | "Contraindicación absoluta" — not "¡Cuidado!" |
| **Actionable** | Every status message implies the next step. |
| **Precise** | "RD$ 3,450.00" over "un pago". "v2.3" over "una nueva versión". |

### Address & casing

- **Address:** the user is "tú" implicitly through verbs ("**Registra** a tu primer paciente"). Avoid "usted" (too formal). Never "vosotros".
- **Sentence case** for buttons, headings, labels, page titles. Never Title Case. Never UPPERCASE except for mono overlines and table headers.
- **Mono-uppercase** is reserved for kickers (`PROTOCOLO · V2.3 · FIRMADO`), section labels (`CLÍNICO`, `ADMINISTRACIÓN`), table headers (`PACIENTE`, `ÚLT. CONSULTA`), and clinical critical labels (`CRÍTICO`).

### Emoji

**Never.** Emoji are not part of the brand. Status uses **icons + text label** (Phosphor icons, regular weight). Unicode characters as iconography are also avoided.

### Specific copy patterns

**Confirmations** — title + detail, never just a title:

```
✓ Pago recibido
  RD$ 3,450.00 acreditados a la cuenta de Ana María Reyes.
  Factura F-2026-01142 marcada como pagada.
```

**Warnings** — what + why:

```
⚠ Revisión pendiente
  El protocolo "Dolor torácico agudo" tiene 3 bloques sin revisar
  desde la última actualización de guías ACC/AHA.
```

**Danger** — severity label + specific contraindication + instruction:

```
✗ Contraindicación absoluta
  Amoxicilina registrada como alergia previa (anafilaxia, 2024).
  No prescribir sin evaluación especializada.
```

**Empty states** — Source Serif 4 title, IBM Plex Sans description, **specific** CTA:

```
(serif)  Aún no hay pacientes registrados
(sans)   Registra a tu primer paciente para empezar a gestionar
         citas, consultas y prescripciones desde un solo lugar.
[btn]    Registrar paciente            ← specific verb, not "Agregar"
```

### Labels & CTAs

| Context | Preferred | Avoid |
|---|---|---|
| Create appointment | "Nueva cita" | "Agendar" / "Crear" |
| Create consultation | "Nueva consulta" | "Iniciar visita" |
| Save draft | "Guardar borrador" | "Guardar" alone |
| Sign and publish | "Firmar y publicar" | "Finalizar" |
| Archive patient | "Archivar paciente" | **"Eliminar"** (never delete medical records) |
| Cancel action | "Cancelar" | "Volver" / "No" |

### Numeric & data formatting

- Currency: `RD$ 3,450.00` — always two decimals, DOP prefix, comma thousands.
- Dates: `18 abr 2026` — abbreviated month, no leading zero on day.
- Times: `9:30 AM` — 12-hour, no leading zero.
- Patient age: `42 años` — never "42 yrs".
- Protocol version: `v2.3` — never "Version 2.3".

---

## ICONOGRAPHY

The brand uses **[Phosphor Icons](https://phosphoricons.com/)** in the **Regular** weight, served from CDN:

```html
<script src="https://unpkg.com/@phosphor-icons/web@2.1.1"></script>
```

Usage: `<i class="ph ph-calendar-blank"></i>`

### Sizes

| Token | Px | Use |
|---|---|---|
| `--icon-size-sm` | 15 | Buttons, inline within text |
| `--icon-size-md` | 16 | Sidebar items, callouts, default |
| `--icon-size-lg` | 18 | Top bar, callouts, inline alerts |
| `--icon-size-xl` | 22 | Domain grids, empty-state icon circles |

### Rules

- **Regular weight only.** The Fill variant is reserved for the **active sidebar item**. Bold/Duotone/Light are not used.
- **Pair with a text label** whenever space allows. Icon-only buttons must have `aria-label`.
- **No literal medical clipart** — never stethoscopes, red crosses, or syringes as decorative motifs. The system's professionalism comes from restraint.
- **No emoji.** No unicode dingbats. No custom hand-drawn SVG illustrations.
- **No PNG icons.** Phosphor (vector, weight-controllable) covers the entire surface.

### Common icons referenced

`ph-house`, `ph-calendar-blank`, `ph-users`, `ph-list-checks`, `ph-clipboard-text`, `ph-gear-six`, `ph-magnifying-glass`, `ph-bell`, `ph-question`, `ph-caret-down`, `ph-plus`, `ph-pencil-simple`, `ph-trash`, `ph-warning`, `ph-warning-circle`, `ph-info`, `ph-check-circle`, `ph-x-circle`, `ph-x`, `ph-dots-six-vertical` (drag handle), `ph-pill`, `ph-flask`.

### Logo

The Rezeta wordmark is set in **Source Serif 4 Medium (500)** — see `assets/logo.svg`. The logo mark is a **28×28px teal square (`--color-p-500`, `--radius-sm` 3px) with a serif "R" reversed out in white** at 16px Source Serif 4 Medium. This pairs with the wordmark in the sidebar brand row.

---

## Skill / further reading

- `SKILL.md` — turns this folder into a Claude Code skill.
- `ui_kits/web_app/` — pixel-faithful recreation of the Rezeta web app surfaces.
- `source/specs/design-system/principles.md` — original do/don't pairs, in full.
- `source/specs/design-system/components.md` — original component spec sheet.
