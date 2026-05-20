# 03 · State & Data

**The data model in `medical_app/specs/protocol-in-consultation-spec.md` is the source of truth.** This document only lists what this *visual redesign* additionally requires. Everything else (ProtocolUsage working copy, modifications array, protocol chains, learning system) stays as specced.

---

## Schema additions

### `User.preferences.consultationViewMode`

Enum: `'soap' | 'canvas'`. Default `'soap'`. Stored on the existing `User` row's `preferences` JSON column. No migration needed if `preferences` already exists; otherwise add it.

### `ProtocolUsage.status` — new enum value

Existing values: `in_progress | completed | abandoned`.
Add: `switched` — set when the doctor changes protocol mid-consultation (frame `03-edge.png`). Old usage remains for audit; new usage starts fresh.

### `ProtocolUsage.modifications` — new modification kinds

Already a JSONB array per existing spec. Add three modification kinds:

```ts
type Modification =
  | { kind: 'step_completed'; stepId: string; at: string }
  | { kind: 'step_skipped'; stepId: string; reason: SkipReason; at: string }
  | { kind: 'step_uncompleted'; stepId: string; at: string }
  | { kind: 'branch_selected'; blockId: string; branchId: string; at: string }
  | { kind: 'medication_changed'; ...existing... }
  // NEW:
  | { kind: 'off_protocol_note'; noteId: string; text: string; at: string }
  | { kind: 'off_protocol_note_promoted'; noteId: string; toField: 'subjective'|'objective'|'assessment'|'plan'; at: string }
  | { kind: 'conditional_step_activated'; stepId: string; trigger: string; at: string }

type SkipReason = 'requires_finding' | 'patient_refused' | 'not_relevant' | 'other'
```

---

## API additions

### `GET /v1/patients/:id/protocol-suggestions`

Returns ranked protocols for the gate's "Para Isabel" cards. Server logic:

1. Last 3 protocols this doctor used with this patient (deduped, most recent first) → top of list.
2. Protocols matching the patient's active diagnoses.
3. Protocols flagged as favourite by this doctor.

Response:

```ts
{
  suggestions: Array<{
    protocol: ProtocolListItem
    reason: 'recent_with_patient' | 'matches_diagnosis' | 'favorite'
    lastUsedAt?: string
    score: number  // 0–100, for UI sort & "match %" badge
  }>
}
```

If the endpoint is too much for slice 1, fall back to client-side sorting of `useProtocols()` by `last_used_at` from existing `ProtocolUsage` rows. Mark this as a follow-up.

### `POST /v1/consultations` — accept optional `protocol_id`

Currently creates a blank consultation. Accept an optional `{ protocolId: string }` body so the gate can do "create + addProtocolUsage" in one round trip. Server still uses the existing `ProtocolUsage` creation path internally.

### `PATCH /v1/consultations/:id/protocol-usages/:usageId/status`

Set `status: 'switched'` when switching mid-consultation. Existing controller likely already supports a generic patch — verify before adding.

---

## Client state

### `store/ui.store.ts` — additions

```ts
viewMode: 'soap' | 'canvas'
setViewMode: (m: 'soap' | 'canvas') => void  // also persists to user.preferences
missingFieldsPanelOpen: boolean
```

### React Query keys

No new query keys; reuse:
- `['consultations', id]`
- `['consultations', id, 'protocol-usages']`
- `['protocols', { status: 'active' }]`
- New: `['patients', id, 'protocol-suggestions']`

### Local component state

- `ProtocolStrip` — `stepListOpen: boolean` (popover).
- `ConsultationGate` — `searchQuery: string`, `specialtyFilter: string | null`.
- `SwitchProtocolDialog` — `confirmText: string`.

---

## What does NOT change

- Working-copy model (`ProtocolUsage.content`).
- Modification tracking format beyond the additions above.
- Order queue store.
- Prescription / imaging order / lab order schemas.
- Protocol template or version schemas.
- Sign / amend flow.
- Audit logs.
