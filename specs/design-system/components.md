# Component Specifications

> Every component in the design system, with states, variants, and sizing.
> React source: `apps/web/src/components/ui/`.
> Live examples: `pnpm storybook` or `design-system/reference.html` (static HTML reference).

---

## Avatar

Circular initials display for user identity.

| Variant | Size | Font size | Prop |
|---|---|---|---|
| Default | 36×36px | 13px | `size="md"` (default) |
| Small | 30×30px | 11px | `size="sm"` |
| Extra small | 28×28px | 11px | `size="xs"` |

**Styles:** `bg-p-50 text-p-700 font-semibold`, circle via `rounded-full`.

```tsx
<Avatar initials="AR" />
<Avatar initials="AR" size="sm" />
<Avatar initials="AR" size="xs" />
```

---

## Button

### Variants

| Variant | Prop | Default bg | Hover bg | Active bg | Text |
|---|---|---|---|---|---|
| Primary | `variant="primary"` | `bg-p-500` | `bg-p-700` | `bg-p-900` | White |
| Secondary | `variant="secondary"` | `bg-n-0` | `bg-n-50` | `bg-n-100` | `text-n-800` |
| Ghost | `variant="ghost"` | transparent | `bg-n-100` | `bg-n-200` | `text-n-700` |
| Destructive | `variant="danger"` | `bg-danger-solid` | `#6E2018` | `#52170F` | White |

### Sizes

| Size | Height | Font | Prop |
|---|---|---|---|
| SM | 28px | 12.5px | `size="sm"` |
| MD (default) | 32px | 13px | `size="md"` |
| LG | 40px | 14px | `size="lg"` |

### Icon-only

```tsx
<Button variant="ghost" size="md" iconOnly aria-label="Más opciones">
  <i className="ph ph-dots-three" />
</Button>
```

### States

| State | Behavior |
|---|---|
| Hover | Darker bg tier |
| Active | Darkest bg tier |
| Focus | `shadow-focus` (or `shadow-focus-danger` for danger variant) |
| Disabled | `bg-n-200 text-n-400 cursor-not-allowed` |

---

## Form — Input

Single-line text, textarea, and select. Source: `Input.tsx`.

| State | Border | Shadow |
|---|---|---|
| Default | `border-n-300` | none |
| Focus | `border-p-500` | `0 0 0 3px rgba(45,87,96,.12)` |
| Error | `border-danger-solid` | none |
| Disabled | `border-n-200`, `bg-n-50`, `text-n-400` | none |
| Read-only | `border-n-200`, `bg-n-25` | none |

**Sizing:** height `h-input-md` (34px), `px-3 py-0 text-body-sm rounded-sm`.

### Input with adornments

Compose using wrapper + sibling elements and conditionally apply leading/trailing padding:

```tsx
{/* Currency prefix */}
<div className="flex border border-n-300 rounded-sm focus-within:border-p-500
  focus-within:shadow-[0_0_0_3px_rgba(45,87,96,.12)]">
  <span className="px-3 flex items-center bg-n-50 border-r border-n-200 text-n-500 text-body-sm">
    RD$
  </span>
  <Input className="border-0 shadow-none flex-1" placeholder="0.00" />
</div>

{/* Search icon */}
<div className="relative">
  <i className="ph ph-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-n-400" />
  <Input className="pl-9" placeholder="Buscar paciente…" />
</div>
```

### Field (label + input + helper/error)

```tsx
<div className="flex flex-col gap-1">
  <label className="text-[12.5px] font-medium text-n-700">
    Nombre <span className="text-danger-solid">*</span>
  </label>
  <Input placeholder="Ana María Reyes" />
  <span className="text-[11.5px] text-n-500">Ingresa nombre completo según cédula.</span>
</div>

{/* Error */}
<div className="flex flex-col gap-1">
  <Input className="border-danger-solid" />
  <span className="flex items-center gap-1 text-[11.5px] text-danger-solid">
    <i className="ph ph-warning" />
    Este campo es requerido.
  </span>
</div>
```

---

## Form — Checkbox

| State | Visual |
|---|---|
| Unchecked | 16×16px, `border-n-400` |
| Checked | `bg-p-500` fill, white checkmark |
| Indeterminate | `bg-p-500` fill, white dash |

Use Radix UI `Checkbox` primitive from `@radix-ui/react-checkbox`, styled with Tailwind.

---

## Form — Radio

| State | Visual |
|---|---|
| Unchecked | 16×16px circle, `border-n-400` |
| Checked | `border-p-500`, 8px inner dot `bg-p-500` |

---

## Form — Toggle

Track 30×18px, `rounded-full`. Knob 14×14px white circle.

| State | Track | Knob |
|---|---|---|
| Off | `bg-n-300` | `left-[2px]` |
| On | `bg-p-500` | `left-[14px]` |

