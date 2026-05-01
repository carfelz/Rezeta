# Implement: Audit Logging System

You are implementing a comprehensive audit logging feature for the medical ERP. The plan has been discussed and finalized in conversation; your job is to execute it.

---

## Read first — do not skip

Before writing any code or spec content, read these files to ground yourself in the existing architecture, conventions, and design system:

- `CLAUDE.md`
- `specs/technical-architecture.md` — especially **§10 Audit Logging & Immutability** (the existing baseline you're extending) and §6 Database & Data Access, §9 Multi-Tenancy & Data Isolation, §13 Observability
- `specs/medical_erp_erd.mmd` — the `AuditLog` entity already exists in the ERD
- `specs/full-scope.md`
- `specs/business-model.md` — plan tiers (Free / Pro / Clinic), relevant for UI-level retention gating
- `specs/mvp-scope.md`
- `specs/protocol-template-schema.md` — reference for spec doc tone and structure
- `specs/design-system/tokens.md`
- `specs/design-system/components.md`
- `specs/design-system/principles.md`
- `specs/design-system/implementation.md`
- `design-system/tokens.css` and `design-system/components.css`
- `design-system/app-prototype.html` — look at `/ajustes` for layout reference
- `design-system/reference.html`

If any file is missing, ambiguous, or contradicts something below, **stop and ask** before inventing. The CLAUDE.md says "If the user asks about something not covered in specs, ask before inventing" — that applies here too.

---

## Goal

Build a unified audit log that records every meaningful event in the system, with:

- Who did it (user, or null for system / cron / webhook actors)
- When
- What changed (full before/after diff for entity mutations)
- Significant payload in a flexible JSONB metadata field
- Multi-tenant isolation enforced at the repository layer
- Append-only, immutable storage (no edits, no deletes, ever)

This extends the `AuditLog` table sketched in `technical-architecture.md` §10 to cover **four categories of events**: entity mutations, auth events, communications (email), and system events.

---

## Architectural constraints (non-negotiable)

From `CLAUDE.md` and the existing principles:

- Every record has `tenant_id` and is isolated by it
- UUIDs for primary keys
- TIMESTAMPTZ for all time fields
- Append-only — **no `updated_at`, no `deleted_at` on the audit table**
- Plain SQL via Prisma migrations checked into source control
- Tenant scoping enforced at the repository layer
- Spanish UI copy; English code, comments, and spec docs

---

## Step 1 — Write the spec

Create `specs/audit-log-spec.md`. Match the tone, structure, and formatting of the existing spec docs (see `specs/protocol-template-schema.md` and `specs/technical-architecture.md` as references):

- Top header with title, `> Living document. Last updated: <current month> 2026.`, and a one-paragraph purpose statement
- Numbered Table of Contents
- Numbered sections with clear headings
- Tables for tabular content
- Code blocks for schemas
- Direct, specific, professional prose — no marketing language, no hedging

### Sections the spec must include

1. **Overview** — what this is, why it exists, relationship to operational logs (Cloud Logging, §13) and Sentry. Make the distinction crisp: audit log is the legal/business system of record, Cloud Logging is for debugging/perf.
2. **Event categories** — the four categories (entity, auth, communication, system) with the full closed enum of actions per category (see below).
3. **Schema** — full `AuditLog` table definition with column-level rationale.
4. **Indexes** — every index and the query pattern it serves.
5. **Write mechanisms** — three paths (NestJS interceptor, Prisma extension, explicit `AuditLogService.record()`) with rules for which to use when.
6. **What gets logged** — entity events, auth events, communication events, system events.
7. **What does NOT get logged** — read events (deferred to a separate `access_log` table in v2; flag this in the spec but do not implement), Sentry-level errors, high-frequency telemetry, drafts/autosaves.
8. **Sensitive data handling** — redaction rules, the `redactForAudit()` helper, what's never logged.
9. **Email lifecycle tracking** — how a single email produces multiple audit rows tied by `metadata.message_id`. **Explicitly state: no open tracking.**
10. **Auth event handling** — record only, no lockout / rate-limit logic.
11. **Storage and retention** — storage is always full and indefinite; UI exposes data filtered by plan tier.
12. **Plan-tier UI gating** — include the table below verbatim.
13. **Read API** — paginated, filtered, plan-aware retention filter applied at the API layer.
14. **Frontend module** — `/ajustes/registros` ("Registros de actividad"), table layout, filters, detail drawer.
15. **Tenant + role isolation** — owner sees all events in tenant; doctor (when multi-user lands) sees only their own events plus events on records they own. Code the rule from day one even though MVP is single-user.
16. **Tamper-evidence** — flagged as a future addition (hash-chain), explicitly **not** in MVP. Note that the schema leaves room.
17. **Implementation slices** — the 5-slice plan from this prompt.

### Decisions to encode in the spec

**Schema:**

```
AuditLog
├── id                UUID, primary key
├── tenant_id         UUID, indexed, nullable
│                     (null only for tenant-creation/signup events)
├── actor_user_id     UUID, nullable
│                     (null when actor is system/cron/webhook)
├── actor_type        enum: 'user' | 'system' | 'webhook' | 'cron'
├── on_behalf_of_id   UUID, nullable
│                     (impersonation support — schema only, no impl in MVP)
├── category          enum: 'entity' | 'auth' | 'communication' | 'system'
├── action            enum (closed list — see below)
├── entity_type       string, nullable    -- 'Patient', 'Consultation', etc.
├── entity_id         UUID, nullable
├── changes           JSONB, nullable
│                     -- field-level diff for updates:
│                     -- { field: { before, after } }
├── metadata          JSONB, nullable     -- open payload for everything else
├── request_id        string, indexed     -- correlates with Cloud Logging trace
├── ip_address        inet, nullable
├── user_agent        text, nullable
├── status            enum: 'success' | 'failed'
├── error_code        string, nullable    -- when status='failed'
└── created_at        TIMESTAMPTZ, indexed
```

No `updated_at`, no `deleted_at`. The table is append-only.

**Action enum (closed list):**

| Category        | Actions                                                                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `entity`        | `create`, `update`, `delete`, `restore`, `sign`, `amend`, `archive`, `lock`, `unlock`                                                                 |
| `auth`          | `login`, `logout`, `login_failed`, `password_change`, `mfa_enabled`, `session_revoked`, `permission_granted`, `permission_revoked`                    |
| `communication` | `email_queued`, `email_sent`, `email_delivered`, `email_bounced`, `sms_sent`, `whatsapp_sent`, `notification_sent`, `pdf_generated`, `pdf_downloaded` |
| `system`        | `reminder_sent`, `invoice_issued`, `prescription_dispensed`, `export_generated`, `report_run`, `backup_verified`, `webhook_received`                  |

**Notably absent:** `email_opened`. We do not track opens.

**Indexes:**

```
(tenant_id, created_at DESC)               -- "show me everything in my org"
(tenant_id, entity_type, entity_id)        -- "show history for this patient"
(tenant_id, actor_user_id, created_at DESC) -- "what did Dr. X do this week?"
(action, created_at DESC)                  -- "show all email_sent events"
GIN on metadata                            -- ad-hoc queries (e.g. by recipient)
```

When the table exceeds ~50M rows, partition by month — note this in the spec but do not implement now.

**Plan-tier UI gating:**

| Plan   | UI exposes                     |
| ------ | ------------------------------ |
| Free   | Last 30 days                   |
| Pro    | Last 12 months                 |
| Clinic | Unlimited history + CSV export |

**Storage policy:** all rows kept indefinitely. Plan tier only filters the API/UI view. If a customer downgrades, their data is **not deleted** — it's just hidden until they upgrade again. This is both a legal safety measure (DR Law 87-01, medical record retention) and a UX feature (upgrade restores access to historical data).

**Frontend route:** `/ajustes/registros`, label **"Registros de actividad"** (Spanish UI default).

**Sensitive field policy:**

- **Full before/after for clinical fields** (Patient.notes, Consultation.\*, Prescription items, Invoice items, etc.). Inherits the same access controls as the source record.
- **Never log:** passwords, password hashes, OAuth tokens, Firebase ID tokens, full credit card numbers, full RNC/cédula numbers (log last 4 only), API keys.
- A `redactForAudit(entityType, payload)` helper centralizes redaction. Single source of truth, easy to update when a new sensitive field is introduced.

---

## Step 2 — Update CLAUDE.md

Add `@./specs/audit-log-spec.md` to the **Specification Documents** section. Place it in a sensible position (logically grouped with other infrastructure-level specs like `technical-architecture.md`).

Do **not** otherwise edit `CLAUDE.md`. The file is intentionally concise (target <200 lines).

---

## Step 3 — Implement (5 slices, sequential)

Each slice is its own commit. Do **not** start the next slice until the current one passes type-check, lint, and tests. Pause for review at the end of each slice and produce a short summary of what changed.

### Slice 1 — Foundation

**Deliverables:**

- Prisma schema additions in `packages/db/schema.prisma` (per `technical-architecture.md` §6)
- Migration: `add_audit_log` (cleanly named, reversible)
- `AuditLogService.record(event)` in `apps/api/src/common/audit-log/`
- `redactForAudit()` helper with comprehensive unit tests
- Repository for inserts and tenant-scoped queries
- Unit tests covering: redaction rules, tenant isolation, append-only enforcement (the service must reject any update or delete attempt)

**Acceptance:**

- `prisma migrate dev` runs cleanly; `prisma migrate deploy` is reversible
- `AuditLogService.record({...})` writes a row with all fields populated correctly
- Attempting to update or delete an audit row throws a clear, typed error
- Every redaction rule covered by an explicit test case
- Tenant scoping verified by a cross-tenant test (tenant A query returns zero of tenant B's rows)

### Slice 2 — Auto-capture for entity mutations

**Deliverables:**

- `AuditLogInterceptor` (NestJS global interceptor) wrapping every controller mutation
- Prisma extension as a backstop for ORM mutations outside the HTTP path (seed scripts, background jobs)
- Audit write happens inside the same DB transaction as the mutation (commit/rollback together)
- `request_id` propagated from request context into every audit row
- Diff generation for `update` actions — clean `{ field: { before, after } }` shape

**Acceptance:**

- Creating, updating, and deleting any entity through a controller produces a correct audit row
- A failing mutation produces zero audit rows (transaction rollback test)
- The diff for updates contains only changed fields, not the full record
- Sensitive fields are redacted in the diff per the redaction helper
- An ORM mutation outside an HTTP handler still produces an audit row via the Prisma extension

### Slice 3 — Auth, communication, and system events

**Deliverables:**

- **Auth events:** hook into the Firebase auth flow to record `login`, `logout`, `login_failed`, `password_change`. Capture IP and user agent. **No lockout/rate-limit logic — record only.**
- **Email events:** `email_queued` on enqueue; `email_sent`, `email_delivered`, `email_bounced` from provider webhooks (SendGrid or Resend per `technical-architecture.md` §1). All chained by `metadata.message_id`. Webhook handlers must verify provider signatures before recording.
- **System events:** `reminder_sent`, `invoice_issued`, `pdf_generated`, etc. — recorded via explicit `AuditLogService.record()` calls in the relevant services.

**Acceptance:**

- A successful login produces a `login` event with IP and user agent
- A failed login produces a `login_failed` event; no lockout side effect
- Sending one email produces a chain of audit rows tied by `message_id`
- Webhook handlers reject unsigned/invalidly-signed requests before recording
- A test covers the email lifecycle: queued → sent → delivered

### Slice 4 — Read API

**Deliverables:**

- `GET /v1/audit-logs` — cursor-paginated, filtered by date range, actor, category, action, entity type, entity ID
- `GET /v1/audit-logs/:id` — single event detail
- `GET /v1/audit-logs/export.csv` — Clinic plan only
- Plan-aware retention filter applied at the controller/service layer (Free → 30d, Pro → 12mo, Clinic → unlimited)
- Tenant + role isolation: owner sees all events in tenant; doctor sees own events + events on records they own
- Zod schemas in `packages/shared` for all request/response shapes
- Error codes added to the closed enum in `packages/shared/errors.ts`

**Acceptance:**

- 401 without auth, 403 with insufficient role, 404 across tenants
- Plan filter is honored regardless of query parameters: a Free user requesting older data gets an empty list, **not** an error
- CSV export rejects non-Clinic plans with a clear error code (e.g., `AUDIT_EXPORT_REQUIRES_CLINIC_PLAN`)
- Pagination is cursor-based and stable
- All endpoints documented in OpenAPI (Swagger auto-generation per `technical-architecture.md` §5)

### Slice 5 — Frontend module (`/ajustes/registros`)

**Deliverables:**

- Route: `/ajustes/registros`, navigation entry under the existing `/ajustes` Settings section
- Page label: **"Registros de actividad"** (Source Serif 4)
- Table columns:
  - Timestamp (IBM Plex Mono, format `18 abr 2026, 9:34 AM`)
  - Actor (user full name, or `Sistema` / `Cron` / `Webhook` for non-user actors)
  - Category badge (Entidad / Autenticación / Comunicación / Sistema)
  - Action (translated to Spanish — see translation map below)
  - Entity (e.g., "Consulta de Ana María Reyes") with deep link to the record
  - Status indicator (success = subtle, failed = warning color from `tokens.css`)
- Filters (top of page):
  - Date range (default: last 7 days)
  - Actor multi-select (users in tenant)
  - Category chips, multi-select
  - Action dropdown (dependent on selected categories)
  - Entity type
  - Patient name search (joins to entity → patient lookup)
- Row click → right-side detail drawer:
  - Full event metadata
  - For `update` actions: clean diff view (`field: before → after`)
  - For `email_*` events: recipient, template, subject, timeline of subsequent events for the same `message_id`
  - For `login_failed`: IP, user agent, geo if available
  - "Ver registro relacionado" link to the entity (for entity events)
- Empty state per `principles.md` voice:
  ```
  (serif)  Aún no hay actividad registrada
  (sans)   Cuando uses el sistema, aparecerá aquí cada acción —
           consultas firmadas, citas creadas, emails enviados.
  ```
- Plan-tier banner if user is on Free or Pro:
  ```
  (sans)   Estás viendo los últimos {N} días.
           Actualiza tu plan para ver el historial completo.
  ```
- CSV export button visible only on Clinic
- Stack: TanStack Query, React Hook Form for filters, Phosphor Icons (regular weight)

**Action translation map (Spanish):**

| Action                   | Spanish label            |
| ------------------------ | ------------------------ |
| `create`                 | Creado                   |
| `update`                 | Actualizado              |
| `delete`                 | Eliminado                |
| `restore`                | Restaurado               |
| `sign`                   | Firmado                  |
| `amend`                  | Enmendado                |
| `archive`                | Archivado                |
| `lock`                   | Bloqueado                |
| `unlock`                 | Desbloqueado             |
| `login`                  | Inicio de sesión         |
| `logout`                 | Cierre de sesión         |
| `login_failed`           | Inicio de sesión fallido |
| `password_change`        | Cambio de contraseña     |
| `email_queued`           | Email en cola            |
| `email_sent`             | Email enviado            |
| `email_delivered`        | Email entregado          |
| `email_bounced`          | Email rechazado          |
| `pdf_generated`          | PDF generado             |
| `pdf_downloaded`         | PDF descargado           |
| `reminder_sent`          | Recordatorio enviado     |
| `invoice_issued`         | Factura emitida          |
| `prescription_dispensed` | Receta dispensada        |
| `export_generated`       | Exportación generada     |
| `webhook_received`       | Webhook recibido         |

(Add the rest from the action enum following the same pattern.)

**Acceptance:**

- Every color, spacing value, radius, and type size references a token from `tokens.css`. **No raw hex values, no arbitrary pixel sizes.**
- Layout matches the patterns in `app-prototype.html` for `/ajustes`
- Typography follows the scale exactly — no new sizes or weights introduced
- Spacing follows the 4/8/12/16/24/32 scale
- All Spanish copy follows `principles.md` voice (direct, specific, clinical, never apologetic)
- Mobile responsive (PWA per `mvp-scope.md` — design system requires min touch target 44px)
- Tested at common viewports
- The 2px teal vertical rule appears on the active filter chip and selected row, per the design system signature element

---

## Conventions to follow

- Indentation: 2 spaces
- DB: `snake_case`
- TypeScript: `camelCase`
- Tests live alongside source in `__tests__/` directories
- Zod schemas for all request/response bodies in `packages/shared`
- Error codes: closed enum in `packages/shared/errors.ts`
- Spanish UI copy, English code/comments/spec docs
- React Hook Form + Zod for all forms; TanStack Query for data fetching
- Phosphor Icons (regular weight only)

---

## What NOT to do

- **Do not log read events.** PHI access logs are deferred to a separate `access_log` table in v2 — flag this in the spec, do not implement.
- **Do not implement open-tracking pixels for emails.** No `email_opened` action.
- **Do not add lockout/rate-limit logic** to `login_failed` handling. Record only.
- **Do not hard-delete audit rows** when a user downgrades. Storage is always full; only the UI is filtered.
- **Do not add tamper-evidence (hash chains).** Flag in the spec for future, no implementation in MVP.
- **Do not invent fields, actions, or categories** not specified above. If something seems missing, stop and ask.
- **Do not write raw hex values, arbitrary px sizes, or one-off type sizes** in the frontend. Use tokens.

---

## Deliverables checklist

- [ ] `specs/audit-log-spec.md` written, matching the project's spec doc tone
- [ ] `CLAUDE.md` updated with the new spec reference (one line added)
- [ ] **Slice 1** merged: schema, service, redaction, tests
- [ ] **Slice 2** merged: interceptor + Prisma extension + tests
- [ ] **Slice 3** merged: auth + email + system event capture + tests
- [ ] **Slice 4** merged: read API + plan gating + tenant/role isolation + tests
- [ ] **Slice 5** merged: frontend module + design system compliance + tests
- [ ] All slices typecheck and lint clean
- [ ] At the end of each slice, a short summary of what changed and any decisions made

When you finish a slice, **stop and summarize before proceeding to the next.** This is a multi-day implementation; pacing and review at slice boundaries matters more than speed.
