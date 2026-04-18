# Implementation Guide

> How to use the design tokens and components when writing code.
> Source files: `design-system/tokens.css` and `design-system/components.css`.

---

## Setup

### Import Order

```html
<link rel="stylesheet" href="/design-system/tokens.css" />
<link rel="stylesheet" href="/design-system/components.css" />
```

`tokens.css` must come first — `components.css` references its custom properties.

### Google Fonts

`tokens.css` imports the fonts automatically via `@import`. No additional font setup needed:
- Source Serif 4 (400, 500, 600 — optical sizes 8–60)
- IBM Plex Sans (400, 500, 600)
- IBM Plex Mono (400, 500)

For frameworks that control the `<head>`, preload the fonts separately for better performance:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
```

### Phosphor Icons

```html
<script src="https://unpkg.com/@phosphor-icons/web"></script>
```

Or via npm: `@phosphor-icons/web`. Icons render as `<i class="ph ph-{name}">`.

---

## Using Tokens

**Always use token names, never raw values.** This keeps the system refactorable and makes the intent clear.

```css
/* Correct */
color: var(--color-n-700);
border: var(--border-default);
padding: var(--space-4);
border-radius: var(--radius-sm);

/* Wrong — hardcoded values */
color: #2E2E2B;
border: 1px solid #D8D8D2;
padding: 16px;
border-radius: 3px;
```

### Picking the Right Neutral

| Intent | Token |
|---|---|
| App background | `--color-n-25` |
| Component background (cards, inputs) | `--color-n-0` |
| Alternate row / disabled background | `--color-n-50` |
| Subtle border (inside a card) | `--color-n-100` |
| Default border | `--color-n-200` |
| Divider / strong border | `--color-n-300` |
| Placeholder, muted text | `--color-n-400` |
| Secondary / caption text | `--color-n-500` |
| Body text | `--color-n-700` |
| Heading | `--color-n-800` |
| Maximum contrast | `--color-n-900` |

### Picking the Right Spacing

Prefer named tokens over arithmetic. For new surfaces, start with `--space-4` (16px) as the default padding and adjust up or down by one step.

```css
/* A standard card */
padding: var(--space-5); /* 20px */

/* A tight list item */
padding: var(--space-2) var(--space-4); /* 8px 16px */

/* A page content area */
padding: var(--space-8) var(--layout-margin-xl); /* 32px 48px */
```

### Picking the Right Shadow

```css
/* Most surfaces — no shadow, border only */
box-shadow: var(--shadow-flat);
border: var(--border-default);

/* Floating element (modal, popover, toast) */
box-shadow: var(--shadow-floating);

/* Focus state on any interactive element */
box-shadow: var(--shadow-focus);        /* default */
box-shadow: var(--shadow-focus-danger); /* destructive context */
```

---

## Using Components

### Buttons

Combine the base class with one variant and optionally one size modifier:

```html
<!-- Primary (default size) -->
<button class="btn btn--primary">
  <i class="ph ph-plus"></i>
  Nueva consulta
</button>

<!-- Secondary, small -->
<button class="btn btn--secondary btn--sm">Guardar borrador</button>

<!-- Destructive, large -->
<button class="btn btn--danger btn--lg">
  <i class="ph ph-trash"></i>
  Archivar paciente
</button>

<!-- Icon-only ghost -->
<button class="btn btn--ghost btn--icon-only" aria-label="Más opciones">
  <i class="ph ph-dots-three"></i>
</button>
```

Use `disabled` attribute (not a class) for native form elements. For non-button elements, add the `.btn--primary:disabled` visual styles manually.

### Form Fields

Wrap every input in `.field` for label + helper/error text:

```html
<div class="field">
  <label class="field__label">
    Nombre del paciente
    <span class="field__required">*</span>
  </label>
  <input class="input" type="text" placeholder="Ana María Reyes" />
  <span class="field__helper">Ingresa nombre completo según cédula.</span>
</div>
```

Error state — add class to input and show error message:

```html
<input class="input input--error" type="text" />
<span class="field__error">
  <i class="ph ph-warning"></i>
  Este campo es requerido.
</span>
```

### Input Groups

Wrap when adding leading/trailing adornments or icons:

```html
<!-- Currency prefix -->
<div class="input-group">
  <span class="input-adorn input-adorn--leading">RD$</span>
  <input class="input" type="number" placeholder="0.00" />