---

## Card

### Standard Card

```tsx
<Card className="p-5">
  <p className="text-[13.5px] font-semibold text-n-800">Próxima cita</p>
  <p className="text-[12px] text-n-500 mt-0.5">Martes 22 abr · 10:30 AM</p>
</Card>
```

Base styles: `bg-n-0 border border-n-200 rounded-md`. Padding `p-5` (20px).

### List Item Card

Horizontal layout — avatar/icon + main content + trailing metadata.

```tsx
<div className="flex items-center gap-3 px-4 py-3 hover:bg-n-25 cursor-pointer">
  <Avatar initials="AR" size="sm" />
  <div className="flex-1 min-w-0">
    <p className="text-[13.5px] font-semibold text-n-800 truncate">Ana María Reyes</p>
    <p className="text-[12px] text-n-500 mt-0.5">Cédula · 001-1234567-8 · 42 años</p>
  </div>
  <Badge variant="active">Activo</Badge>
</div>
```

### Selected Card

```tsx
<Card className="border-p-500 relative pl-5
  before:absolute before:left-0 before:top-3 before:bottom-3
  before:w-[2px] before:bg-p-500 before:rounded-full p-5">
```

---

## Table

```tsx
<table className="w-full border border-n-200 rounded-md bg-n-0 border-collapse">
  <thead>
    <tr className="bg-n-50">
      <th className="px-4 py-3 text-left text-[11.5px] font-semibold text-n-600 uppercase tracking-[0.06em]">
        Paciente
      </th>
    </tr>
  </thead>
  <tbody>
    <tr className="border-t border-n-100 hover:bg-n-25">
      <td className="px-4 py-3 text-[13px] font-semibold text-n-800">Ana María Reyes</td>
    </tr>
  </tbody>
</table>
```

Mono data cells: `font-mono text-[12px] text-n-600`.

---

## Badge / Status Chip

Source: `Badge.tsx`. Sizes: 11.5px font, `px-2 py-1 rounded-sm`.

| Variant | Prop | Bg | Border | Text |
|---|---|---|---|---|
| Draft | `variant="draft"` | `bg-n-50` | `border-n-200` | `text-n-600` |
| Active | `variant="active"` | `bg-success-bg` | `border-success-border` | `text-success-text` |
| Signed | `variant="signed"` | `bg-p-50` | `border-p-100` | `text-p-700` |
| Review | `variant="review"` | `bg-warning-bg` | `border-warning-border` | `text-warning-text` |
| Archived | `variant="archived"` | `bg-n-50` | `border-n-200` | `text-n-500` |
| Paid | `variant="paid"` | `bg-success-bg` | `border-success-border` | `text-success-text` |
| Overdue | `variant="overdue"` | `bg-danger-bg` | `border-danger-border` | `text-danger-text` |

Each badge includes a 6px dot matching the text color.

---

## Tabs

Source: `Tabs.tsx` (wraps `@radix-ui/react-tabs`).

```tsx
<Tabs defaultValue="todos">
  <TabsList className="border-b border-n-200">
    <TabsTrigger value="todos">Todos</TabsTrigger>
    <TabsTrigger value="activos">Activos</TabsTrigger>
  </TabsList>
  <TabsContent value="todos">…</TabsContent>
</Tabs>
```

Active tab: `text-n-900 border-b-2 border-p-500` (sits at `mb-[-1px]` to cover container border).

---

## Sidebar Navigation

```tsx
<aside className="w-sidebar h-screen sticky top-0 flex flex-col
  bg-n-25 border-r border-n-200 py-5">

  {/* Brand */}
  <div className="px-5 pb-5 mb-3.5 border-b border-n-100 flex items-center gap-2.5">
    <div className="w-7 h-7 bg-p-500 rounded-sm flex items-center justify-center
      text-white font-serif font-medium text-[16px]">R</div>
    <span className="font-serif font-medium text-[18px] text-n-900 tracking-[-0.01em]">
      Rezeta
    </span>
  </div>

  {/* Section label */}
  <span className="px-5 pt-3 pb-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-n-400">
    Clínico
  </span>

  {/* Nav item — inactive */}
  <a className="flex items-center gap-2.5 px-5 py-[7px] text-[13px]
    text-n-600 hover:bg-n-50 hover:text-n-800">
    <i className="ph ph-calendar-blank text-n-500" style={{ fontSize: 16 }} />
    Agenda
    <span className="ml-auto font-mono text-[11px] text-n-400">3</span>
  </a>

  {/* Nav item — active (2px teal rule) */}
  <a className="relative flex items-center gap-2.5 px-5 py-[7px] text-[13px]
    font-medium text-n-900 bg-n-0
    before:absolute before:left-0 before:top-1.5 before:bottom-1.5
    before:w-[2px] before:bg-p-500">
    <i className="ph-fill ph-users text-p-500" style={{ fontSize: 16 }} />
    Pacientes
  </a>
</aside>
```

