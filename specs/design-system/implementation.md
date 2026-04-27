# Implementation Guide

> How to use the design tokens and components when writing code.
> Stack: React 18 + Vite + Tailwind CSS + Radix UI + CVA.
> Token source: `apps/web/src/index.css`. Tailwind config: `apps/web/tailwind.config.ts`.
> Component source: `apps/web/src/components/ui/`.

---

## Setup

### Token layer

All design tokens are CSS custom properties defined in `apps/web/src/index.css` inside `@layer base :root`. They cover neutrals, brand teal, semantic colors, typography, spacing, borders, shadows, layout, and shadcn contract variables. No separate CSS file to import — Vite picks them up automatically.

For **standalone HTML** documents (prototypes, previews):

```html
<link rel="stylesheet" href="/design-system/colors_and_type.css" />
<link rel="stylesheet" href="/design-system/shadcn-tokens.css" />
```

`colors_and_type.css` provides the full token set plus semantic element styles (h1–h6, p, a, code, kbd). `shadcn-tokens.css` maps those tokens onto the shadcn CSS variable contract.

### Tailwind config

`tailwind.config.ts` reads the CSS custom properties and exposes them as utility classes:

| Intent | Tailwind class | Token behind it |
|---|---|---|
| Body text | `text-n-700` | `--color-n-700` |
| Heading | `text-n-800` | `--color-n-800` |
| Brand bg | `bg-p-500` | `--color-p-500` |
| Default border | `border-n-200` | `--color-n-200` |
| Small radius | `rounded-sm` | `--radius-sm` (3px) |
| Floating shadow | `shadow-floating` | `--shadow-floating` |
| Standard padding | `p-4` | `--space-4` (16px) |
| Sidebar width | `w-sidebar` | `--layout-sidebar-width` (240px) |
| Topbar height | `h-topbar` | `--layout-topbar-height` (56px) |

### Phosphor Icons

The project uses `@phosphor-icons/web` (not `@phosphor-icons/react`). Icons render as `<i>` elements.

In `main.tsx`, import once before any component code:

```ts
import '@phosphor-icons/web/regular'
import '@phosphor-icons/web/fill'
```

Usage in JSX:

```tsx
<i className="ph ph-calendar-blank" />
<i className="ph-fill ph-user" />  {/* fill variant — active nav only */}
```

Do **not** use `@phosphor-icons/react` (`<ArrowLeft />` style). It is listed as a dependency but is legacy. All new code uses the class-based syntax.

### Live component reference

```bash
pnpm storybook   # runs at localhost:6006
```

Storybook covers every component in `apps/web/src/components/ui/`. For pixel-accurate screen reference, open `design-system/ui_kit/index.html` directly in a browser (no build step needed).

---

## Using Tokens in Code

**Never write raw values.** Always reference a token name — either through a Tailwind class or a CSS custom property.

```tsx
// Tailwind utility classes (preferred in component code)
<div className="text-n-700 bg-n-0 border border-n-200 rounded-md p-4">

// CSS custom properties (for inline styles or non-Tailwind contexts)
style={{ color: 'var(--color-n-700)', padding: 'var(--space-4)' }}

// Never — raw values
<div style={{ color: '#2E2E2B', padding: '16px' }}>
```

### Picking the right neutral

| Intent | Tailwind class | Token |
|---|---|---|
| App background | `bg-n-25` | `--color-n-25` |
| Card / component bg | `bg-n-0` | `--color-n-0` |
| Row alternate / disabled bg | `bg-n-50` | `--color-n-50` |
| Subtle inner border | `border-n-100` | `--color-n-100` |
| Default border | `border-n-200` | `--color-n-200` |
| Strong divider | `border-n-300` | `--color-n-300` |
| Placeholder / muted text | `text-n-400` | `--color-n-400` |
| Secondary / caption text | `text-n-500` | `--color-n-500` |
| Body text | `text-n-700` | `--color-n-700` |
| Heading | `text-n-800` | `--color-n-800` |
| Maximum contrast | `text-n-900` | `--color-n-900` |

### Picking the right spacing

Use only the defined scale steps. For new surfaces, start at `p-4` (16px) and adjust by one step.

```tsx
<div className="p-5">        {/* 20px — card padding */}
<div className="py-2 px-4">  {/* 8/16px — tight list item */}
<main className="p-8 xl:px-12">  {/* 32/48px — page content */}
```

### Picking the right shadow

```tsx
// Most surfaces — no shadow, border only
<div className="border border-n-200 shadow-none">

// Floating element (modal, popover, toast)
<div className="shadow-floating">

// Focus ring on interactive elements
className="focus-visible:shadow-focus"
className="focus-visible:shadow-focus-danger"  // destructive context
```

---

## Using Components

Import from the `ui` barrel:

```ts
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { Select, SelectTrigger, SelectContent, SelectItem } from '@/components/ui/Select'
import { Callout } from '@/components/ui/Callout'
import { EmptyState } from '@/components/ui/EmptyState'
import { Avatar } from '@/components/ui/Avatar'
```

### Button

```tsx
<Button variant="primary">
  <i className="ph ph-plus" />
  Nueva consulta
</Button>

<Button variant="secondary" size="sm">Guardar borrador</Button>

<Button variant="danger" size="lg">
  <i className="ph ph-trash" />
  Archivar paciente
</Button>

<Button variant="ghost" size="md" iconOnly aria-label="Más opciones">
  <i className="ph ph-dots-three" />
</Button>

<Button variant="primary" disabled>Guardar</Button>
```