</div>

<!-- Search with icon -->
<div class="input-group">
  <span class="input-icon input-icon--leading">
    <i class="ph ph-magnifying-glass"></i>
  </span>
  <input class="input" type="search" placeholder="Buscar paciente..." />
  <span class="input-icon input-icon--trailing input-icon--action">
    <i class="ph ph-x"></i>
  </span>
</div>
```

Error state on input group: add `input-group--error` to the wrapper.

### Cards

```html
<!-- Standard info card -->
<div class="card">
  <div class="card__title">Próxima cita</div>
  <div class="card__subtitle">Martes 22 abr · 10:30 AM</div>
</div>

<!-- List item (patient row, appointment row) -->
<div class="card-item">
  <div class="avatar">AR</div>
  <div class="card-item__main">
    <div class="card-item__name">Ana María Reyes</div>
    <div class="card-item__meta">Cédula · 001-1234567-8 · 42 años</div>
  </div>
  <span class="badge badge--active">
    <span class="badge__dot"></span>Activo
  </span>
</div>

<!-- Selected card (e.g. active patient in a list) -->
<div class="card--selected">
  <!-- content -->
</div>
```

### Badges

```html
<span class="badge badge--draft"><span class="badge__dot"></span>Borrador</span>
<span class="badge badge--active"><span class="badge__dot"></span>Activo</span>
<span class="badge badge--signed"><span class="badge__dot"></span>Firmado</span>
<span class="badge badge--review"><span class="badge__dot"></span>En revisión</span>
<span class="badge badge--archived"><span class="badge__dot"></span>Archivado</span>
<span class="badge badge--paid"><span class="badge__dot"></span>Pagado</span>
<span class="badge badge--overdue"><span class="badge__dot"></span>Vencido</span>
```

### Callouts

```html
<div class="callout callout--success">
  <i class="ph ph-check-circle"></i>
  <div class="callout__body">
    <div class="callout__title">Pago recibido</div>
    RD$ 3,450.00 acreditados a la cuenta de Ana María Reyes.
  </div>
</div>

<div class="callout callout--danger">
  <i class="ph ph-x-circle"></i>
  <div class="callout__body">
    <div class="callout__title">Contraindicación absoluta</div>
    Amoxicilina registrada como alergia previa (anafilaxia, 2024).
  </div>
</div>
```

### Typography

Apply text classes directly to the element:

```html
<h1 class="text-h1">Pacientes</h1>
<h2 class="text-h2">Historial clínico</h2>
<h3 class="text-h3">Alergias conocidas</h3>
<p class="text-body">La paciente refiere disnea súbita...</p>
<span class="text-caption">Última actualización · 18 abr 2026</span>
<span class="text-overline">Protocolo</span>
```

For the display size (landing/hero), use `.text-display`.

### Anchor Rule

Apply `.anchor-rule` to any element that needs the left teal mark:

```html
<div class="anchor-rule">
  <h3 class="text-h3">Indicaciones</h3>
</div>
```

This is separate from the sidebar active rule and protocol block header rule — those use dedicated `::before` pseudo-elements with the same visual output.

### Page Layout

```html
<div class="app-layout">
  <nav class="sidebar">
    <!-- sidebar content -->
  </nav>
  <div class="app-main">
    <header class="topbar">
      <!-- topbar content -->
    </header>
    <main class="page-content">
      <!-- page content -->
    </main>
  </div>
</div>
```

### Empty States

```html
<div class="empty-state">
  <div class="empty-state__icon">
    <i class="ph ph-user"></i>
  </div>
  <h3 class="empty-state__title">Aún no hay pacientes registrados</h3>
  <p class="empty-state__description">
    Registra a tu primer paciente para empezar a gestionar
    citas, consultas y prescripciones desde un solo lugar.
  </p>
  <button class="btn btn--primary">Registrar paciente</button>