---

## Top Bar

```tsx
<header className="h-topbar bg-n-0 border-b border-n-200
  flex items-center px-6 gap-4 sticky top-0 z-20">

  {/* Location switcher */}
  <button className="flex items-center gap-2 px-2.5 py-1.5
    border border-n-200 rounded-sm hover:bg-n-50">
    <span className="w-1.5 h-1.5 rounded-full bg-p-500" />
    <span className="text-[13px] font-medium text-n-800">Centro Médico Real</span>
    <i className="ph ph-caret-down text-n-400" />
  </button>

  {/* Search */}
  <button className="flex-1 max-w-[480px] relative">
    <i className="ph ph-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-n-400" />
    <div className="h-input-md w-full pl-9 pr-3 border border-n-200 rounded-sm
      bg-n-0 text-[13px] text-n-400 flex items-center">
      Buscar paciente, protocolo, factura…
    </div>
    <kbd className="absolute right-2 top-1/2 -translate-y-1/2
      font-mono text-[10px] text-n-500 border border-n-200 bg-n-25 px-1.5 py-[2px] rounded-sm">
      ⌘K
    </kbd>
  </button>
</header>
```

---

## Modal

Source: `Modal.tsx` (wraps `@radix-ui/react-dialog`).

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

Overlay: `bg-[rgba(14,14,13,0.35)]`. Dialog: `w-[440px] bg-n-0 rounded-md shadow-floating`.
Large variant: `w-[560px]`.

---

## Toast / Notification

Source: `Toast.tsx` + `Toaster.tsx` (wraps `@radix-ui/react-toast`).

```tsx
import { useToast } from '@/components/ui/Toaster'

const { toast } = useToast()
toast({ variant: 'success', title: 'Pago recibido', description: 'RD$ 3,450.00 acreditados.' })
```

Variants: `success` | `warning` | `danger` | `info`. Width 380px, `shadow-floating rounded-md`.

---

## Callout (Inline Alert)

Source: `Callout.tsx`.

```tsx
<Callout variant="warning">
  <i className="ph ph-warning-circle" />
  <div>
    <p className="font-semibold">Revisión pendiente</p>
    El protocolo tiene 3 bloques sin revisar.
  </div>
</Callout>
```

Variants: `success` | `warning` | `danger` | `info`. Each applies `bg-{semantic}-bg border-{semantic}-border text-{semantic}-text`.

---

## Empty State

Source: `EmptyState.tsx`.

```tsx
<EmptyState
  icon="ph-user"
  title="Aún no hay pacientes registrados"
  description="Registra a tu primer paciente para empezar a gestionar citas, consultas y prescripciones desde un solo lugar."
>
  <Button variant="primary">Registrar paciente</Button>
</EmptyState>
```

Container: `bg-n-0 border border-dashed border-n-200 rounded-md p-12 flex flex-col items-center text-center`.
Icon circle: 56px, `bg-n-50 text-n-500`. Title: serif 500 `text-n-800`. Description: sans `text-n-500 max-w-[42ch]`.

---

## Protocol Block

The product's signature component. Source: `ProtocolBlock.tsx`.

```tsx
import { ProtocolBlock } from '@/components/ui/ProtocolBlock'

<ProtocolBlock
  type="checklist"
  title="Evaluación inicial"
  required={true}
  items={[
    { id: 'itm_01', text: 'Permeabilidad de vía aérea', critical: true },
    { id: 'itm_02', text: 'Estado de consciencia', critical: false },
  ]}
/>
```

**Block header** has a 2px teal rule on the left via `before:` pseudo-element. Type chip uses `font-mono text-[10.5px] uppercase text-p-700 bg-p-50 border border-p-100 rounded-sm`.

Supported block types: `section` | `text` | `checklist` | `steps` | `decision` | `dosage_table` | `alert`.

---

## Anchor Rule

The 2px vertical teal rule is the product's signature. Apply via Tailwind `before:` utilities:

```tsx
className="relative before:absolute before:left-0 before:top-[4px] before:bottom-[4px]
  before:w-[2px] before:bg-p-500"
```

Applied to: active sidebar item, selected cards, protocol block headers.

---

## Page Layout

```tsx
<div className="flex min-h-screen bg-n-25">
  <aside className="w-sidebar">…</aside>
  <div className="flex-1 ml-sidebar flex flex-col">
    <header className="h-topbar sticky top-0 z-20">…</header>
    <main className="flex-1 p-8 xl:px-12">…</main>
  </div>
</div>
```
