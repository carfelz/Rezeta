# 04 · Code Mapping

File-by-file, what changes and what gets created. Paths are relative to `medical_app/`.

---

## Web (`apps/web/src/`)

### Created

| Path | Purpose |
|---|---|
| `components/consultations/ConsultationGate.tsx` | The Start Gate. |
| `components/consultations/ProtocolStrip.tsx` | Full-width strip under header. |
| `components/consultations/ViewModeToggle.tsx` | SOAP ↔ Canvas segmented control. |
| `components/consultations/SoapView.tsx` | Extracted from `pages/Consulta.tsx`. |
| `components/consultations/CanvasView.tsx` | Flow E renderer. |
| `components/consultations/ProtoStep.tsx` | Single step in Canvas view. |
| `components/consultations/SkipStepDialog.tsx` | Skip with reason. |
| `components/consultations/SwitchProtocolDialog.tsx` | Mid-consultation switch. |
| `components/consultations/OffProtocolNote.tsx` | Dashed-border note card. |
| `components/consultations/ResumeBanner.tsx` | Welcome-back banner. |
| `components/consultations/MissingFieldsPanel.tsx` | Sign-blocker panel. |
| `hooks/consultations/use-consultation-view-mode.ts` | Persists view mode to user prefs. |
| `hooks/consultations/use-protocol-suggestions.ts` | Calls `GET /v1/patients/:id/protocol-suggestions`. |

### Modified

| Path | What changes |
|---|---|
| `pages/ConsultaNueva.tsx` | From stub redirect to gate host. |
| `pages/Consulta.tsx` | Delete current SOAP markup → moves to `SoapView.tsx`. Mount `ProtocolStrip`, `ResumeBanner`, `MissingFieldsPanel`, view-mode-aware body. |
| `components/protocols/ProtocolPickerModal.tsx` | Add `currentProtocolId?: string` prop, hide that one. |
| `components/consultations/OrderQueuePanel.tsx` | Add `placement?: 'rail' \| 'drawer'`. Drawer mode collapses by default. |
| `store/ui.store.ts` | Add `viewMode`, `missingFieldsPanelOpen`. |
| `hooks/consultations/use-consultations.ts` | Add `useSwitchProtocolUsage` (calls new PATCH). |

### Untouched

Everything in `components/protocols/*` except `ProtocolPickerModal`. The block renderers are reused exactly.

---

## API (`apps/api/src/modules/`)

### Modified

| Path | What changes |
|---|---|
| `consultations/consultations.controller.ts` | Accept `protocolId?` on `POST /v1/consultations`. Add `PATCH /:id/protocol-usages/:usageId/status` (or extend existing patch). |
| `consultations/consultations.service.ts` | Implement "create + addUsage" atomic path. Implement status transitions including `switched`. |
| `consultations/consultations.repository.ts` | `findProtocolSuggestionsForPatient(patientId, doctorId)` — aggregates last usages + favorites. |

### Created

| Path | Purpose |
|---|---|
| `patients/patients.controller.ts` (already exists — add route) | `GET /v1/patients/:id/protocol-suggestions`. |

---

## Shared (`packages/shared/src/`)

### Modified

| Path | What changes |
|---|---|
| `types/consultation.ts` | Add `viewMode` to `UserPreferences`. Add `'switched'` to ProtocolUsage status enum. Add new `Modification` kinds. |
| `schemas/consultation.ts` | Mirror schema changes for Zod validation. |

---

## Database (`packages/db/`)

### Modified

| Path | What changes |
|---|---|
| `prisma/schema.prisma` | If `User.preferences` doesn't exist, add it. No other DB changes (statuses & modifications are JSON). |
| `prisma/migrations/<new>/migration.sql` | Only if `User.preferences` is added. |

The existing migration `20260427000001_protocol_in_consultation` already covers ProtocolUsage and is unchanged.

---

## Tests

For each new component, add a Storybook story (project convention) + a React Testing Library spec for behaviour. For the new endpoint, add to `consultations.controller.spec.ts` and `consultations.repository.spec.ts`.