</div>
```

---

## Protocol Blocks

Protocol blocks are the most complex component. Build them section by section:

```html
<div class="protocol-container">
  <div class="protocol-header">
    <div>
      <div class="protocol-kicker">Protocolo · Emergencia</div>
      <h1 class="protocol-title">Manejo de anafilaxia</h1>
      <div class="protocol-meta">Actualizado 18 abr 2026 · v2.3</div>
    </div>
    <span class="badge badge--active"><span class="badge__dot"></span>Activo</span>
  </div>

  <!-- A section block -->
  <div class="pblock">
    <div class="pblock__header">
      <i class="ph ph-dots-six-vertical pblock__handle"></i>
      <span class="pblock__type-chip">Sección</span>
      <span class="pblock__title">Indicaciones</span>
      <div class="pblock__actions">
        <button class="btn btn--ghost btn--icon-only btn--sm" aria-label="Editar">
          <i class="ph ph-pencil-simple"></i>
        </button>
      </div>
    </div>
    <div class="pblock__body">
      <!-- block content here -->
    </div>
  </div>

  <!-- Add block button -->
  <button class="pblock-add-btn">
    <i class="ph ph-plus"></i>
    Añadir bloque
  </button>
</div>
```

---

## Common Patterns

### Sidebar Navigation

```html
<nav class="sidebar">
  <div class="sidebar__brand">
    <div class="sidebar__logo">M</div>
    <span class="sidebar__brand-name">MedERP</span>
  </div>

  <span class="sidebar__section-label">Clínico</span>

  <a class="sidebar__item sidebar__item--active" href="/pacientes">
    <i class="ph-fill ph-user"></i>
    Pacientes
  </a>
  <a class="sidebar__item" href="/citas">
    <i class="ph ph-calendar-blank"></i>
    Citas
    <span class="sidebar__item__count">3</span>
  </a>

  <div class="sidebar__footer">
    <div class="sidebar__user">
      <div class="avatar avatar--sm">JG</div>
      <div class="sidebar__user-info">
        <div class="sidebar__user-name">Dr. Juan García</div>
        <div class="sidebar__user-role">Cardiología</div>
      </div>
    </div>
  </div>
</nav>
```

### Table with Status

```html
<table class="table">
  <thead>
    <tr>
      <th>Paciente</th>
      <th>Cédula</th>
      <th>Estado</th>
      <th>Última consulta</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td class="table td--name">Ana María Reyes</td>
      <td class="table td--mono">001-1234567-8</td>
      <td><span class="badge badge--active"><span class="badge__dot"></span>Activo</span></td>
      <td>18 abr 2026</td>
    </tr>
  </tbody>
</table>
```

### Modal with Destructive Action

```html
<div class="modal-overlay">
  <div class="modal">
    <div class="modal__header">
      <div class="modal__icon" style="background: var(--color-danger-bg); color: var(--color-danger-text);">
        <i class="ph ph-archive"></i>
      </div>
      <div>
        <h2 class="modal__title">Archivar paciente</h2>
        <p class="modal__subtitle">El expediente quedará en solo lectura.</p>
      </div>
    </div>
    <div class="modal__body">
      <!-- confirmation content -->
    </div>
    <div class="modal__footer">
      <button class="btn btn--secondary">Cancelar</button>
      <button class="btn btn--danger">Archivar paciente</button>
    </div>
  </div>
</div>
```

---

## Framework Notes

When using a component framework (React, Vue, etc.):

1. Wrap token usage in CSS Modules or a global stylesheet — the tokens are framework-agnostic CSS custom properties.
2. Component class names (`.btn`, `.card`, etc.) can be applied directly or wrapped in framework components that compose them.
3. State modifiers (`.btn--primary`, `.badge--active`) map naturally to props.
4. The `disabled` HTML attribute handles disabled button state natively; no extra class needed for `<button>` elements.
5. Focus management: the system provides the ring via CSS — ensure no `outline: none` overrides survive in component styles.

---

## Checklist Before Shipping a New Screen

- [ ] All colors reference token names, not hex values
- [ ] Spacing uses `--space-{n}` tokens, not arbitrary px
- [ ] Border radius is one of `--radius-sm / md / lg`
- [ ] Interactive elements have visible focus state (`--shadow-focus`)
- [ ] Icon-only buttons have `aria-label`
- [ ] Status indicators use the correct semantic badge variant
- [ ] Empty states follow the title + description + CTA pattern
- [ ] Touch targets are at least 44px (`--size-touch-min`)
- [ ] Typography uses `.text-{scale}` utility classes or the correct font/size/weight combination from the type scale
- [ ] The 2px teal rule is applied to all active/selected states (not a colored background)