Variants: `primary` | `secondary` | `ghost` | `danger`
Sizes: `sm` (28px) | `md` (32px, default) | `lg` (40px)

### Input / Field

```tsx
<Input placeholder="Ana María Reyes" />

{/* With label and helper */}
<div className="flex flex-col gap-1">
  <label className="text-[12.5px] font-medium text-n-700">
    Nombre del paciente <span className="text-danger-solid">*</span>
  </label>
  <Input placeholder="Ana María Reyes" />
  <span className="text-[11.5px] text-n-500">Ingresa nombre completo según cédula.</span>
</div>

{/* Error state */}
<Input className="border-danger-solid focus-visible:shadow-focus-danger" />
```

### Badge

```tsx
<Badge variant="draft">Borrador</Badge>
<Badge variant="active">Activo</Badge>
<Badge variant="signed">Firmado</Badge>
<Badge variant="review">En revisión</Badge>
<Badge variant="archived">Archivado</Badge>
<Badge variant="paid">Pagado</Badge>
<Badge variant="overdue">Vencido</Badge>
```

### Tabs

```tsx
<Tabs defaultValue="todos">
  <TabsList>
    <TabsTrigger value="todos">Todos</TabsTrigger>
    <TabsTrigger value="activos">Activos</TabsTrigger>
  </TabsList>
  <TabsContent value="todos">…</TabsContent>
  <TabsContent value="activos">…</TabsContent>
</Tabs>
```

### Callout

```tsx
<Callout variant="success">
  <i className="ph ph-check-circle" />
  <div>
    <p className="font-semibold">Pago recibido</p>
    RD$ 3,450.00 acreditados a la cuenta de Ana María Reyes.
  </div>
</Callout>

<Callout variant="danger">
  <i className="ph ph-x-circle" />
  <div>
    <p className="font-semibold">Contraindicación absoluta</p>
    Amoxicilina registrada como alergia previa (anafilaxia, 2024).
  </div>
</Callout>
```

Variants: `success` | `warning` | `danger` | `info`

### Empty State

```tsx
<EmptyState
  icon="ph-user"
  title="Aún no hay pacientes registrados"
  description="Registra a tu primer paciente para empezar a gestionar citas, consultas y prescripciones desde un solo lugar."
>
  <Button variant="primary">Registrar paciente</Button>
</EmptyState>
```

### Modal

```tsx
<Modal
  title="Archivar paciente"
  subtitle="El expediente quedará en solo lectura."
  icon={{ name: 'ph-archive', variant: 'danger' }}
  footer={
    <>
      <Button variant="secondary" onClick={onClose}>Cancelar</Button>
      <Button variant="danger" onClick={onConfirm}>Archivar paciente</Button>
    </>
  }
>
  {/* body content */}
</Modal>
```

### Avatar

```tsx
<Avatar initials="AR" />            {/* 36px default */}
<Avatar initials="AR" size="sm" />  {/* 30px */}
<Avatar initials="AR" size="xs" />  {/* 28px */}
```

### Typography

Apply `.text-{scale}` composite classes (defined in `@layer components` in `index.css`):

```tsx
<h1 className="text-h1">Pacientes</h1>
<h2 className="text-h2">Historial clínico</h2>
<h3 className="text-h3">Alergias conocidas</h3>
<p className="text-body">La paciente refiere disnea súbita…</p>
<span className="text-caption">Última actualización · 18 abr 2026</span>
<span className="text-overline">Protocolo</span>
```

### Page Layout

```tsx
<div className="flex min-h-screen">
  <Sidebar />
  <div className="ml-sidebar flex-1 pt-topbar">
    <Topbar />
    <main className="p-8 xl:px-12 max-w-layout mx-auto">
      {/* page content */}
    </main>
  </div>
</div>
```

### Anchor Rule (2px teal left mark)

The 2px teal rule is the product's signature for active/selected state:

```tsx
{/* Active nav item */}
<button className="relative before:absolute before:left-0 before:top-1.5
  before:bottom-1.5 before:w-[2px] before:bg-p-500">

{/* Selected card */}
<Card className="border-p-500 relative before:absolute before:left-0
  before:top-3 before:bottom-3 before:w-[2px] before:bg-p-500">
```

---

## Protocol Blocks

Use the `ProtocolBlock` component from `apps/web/src/components/ui/ProtocolBlock.tsx`. See `ProtocolBlock.stories.tsx` for all variants and block types.

---

## Checklist Before Shipping a New Screen

- [ ] All colors use Tailwind token classes — no raw hex
- [ ] Spacing uses only `p-1` through `p-16` (the defined scale)
- [ ] Border radius is `rounded-sm`, `rounded-md`, or `rounded-lg` only
- [ ] Interactive elements have `focus-visible:shadow-focus`
- [ ] Icon-only buttons have `aria-label`
- [ ] Status indicators use `<Badge variant="…">`
- [ ] Empty states use `<EmptyState>` with title + description + specific CTA verb
- [ ] Touch targets are at least `min-h-touch` (44px)
- [ ] Typography uses `.text-{scale}` composite classes
- [ ] Active/selected state uses the 2px teal rule, not a colored background
- [ ] No `@phosphor-icons/react` imports — use `<i className="ph ph-{name}">` syntax
