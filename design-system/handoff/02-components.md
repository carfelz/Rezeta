# 02 · Components

What's new, what changes, what's reused. Everything below targets `medical_app/apps/web/src/components/`.

---

## NEW components

### `consultations/ConsultationGate.tsx`

The Start Gate. Rendered by `pages/ConsultaNueva.tsx`.

```ts
interface ConsultationGateProps {
  patient: Patient
  onPicked: (choice: GateChoice) => void  // creates Consultation + optional ProtocolUsage server-side
  onSkip: () => void
}

type GateChoice =
  | { kind: 'recent'; protocolId: string; lastUsedAt: string }   // "Para Isabel" cards
  | { kind: 'search'; protocolId: string }                       // search/specialty grid
  | { kind: 'specialty-bucket'; specialty: string }              // opens picker filtered
```

Frames: `01-hybrid.png`, `02-hybrid.png`, `08-edge.png`.

Internals:
- `RecentForPatientGrid` — calls `GET /v1/patients/:id/protocol-suggestions` (new endpoint, see `03-state-and-data.md`).
- `ProtocolSearch` — wraps existing `ProtocolPickerModal`'s search hook.
- `SpecialtyBuckets` — static list from `useProtocolTypes()`.
- Empty state when `protocols.length === 0`.

### `consultations/ProtocolStrip.tsx`

Full-width band that replaces the right-rail "Protocolo activo" card. Always shown when a `ProtocolUsage` exists.

```ts
interface ProtocolStripProps {
  usage: ProtocolUsage
  totalSteps: number
  completedSteps: number
  currentStepIdx: number | null
  viewMode: 'soap' | 'canvas'
  onViewModeChange: (m: 'soap' | 'canvas') => void
  onOpenStepList: () => void          // popover with all steps
  onSwitchProtocol: () => void        // opens SwitchProtocolDialog
}
```

Frames: every `*-hybrid.png` from 03 onward, plus `04-edge.png` for multi-usage variant.

Variants:
- `single` — one usage. Default.
- `multi` — two+ usages, renders pills with active indicator.

### `consultations/ViewModeToggle.tsx`

Segmented control inside `ProtocolStrip`. Persists user preference via `useUserPreferences().consultationViewMode`.

### `consultations/CanvasView.tsx`

Flow E rendered on the same `Consultation + ProtocolUsage` data. Replaces `<SoapView/>` inside the consultation body when `viewMode === 'canvas'`.

```ts
interface CanvasViewProps {
  consultation: Consultation
  usage: ProtocolUsage
}
```

Renders each step as `<ProtoStep/>` (already in mocks) using the existing `BlockRendererRunMode` for block content.

### `consultations/SoapView.tsx`

Extracted from current `Consulta.tsx` — same SOAP cards, same fields, but as a standalone component so `Consulta.tsx` can mount either `SoapView` or `CanvasView`. No behaviour change in this file.

### `consultations/SkipStepDialog.tsx`

Frame `01-edge.png`. Reasons: `requires_finding | patient_refused | not_relevant | other`. On confirm, calls existing `useUpdateCheckedState` with `state: 'skipped'` + reason.

### `consultations/SwitchProtocolDialog.tsx`

Frame `03-edge.png`. Three-column diff (kept / moved / discarded). Confirm-by-typing the new protocol name. Server: `POST /v1/consultations/:id/protocol-usages` (existing) + `PATCH` old usage with `status: 'switched'` (new value, see open Q5).

### `consultations/OffProtocolNote.tsx`

Frame `02-edge.png`. Card with dashed border, two actions ("Convertir en paso" → Suggestion to template editor; "Mover a Subjetivo" → append to that SOAP field, delete the note).

### `consultations/ResumeBanner.tsx`

Frame `07-edge.png`. Rendered before consultation body when `consultation.status === 'in_progress' && now - consultation.updated_at > 10min`. Dismissible; "Continuar" focuses the current step.

### `consultations/MissingFieldsPanel.tsx`

Frame `06-edge.png`. Slides in over the right rail when sign is blocked. Reads from `usage.content` walking required blocks; for each unmet, shows a "Ir →" that scrolls + focuses.

---

## CHANGED components

### `pages/ConsultaNueva.tsx`

Currently: stub that creates a blank Consultation and redirects. Now: hosts `ConsultationGate`. Gate's `onPicked` makes the same server calls today's stub does, plus an `addProtocolUsage` if a protocol was chosen.

### `pages/Consulta.tsx`

- Splits its render into `<SoapView/>` / `<CanvasView/>` based on view-mode toggle.
- Removes the existing right-rail "Protocolo activo" card (replaced by `ProtocolStrip` above the body).
- Mounts `ResumeBanner` if appropriate.
- Mounts `MissingFieldsPanel` when sign is blocked (replaces the current quiet "no se puede firmar" toast).
- All other behaviour (vitals, diagnoses, save, sign, amend) untouched.

### `components/protocols/ProtocolPickerModal.tsx`

Reused by `ProtocolStrip` ("Cambiar"). One prop addition: `currentProtocolId?: string` so the current protocol is hidden from the list.

### `components/consultations/OrderQueuePanel.tsx`

Reused unchanged in both `SoapView` and `CanvasView` — it lives in the right rail in SOAP mode and in a drawer in Canvas mode (Canvas's right rail is "Resultado SOAP"). One prop addition: `placement?: 'rail' | 'drawer'` (drawer = collapsed by default, opens over the canvas).

---

## REUSED unchanged

- `components/protocols/BlockRendererRunMode.tsx` — renders protocol blocks; both views call it.
- `components/ui/*` — Button, Modal, Tabs, Input, Card, Badge, Callout, EmptyState.
- `store/order-queue.store.ts` — order queue is shared across views.
- `hooks/consultations/use-consultations.ts` — every existing hook (`useAddProtocolUsage`, `useUpdateCheckedState`, `useRemoveProtocolUsage`, `useSignConsultation`, `useAmendConsultation`) is reused.

---

## Component tree (after redesign)

```
Consulta.tsx
├── ConsultationHeader (existing)
├── ResumeBanner (new, conditional)
├── ProtocolStrip (new, conditional on hasUsage)
│   ├── ViewModeToggle
│   └── SwitchProtocolDialog
├── ConsultationBody
│   ├── SoapView (existing markup, extracted)
│   │   ├── VitalsSection (existing)
│   │   ├── SOAP cards (existing)
│   │   ├── OffProtocolNote (new, when applicable)
│   │   └── OrderQueuePanel (existing) [right rail]
│   └── CanvasView (new)
│       ├── ProtoStep × N
│       │   └── BlockRendererRunMode (existing)
│       └── OrderQueuePanel (existing) [drawer]
└── MissingFieldsPanel (new, conditional)

ConsultaNueva.tsx
└── ConsultationGate (new)
    ├── RecentForPatientGrid
    ├── ProtocolSearch
    ├── SpecialtyBuckets
    └── EmptyState (when no protocols)
```
