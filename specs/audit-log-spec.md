# Audit Log Specification

> Living document. Last updated: May 2026.
>
> This document specifies the design, schema, write mechanisms, read API, frontend module, and implementation plan for the unified audit log in the Medical ERP. The audit log is the legal and business system of record for every meaningful event in the system — distinct from Cloud Logging (which is an operational debugging and performance tool) and from Sentry (which is an error-tracking tool). All three coexist; none substitutes for the others.

## Table of Contents

1. [Overview](#1-overview)
2. [Event Categories](#2-event-categories)
3. [Schema](#3-schema)
4. [Indexes](#4-indexes)
5. [Write Mechanisms](#5-write-mechanisms)
6. [What Gets Logged](#6-what-gets-logged)
7. [What Does NOT Get Logged](#7-what-does-not-get-logged)
8. [Sensitive Data Handling](#8-sensitive-data-handling)
9. [Email Lifecycle Tracking](#9-email-lifecycle-tracking)
10. [Auth Event Handling](#10-auth-event-handling)
11. [Storage and Retention](#11-storage-and-retention)
12. [Plan-Tier UI Gating](#12-plan-tier-ui-gating)
13. [Read API](#13-read-api)
14. [Frontend Module](#14-frontend-module)
15. [Tenant and Role Isolation](#15-tenant-and-role-isolation)
16. [Tamper-Evidence](#16-tamper-evidence)
17. [Implementation Slices](#17-implementation-slices)

---

## 1. Overview

The audit log is a **single append-only table** (`audit_log`) that records every meaningful event occurring in the system: entity mutations (create, update, sign, delete, etc.), authentication events (login, logout, failures), communications (emails, PDFs), and system-level events (reminders, invoice issuance, exports). It answers the question "what happened, when, and who did it?" for compliance, clinical, and operational purposes.

### Relationship to Other Observability Systems

| System                      | What it is for                                                             | Who reads it                               |
| --------------------------- | -------------------------------------------------------------------------- | ------------------------------------------ |
| **`audit_log` (this spec)** | Legal and business system of record — immutable event history              | Doctors, compliance officers, legal review |
| **Cloud Logging**           | Operational debugging and performance — structured JSON logs from services | Engineers, SREs                            |
| **Sentry**                  | Error tracking and alerting — exceptions, stack traces, performance traces | Engineers                                  |

The audit log is **not** a replacement for Cloud Logging or Sentry, and they are not replacements for it. Every mutation surfaces in all three at some level, but with different purposes: Cloud Logging tells you why a request was slow; the audit log tells a compliance auditor that Dr. García amended Consultation C-2026-01142 on 14 abr 2026 at 10:23 AM. They serve different audiences under different retention requirements.

### Architectural constraints

- Every record has `tenant_id` (nullable only for tenant-creation events — see Section 3).
- UUIDs for primary keys.
- TIMESTAMPTZ for all time fields.
- Append-only: **no `updated_at`, no `deleted_at`**. Rows are never modified after insertion.
- Tenant scoping enforced at the repository layer, not only at the controller layer.
- Spanish UI copy; English code, comments, and this spec document.

---

## 2. Event Categories

Events are grouped into four categories. The `category` and `action` columns together form a closed, enumerated type — no open-ended strings. Adding a new action requires a spec update and a schema migration.

### 2.1 `entity` — Entity mutations

Events on domain records in the database.

| Action    | Meaning                                                                                       |
| --------- | --------------------------------------------------------------------------------------------- |
| `create`  | A new entity record was inserted                                                              |
| `update`  | An existing entity record was modified                                                        |
| `delete`  | An entity was soft-deleted (`deleted_at` set)                                                 |
| `restore` | A soft-deleted entity was restored                                                            |
| `sign`    | A clinical record was signed (Consultation, Prescription, Invoice)                            |
| `amend`   | A signed clinical record was corrected via an amendment                                       |
| `archive` | An entity was archived (distinct from delete — archive is a status change, not a soft-delete) |
| `lock`    | An entity was locked (e.g., a ProtocolTemplate locked by a referencing type)                  |
| `unlock`  | A previously locked entity was unlocked                                                       |

### 2.2 `auth` — Authentication and authorization events

| Action               | Meaning                                                       |
| -------------------- | ------------------------------------------------------------- |
| `login`              | Successful sign-in                                            |
| `logout`             | Explicit sign-out                                             |
| `login_failed`       | Failed sign-in attempt (wrong password, unrecognized account) |
| `password_change`    | Password was changed                                          |
| `mfa_enabled`        | Multi-factor authentication was enabled on an account         |
| `session_revoked`    | A session was explicitly revoked                              |
| `permission_granted` | A role or permission was granted to a user                    |
| `permission_revoked` | A role or permission was removed from a user                  |

### 2.3 `communication` — Outbound communications

| Action              | Meaning                                                              |
| ------------------- | -------------------------------------------------------------------- |
| `email_queued`      | An email was placed in the sending queue                             |
| `email_sent`        | The email provider accepted the message for delivery                 |
| `email_delivered`   | The provider confirmed successful delivery to the recipient's server |
| `email_bounced`     | The provider reported a delivery failure (hard or soft bounce)       |
| `sms_sent`          | An SMS was dispatched                                                |
| `whatsapp_sent`     | A WhatsApp Business API message was dispatched                       |
| `notification_sent` | An in-app or push notification was sent                              |
| `pdf_generated`     | A PDF document (prescription, invoice, report) was generated         |
| `pdf_downloaded`    | A previously-generated PDF was accessed and downloaded               |

**`email_opened` is explicitly absent.** Open tracking requires a pixel embedded in the email, which is a privacy violation incompatible with medical records and DR Law 87-01. We do not track opens.

### 2.4 `system` — Background and automated events

| Action                   | Meaning                                                                   |
| ------------------------ | ------------------------------------------------------------------------- |
| `reminder_sent`          | An appointment or follow-up reminder was dispatched                       |
| `invoice_issued`         | An invoice was automatically issued (e.g., from a signed consultation)    |
| `prescription_dispensed` | A prescription was marked as dispensed by an external system              |
| `export_generated`       | A data export (CSV, ZIP) was generated                                    |
| `report_run`             | A scheduled or on-demand report was executed                              |
| `backup_verified`        | The nightly backup verification job completed                             |
| `webhook_received`       | An inbound webhook from a third-party provider was received and processed |

---

## 3. Schema

The `audit_log` table extends the baseline sketched in `technical-architecture.md` §10 with additional columns for actor type, category, status, and correlation fields.

```
audit_log
├── id                UUID, primary key
│                     Generated server-side (never client-supplied)
├── tenant_id         UUID, nullable, indexed
│                     FK → tenant.id. Nullable only for tenant-creation and
│                     signup events where the tenant row does not yet exist.
│                     All other rows must have a non-null tenant_id.
├── actor_user_id     UUID, nullable
│                     FK → user.id. Null when the actor is the system
│                     (cron job, background worker, webhook handler).
├── actor_type        enum: 'user' | 'system' | 'webhook' | 'cron'
│                     'user'    — an authenticated human user initiated the event
│                     'system'  — internal service logic, no human in the loop
│                     'webhook' — an inbound webhook from a third-party provider
│                     'cron'    — a scheduled Cloud Scheduler job
├── on_behalf_of_id   UUID, nullable
│                     Reserved for impersonation support (e.g., an admin acting
│                     as a tenant user). Schema is present from day one;
│                     no implementation in MVP. Null in all MVP rows.
├── category          enum: 'entity' | 'auth' | 'communication' | 'system'
│                     Matches the four categories in Section 2.
├── action            enum (closed list — see Section 2)
│                     Must be a valid action for its category.
├── entity_type       text, nullable
│                     The name of the domain entity class — 'Patient',
│                     'Consultation', 'Protocol', 'Invoice', etc.
│                     Null for auth and system events with no target entity.
├── entity_id         UUID, nullable
│                     The primary key of the affected entity.
│                     Null when entity_type is null.
├── changes           JSONB, nullable
│                     Field-level diff for 'update' and 'amend' events:
│                     { "field_name": { "before": <value>, "after": <value> } }
│                     Null for create, delete, auth, communication, system events.
│                     Sensitive fields are redacted before storage (Section 8).
├── metadata          JSONB, nullable
│                     Open payload for event-specific supplementary data.
│                     Examples:
│                       auth events     → { ip, userAgent, geo }
│                       email events    → { message_id, recipient, template, subject }
│                       system events   → { job_name, duration_ms, record_count }
│                     Never contains raw credentials, tokens, or unredacted PII.
├── request_id        text, indexed
│                     The X-Request-ID header value from the originating HTTP
│                     request, or a generated correlation ID for background jobs.
│                     Enables cross-referencing with Cloud Logging traces.
├── ip_address        inet, nullable
│                     IPv4 or IPv6 address of the request origin.
│                     Null for system/cron events with no HTTP context.
├── user_agent        text, nullable
│                     HTTP User-Agent string. Null for non-HTTP events.
├── status            enum: 'success' | 'failed'
│                     'success' — the event completed normally
│                     'failed'  — the event was attempted but failed
│                     Both successes and failures are recorded. A failed
│                     mutation that is rolled back still produces a 'failed'
│                     audit row (written in a separate transaction).
├── error_code        text, nullable
│                     The application error code (from packages/shared/errors.ts)
│                     when status = 'failed'. Null when status = 'success'.
└── created_at        TIMESTAMPTZ, not null, default now(), indexed
                      The instant the event was recorded.
                      Always stored in UTC; displayed in the tenant's timezone
                      in the frontend.
```

### What the schema does NOT have

- No `updated_at` — rows are immutable after insertion.
- No `deleted_at` — rows are never soft-deleted.
- No foreign key cascade deletes — `ON DELETE RESTRICT` on all FKs so that deleting a User or Tenant row does not silently destroy audit history.

---

## 4. Indexes

Every index serves a specific query pattern. Indexes not serving a named query are not added.

| Index definition                              | Query pattern served                                                                                           |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `(tenant_id, created_at DESC)`                | "Show me everything that happened in my organization, newest first" — the default view in `/ajustes/registros` |
| `(tenant_id, entity_type, entity_id)`         | "Show the full history of this specific patient / consultation / protocol"                                     |
| `(tenant_id, actor_user_id, created_at DESC)` | "What did Dr. García do this week?" — actor filter in the UI                                                   |
| `(action, created_at DESC)`                   | "Show all `email_sent` events" — action filter across tenants (ops/support use)                                |
| GIN index on `metadata`                       | Ad-hoc JSONB queries: "find all events for recipient X", "find events by message_id"                           |

### Partitioning note

When the table exceeds approximately 50 million rows, partition by month using PostgreSQL declarative range partitioning on `created_at`. Each month becomes its own physical partition; the query planner prunes partitions automatically for date-range queries. **Partitioning is not implemented in MVP.** The schema design does not block it — no assumptions about a single-partition layout are baked into the application code.

---

## 5. Write Mechanisms

There are three paths for writing audit rows. The rule for which to use is determined by the context of the event, not by preference.

### 5.1 NestJS `AuditLogInterceptor` (primary path for HTTP mutations)

A global NestJS interceptor applied in `app.module.ts`. It wraps every controller invocation that results in a mutation (POST, PATCH, PUT, DELETE). On a successful response, it writes the audit row inside the **same database transaction** as the mutation itself — so the mutation and its audit record either commit together or roll back together. This is the primary write path for all entity events triggered by user action through the API.

The interceptor extracts the following from the request context automatically:

- `actor_user_id` and `actor_type = 'user'` from the authenticated user (via `@CurrentUser()`)
- `tenant_id` from the resolved tenant context (via `@TenantId()`)
- `request_id` from the `X-Request-ID` header
- `ip_address` from `req.ip`
- `user_agent` from `req.headers['user-agent']`

The interceptor does not compute the `changes` diff itself. The controller or service layer is responsible for passing the before/after snapshot to the interceptor context before the mutation executes.

### 5.2 Prisma extension (backstop for ORM mutations outside HTTP)

A Prisma client extension hooks into `$extends` to intercept `create`, `update`, `updateMany`, `delete`, and `deleteMany` operations across all tenant-scoped models. This backstop path fires for:

- Seed scripts
- Background job workers (Cloud Run workers invoked by Cloud Tasks)
- Cron jobs (Cloud Scheduler → worker service)

When the Prisma extension writes an audit row, it sets `actor_type` based on the execution context (`'cron'` for scheduled jobs, `'system'` for other non-HTTP workers). It uses a separate Prisma client instance scoped to the audit write to avoid recursive extension triggers.

### 5.3 Explicit `AuditLogService.record()` calls (for non-entity events)

Auth events, communication events, and system events do not surface through the ORM in a form the Prisma extension can capture. These are recorded via explicit calls to `AuditLogService.record(event)`:

```typescript
await auditLogService.record({
  tenantId: ctx.tenantId,
  actorUserId: ctx.userId,
  actorType: 'user',
  category: 'auth',
  action: 'login',
  metadata: { ip: req.ip, userAgent: req.headers['user-agent'] },
  requestId: req.headers['x-request-id'],
  status: 'success',
})
```

`AuditLogService.record()` is the single write entry point for the entire module — both the interceptor and the Prisma extension ultimately call through it. It validates the event shape (Zod), applies redaction (`redactForAudit()`), and performs the insert.

### Which mechanism to use — decision table

| Event type                                                        | Write mechanism                                                               |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| HTTP controller mutation (create, update, delete of any entity)   | `AuditLogInterceptor`                                                         |
| ORM mutation outside an HTTP handler (seed, background job, cron) | Prisma extension                                                              |
| Auth events (login, logout, failures)                             | Explicit `AuditLogService.record()` in the auth service                       |
| Email lifecycle events                                            | Explicit `AuditLogService.record()` in the email service and webhook handlers |
| System events (reminders, exports, reports, backup verification)  | Explicit `AuditLogService.record()` in the relevant service or job            |

---

## 6. What Gets Logged

### Entity events

Every create, update, delete, restore, sign, amend, archive, lock, and unlock on any domain entity. Entity types include (not exhaustive):

`Patient`, `Appointment`, `Consultation`, `ConsultationAmendment`, `Prescription`, `Invoice`, `InvoiceItem`, `Protocol`, `ProtocolTemplate`, `ProtocolType`, `ProtocolVersion`, `ProtocolUsage`, `Location`, `DoctorLocation`, `ScheduleBlock`, `Attachment`, `User`, `Tenant`

For `update` and `amend` actions, the `changes` column contains only the fields that changed — not the full record. See Section 8 for redaction rules applied before storage.

### Auth events

Login (success and failure), logout, password change, MFA enablement, session revocation, and role/permission changes. IP address and user agent are always captured. See Section 10 for the no-lockout constraint.

### Communication events

Every outbound communication: email queue, send, delivery, and bounce events; SMS and WhatsApp dispatch; in-app notification dispatch; PDF generation and download. All email-related events for a single message are chained by `metadata.message_id`. See Section 9 for the email lifecycle detail.

### System events

Reminder dispatch, invoice auto-issuance, export generation, scheduled report execution, backup verification, and inbound webhook receipt. These are written via explicit `AuditLogService.record()` calls in the relevant service.

---

## 7. What Does NOT Get Logged

### Read events (GET requests)

Reads — viewing a patient record, opening a consultation, browsing the protocol list — are **not** logged in the `audit_log` table. The `audit_log` table is a mutation and event log, not an access log.

PHI access logging (recording every read of a patient record) is a separate compliance concern, deferred to a dedicated `access_log` table in v2. When implemented, `access_log` will have its own schema, retention rules, and read API, and will not be mixed into `audit_log`. **No implementation in MVP; the table does not exist yet.**

### Sentry-level errors

Application exceptions captured by Sentry are not duplicated into the audit log. If a mutation fails with an unhandled exception and the transaction rolls back, the `AuditLogInterceptor` writes a `status = 'failed'` row in a separate transaction (so the failure is recorded even though the mutation was not). The stack trace goes to Sentry; the failure event goes to the audit log.

### High-frequency telemetry

Database query timing, Cloud Logging trace spans, request latency histograms — none of these go into the audit log. They go to Cloud Logging and Cloud Monitoring.

### Draft and autosave events

Protocol editor autosaves to browser local storage every 30 seconds (per `protocol-editor-ux.md` §5). These local drafts are not transmitted to the server and produce no audit rows. Only explicit user-initiated saves (which create a new `ProtocolVersion` row) are logged.

---

## 8. Sensitive Data Handling

### General rule

Audit rows capture clinical and administrative content faithfully. The `changes` column for a Consultation update may contain SOAP field values. This is intentional — the audit log is subject to the same access controls as the source record (tenant isolation, role-based visibility per Section 15). It is not a sanitized summary.

### What is never logged

The following values must never appear in any `audit_log` column — not in `changes`, not in `metadata`, not in `user_agent`:

- Passwords or password hashes
- OAuth tokens (Firebase ID tokens, refresh tokens)
- API keys or service account credentials
- Full credit card numbers or CVVs
- Full RNC or cédula numbers — log the last 4 digits only (e.g., `"**** 5678"`)
- Full Social Security numbers or equivalent national identifiers where applicable

### The `redactForAudit()` helper

All data flowing into an audit row passes through a single helper function:

```typescript
redactForAudit(entityType: string, payload: Record<string, unknown>): Record<string, unknown>
```

This is the single source of truth for redaction. It receives the entity type (e.g., `'Patient'`) and the raw payload (the before/after diff or the metadata object) and returns the redacted version. The implementation is a whitelist-plus-blocklist map keyed by entity type and field name.

Adding a new sensitive field to any entity requires a corresponding update to `redactForAudit()` before the entity can appear in audit rows. The helper has comprehensive unit tests — one test case per redaction rule — so additions are immediately tested.

---

## 9. Email Lifecycle Tracking

A single outbound email produces multiple audit rows, all chained by a shared `metadata.message_id`. The `message_id` is the identifier assigned by the email provider (SendGrid or Resend) at send time.

### Row sequence for a successfully delivered email

| `action`          | `actor_type`       | When written                                               | Notable `metadata` fields                                      |
| ----------------- | ------------------ | ---------------------------------------------------------- | -------------------------------------------------------------- |
| `email_queued`    | `system` or `cron` | When the message is placed in the send queue (Cloud Tasks) | `template`, `recipient`, `subject`, `entity_type`, `entity_id` |
| `email_sent`      | `webhook`          | When the provider webhook fires for `processed` / `sent`   | `message_id`, `provider_event_id`                              |
| `email_delivered` | `webhook`          | When the provider webhook fires for `delivered`            | `message_id`, `provider_event_id`                              |

### Row sequence for a bounced email

| `action`        | When written                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| `email_queued`  | On enqueue                                                                                              |
| `email_sent`    | On provider acceptance                                                                                  |
| `email_bounced` | On provider bounce webhook, with `metadata.bounce_type` ('hard' or 'soft') and `metadata.bounce_reason` |

### Open tracking

**`email_opened` does not exist in the action enum and will not be added.** Open tracking requires embedding a tracking pixel in the email body. This is incompatible with DR Law 87-01's consent requirements for medical communications, and with the design principle that the system does not surveil patients without explicit consent.

### Webhook handler requirements

Webhook handlers for email providers must verify the provider's HMAC signature before writing any audit row. An unsigned or invalidly-signed webhook payload is rejected with a 401 and written to Cloud Logging for investigation. No audit row is produced for rejected webhooks.

---

## 10. Auth Event Handling

Auth events (`login`, `logout`, `login_failed`, `password_change`, `mfa_enabled`, `session_revoked`, `permission_granted`, `permission_revoked`) are written via explicit `AuditLogService.record()` calls in the auth service, immediately after the Firebase Auth SDK call resolves.

### No lockout or rate-limit logic

Recording a `login_failed` event has **no side effects**. The audit log service does not:

- Lock the account after N failures
- Throttle subsequent requests
- Trigger alerts or notifications
- Expose failure counts to the caller

These behaviors — if implemented — belong in the auth service, not the audit service. They are deferred to v2. The audit log records the event and nothing more.

### IP and user agent

Auth events always populate `ip_address` and `user_agent`. For `login_failed` events, these fields are particularly important for security review and are surfaced prominently in the frontend detail drawer (Section 14).

---

## 11. Storage and Retention

**All rows are kept indefinitely.** There is no automated purge, no TTL, and no cleanup job.

This policy is driven by two requirements:

1. **DR Law 87-01 and medical data retention standards.** Clinical records must be retained for legally mandated periods (typically 10 years for ambulatory care). The audit log, as a record of who touched those clinical records, inherits the same retention requirement.
2. **Upgrade/downgrade safety.** If a tenant downgrades their plan, their audit history is not deleted — it is hidden at the API/UI layer. When they upgrade again, the full history is restored. No data is lost on downgrade.

The **plan tier controls what the UI exposes**, not what is stored. See Section 12 for the UI gating table.

### Storage projection

An average audit row is approximately 2 KB (including JSONB overhead). A tenant with 1,000 billable events per month accumulates roughly 2 MB per month or 24 MB per year — negligible on Cloud SQL with standard SSD storage. Even at 10× that volume, the driver for partitioning (Section 4) is query performance, not storage cost.

---

## 12. Plan-Tier UI Gating

The API applies a retention filter based on the tenant's current plan before returning results. The filter is enforced at the service layer, not at the database layer — all rows remain in the table regardless of plan.

| Plan   | UI exposes                     | Date cutoff applied                          |
| ------ | ------------------------------ | -------------------------------------------- |
| Free   | Last 30 days                   | `created_at >= now() - interval '30 days'`   |
| Pro    | Last 12 months                 | `created_at >= now() - interval '12 months'` |
| Clinic | Unlimited history + CSV export | No date cutoff                               |

### Downgrade behavior

When a tenant downgrades from Clinic to Pro, rows older than 12 months become invisible in the UI immediately. The rows still exist in the database. Upgrading back to Clinic restores full visibility. No rows are deleted.

### Free plan banner

When a Free or Pro tenant views `/ajustes/registros`, a persistent banner appears above the table:

```
(sans)   Estás viendo los últimos {N} días.
         Actualiza tu plan para ver el historial completo.
```

Where `{N}` is 30 for Free and 365 for Pro. The banner is styled using `bg-info-bg border-info-border text-info-text` from the design token set.

---

## 13. Read API

### Endpoints

All endpoints require `FirebaseAuthGuard` + `TenantGuard`. Role-based visibility rules are applied at the service layer (Section 15).

#### `GET /v1/audit-logs`

Returns a cursor-paginated, filtered list of audit events for the authenticated tenant.

**Query parameters:**

| Parameter       | Type                                    | Description                                                 |
| --------------- | --------------------------------------- | ----------------------------------------------------------- |
| `cursor`        | string (optional)                       | Opaque pagination cursor from the previous response         |
| `limit`         | integer (optional, default 50, max 200) | Number of rows per page                                     |
| `date_from`     | ISO 8601 datetime (optional)            | Inclusive start of the date range                           |
| `date_to`       | ISO 8601 datetime (optional)            | Inclusive end of the date range                             |
| `actor_user_id` | UUID (optional, repeatable)             | Filter by one or more actor users                           |
| `category`      | enum (optional, repeatable)             | Filter by event category                                    |
| `action`        | enum (optional, repeatable)             | Filter by action; must be valid for the selected categories |
| `entity_type`   | string (optional)                       | Filter by entity type (e.g., `Patient`)                     |
| `entity_id`     | UUID (optional)                         | Filter by specific entity; requires `entity_type`           |
| `status`        | enum (optional)                         | `success` or `failed`                                       |

**Response:**

```json
{
  "data": [
    {
      "id": "uuid",
      "tenantId": "uuid",
      "actorUserId": "uuid | null",
      "actorType": "user | system | webhook | cron",
      "category": "entity | auth | communication | system",
      "action": "create | update | ...",
      "entityType": "string | null",
      "entityId": "uuid | null",
      "changes": { "fieldName": { "before": "...", "after": "..." } },
      "metadata": { ... },
      "requestId": "string",
      "ipAddress": "string | null",
      "status": "success | failed",
      "errorCode": "string | null",
      "createdAt": "ISO 8601 datetime"
    }
  ],
  "pagination": {
    "cursor": "opaque string | null",
    "hasMore": true,
    "limit": 50
  }
}
```

**Plan-tier filter:** Applied unconditionally before any other filter. A Free tenant requesting `date_from` outside the 30-day window receives an empty `data` array and `pagination.hasMore = false` — not an error. The plan filter is silent; it never surfaces as an error to the caller.

#### `GET /v1/audit-logs/:id`

Returns a single audit event by ID.

**Errors:**

- `404 AUDIT_LOG_NOT_FOUND` — the row does not exist or belongs to a different tenant.

#### `GET /v1/audit-logs/export.csv`

Exports the current filtered result set as a CSV file. **Clinic plan only.**

**Errors:**

- `403 AUDIT_EXPORT_REQUIRES_CLINIC_PLAN` — tenant is on Free or Pro plan.

The CSV respects all the same query parameter filters as `GET /v1/audit-logs`. The export is generated synchronously for result sets under 10,000 rows. Larger exports are queued as a background job and delivered via a download link (v2 behavior; flag in implementation).

### OpenAPI documentation

All endpoints are documented via NestJS Swagger decorators (`@ApiTags`, `@ApiOperation`, `@ApiQuery`, `@ApiResponse`). The OpenAPI spec is auto-generated and kept in sync with the code — no manual spec file.

### Zod schemas

All request and response shapes are defined as Zod schemas in `packages/shared/audit-log.schemas.ts`. The NestJS controller uses the `ZodValidationPipe` for request validation; the frontend uses the same schemas for response parsing.

---

## 14. Frontend Module

### Route and navigation

- **Route:** `/ajustes/registros`
- **Nav label:** "Registros de actividad" — placed under the Settings section in the sidebar, below other `/ajustes` routes
- **Page heading:** "Registros de actividad" in Source Serif 4 (`text-h1`, `text-n-800`)

### Table layout

The main content is a full-width table. Column definitions:

| Column    | Content                                                                              | Typography                                     |
| --------- | ------------------------------------------------------------------------------------ | ---------------------------------------------- |
| Timestamp | `18 abr 2026, 9:34 AM` in tenant timezone                                            | IBM Plex Mono, `text-n-600`, `text-body-sm`    |
| Actor     | Full name of the user, or `Sistema` / `Cron` / `Webhook` for non-user actors         | IBM Plex Sans, `text-n-700`, `text-body-sm`    |
| Categoría | Category badge (see badge map below)                                                 | `<Badge>` component                            |
| Acción    | Spanish label from the action translation map                                        | IBM Plex Sans, `text-n-700`, `text-body-sm`    |
| Entidad   | Entity display string (e.g., "Consulta · Ana María Reyes") deep-linked to the record | IBM Plex Sans, `text-n-700`; link `text-p-500` |
| Estado    | Success: subtle neutral dot; Failed: `text-warning-text` warning indicator           | Semantic color + icon, never color alone       |

**Active/selected row** uses the 2px teal vertical rule on the left edge via `before:` pseudo-element, matching the product's signature element.

### Category badge map

| Category        | Spanish label | Badge colors                                            |
| --------------- | ------------- | ------------------------------------------------------- |
| `entity`        | Entidad       | `bg-info-bg border-info-border text-info-text`          |
| `auth`          | Autenticación | `bg-warning-bg border-warning-border text-warning-text` |
| `communication` | Comunicación  | `bg-p-50 border-p-100 text-p-700`                       |
| `system`        | Sistema       | `bg-n-50 border-n-200 text-n-600`                       |

### Filters

Filters appear in a horizontal strip above the table. All filters are applied client-side via TanStack Query refetch — not as full page navigations.

| Filter               | Type                                                       | Default          |
| -------------------- | ---------------------------------------------------------- | ---------------- |
| Date range           | Date range picker (from / to)                              | Last 7 days      |
| Actor                | Multi-select from users in tenant                          | All actors       |
| Categoría            | Multi-select chips                                         | All categories   |
| Acción               | Dropdown, options dependent on selected categories         | All actions      |
| Tipo de entidad      | Dropdown                                                   | All entity types |
| Búsqueda de paciente | Text search — resolves to entity filter via patient lookup | Empty            |

**Active filter chip** uses the 2px teal vertical rule to indicate the chip has an active (non-default) value.

### Detail drawer

Clicking any row opens a right-side drawer. The drawer shows the full event without navigating away from the table. Drawer sections:

- **Event header:** action label (large, Source Serif 4), timestamp, status
- **Actor:** full name, actor type, IP address, user agent
- **Entity link:** "Ver registro relacionado" — navigates to the entity record (for entity events)
- **Changes diff** (for `update` and `amend` events):
  ```
  campo              antes → después
  chief_complaint    "Dolor torácico" → "Dolor torácico agudo"
  signed_at          null → 2026-04-18T10:23:00Z
  ```
- **Email timeline** (for `email_*` events): shows the full chain of events sharing the same `metadata.message_id`, sorted by `created_at`, rendered as a vertical timeline
- **Auth details** (for `login_failed`): IP address, user agent, timestamp — no geo in MVP

### Empty state

```
(serif)  Aún no hay actividad registrada
(sans)   Cuando uses el sistema, aparecerá aquí cada acción —
         consultas firmadas, citas creadas, emails enviados.
```

Rendered using `<EmptyState>` with `icon="ph-clipboard-text"`.

### CSV export

The "Exportar CSV" button is visible only when the tenant is on the Clinic plan. For Free and Pro tenants, the button is absent entirely — not disabled. On click, the button calls `GET /v1/audit-logs/export.csv` with the current filter parameters.

### Action translation map (Spanish)

All action values are translated for display in the table and the detail drawer.

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
| `mfa_enabled`            | MFA habilitado           |
| `session_revoked`        | Sesión revocada          |
| `permission_granted`     | Permiso otorgado         |
| `permission_revoked`     | Permiso revocado         |
| `email_queued`           | Email en cola            |
| `email_sent`             | Email enviado            |
| `email_delivered`        | Email entregado          |
| `email_bounced`          | Email rechazado          |
| `sms_sent`               | SMS enviado              |
| `whatsapp_sent`          | WhatsApp enviado         |
| `notification_sent`      | Notificación enviada     |
| `pdf_generated`          | PDF generado             |
| `pdf_downloaded`         | PDF descargado           |
| `reminder_sent`          | Recordatorio enviado     |
| `invoice_issued`         | Factura emitida          |
| `prescription_dispensed` | Receta dispensada        |
| `export_generated`       | Exportación generada     |
| `report_run`             | Informe ejecutado        |
| `backup_verified`        | Respaldo verificado      |
| `webhook_received`       | Webhook recibido         |

### Design system compliance

Every color, spacing value, radius, and type size references a token from `apps/web/src/index.css`. No raw hex values. No arbitrary pixel sizes. No new type sizes or weights. The full design system checklist from `specs/design-system/implementation.md` applies before this screen ships.

---

## 15. Tenant and Role Isolation

### Tenant isolation

The `AuditLogRepository` always includes `tenant_id = :tenantId` in every query. The `tenantId` is resolved from the authenticated user's session via `TenantGuard` — it is never accepted from a request parameter. A row belonging to Tenant A is never visible to a user of Tenant B, even with a known `id`.

### Role isolation

In MVP, every tenant has exactly one user (the owner). The owner sees all audit events in the tenant.

When multi-user ships (v2), the following rules apply. The code enforces these rules from day one, even though they have no behavioral effect in single-user MVP:

| Role     | What they can see                                                                                                                                                          |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `owner`  | All audit events in the tenant, regardless of actor or entity                                                                                                              |
| `doctor` | Events where `actor_user_id = their own user id`, plus events on entities they own (`Patient.owner_user_id = their user id`, `Consultation.user_id = their user id`, etc.) |

The role filter is applied at the service layer, after the tenant isolation filter, before the plan retention filter.

---

## 16. Tamper-Evidence

**Not implemented in MVP.**

A tamper-evident audit log ensures that rows cannot be silently modified after insertion even by someone with direct database access. The standard mechanism is a hash chain: each row includes a cryptographic hash of its own content plus the hash of the previous row, so any modification breaks the chain at that point.

The current schema does not include a `hash` column. The schema design does not block its addition — it is a nullable column that can be added in a future migration without changing existing rows' semantics. When hash-chain verification is implemented (v2+), existing rows will be backfilled or treated as "pre-chain" entries with a documented baseline.

For MVP, tamper-evidence relies on:

- Postgres-level access controls (the application service account has INSERT on `audit_log` and SELECT; no UPDATE or DELETE)
- Cloud SQL audit logging (GCP's own audit of who accessed the database)
- Append-only enforcement in the application layer (`AuditLogService.record()` throws a typed error if called with an update or delete intent)

---

## 17. Implementation Slices

Implementation follows five sequential slices. Each slice is its own commit. The next slice does not begin until the current one passes type-check, lint, and all tests. A short summary of what changed and any decisions made is produced at the end of each slice before proceeding.

### Slice 1 — Foundation

**Deliverables:**

- Prisma schema additions in `packages/db/schema.prisma` with the full `audit_log` table definition
- Named migration: `add_audit_log` (cleanly named, reversible)
- `AuditLogService.record(event)` in `apps/api/src/common/audit-log/`
- `AuditLogRepository` for inserts and tenant-scoped queries
- `redactForAudit(entityType, payload)` helper with comprehensive unit tests

**Acceptance criteria:**

- `prisma migrate dev` runs cleanly; migration is reversible
- `AuditLogService.record({...})` writes a row with all fields populated correctly
- Attempting to call update or delete on an audit row throws a clear, typed error
- Every redaction rule covered by an explicit test case in `__tests__/`
- Tenant scoping verified by a cross-tenant test (tenant A query returns zero of tenant B's rows)

### Slice 2 — Auto-capture for entity mutations

**Deliverables:**

- `AuditLogInterceptor` (NestJS global interceptor) wrapping every controller mutation
- Prisma client extension as a backstop for ORM mutations outside the HTTP path
- Audit write inside the same DB transaction as the mutation
- `request_id` propagated from request context into every audit row
- Diff generation for `update` actions — `{ field: { before, after } }` shape

**Acceptance criteria:**

- Creating, updating, and deleting any entity through a controller produces a correct audit row
- A failing mutation produces zero audit rows (transaction rollback test)
- The diff for updates contains only changed fields, not the full record
- Sensitive fields are redacted in the diff per the `redactForAudit()` helper
- An ORM mutation outside an HTTP handler still produces an audit row via the Prisma extension

### Slice 3 — Auth, communication, and system events

**Deliverables:**

- Auth events hooked into the Firebase auth flow via explicit `AuditLogService.record()` calls in the auth service
- Email events: `email_queued` on enqueue; `email_sent`, `email_delivered`, `email_bounced` from provider webhooks with signature verification
- System events recorded via explicit `AuditLogService.record()` calls in the relevant services and jobs

**Acceptance criteria:**

- A successful login produces a `login` event with IP and user agent
- A failed login produces a `login_failed` event; no lockout side effect
- Sending one email produces a chain of audit rows tied by `message_id`
- Webhook handlers reject unsigned/invalidly-signed requests (401) without writing an audit row
- A test covers the email lifecycle: queued → sent → delivered

### Slice 4 — Read API

**Deliverables:**

- `GET /v1/audit-logs` — cursor-paginated with all filters documented in Section 13
- `GET /v1/audit-logs/:id` — single event detail
- `GET /v1/audit-logs/export.csv` — Clinic plan only
- Plan-aware retention filter applied at the service layer
- Tenant and role isolation per Section 15
- Zod schemas in `packages/shared/audit-log.schemas.ts`
- Error codes added to the closed enum in `packages/shared/errors.ts`

**Acceptance criteria:**

- 401 without auth, 403 with insufficient role, 404 for cross-tenant ID
- Plan filter is honored regardless of query parameters: a Free user requesting older data receives an empty list, not an error
- CSV export rejects non-Clinic plans with `AUDIT_EXPORT_REQUIRES_CLINIC_PLAN`
- Pagination is cursor-based and stable across requests
- All endpoints appear in the auto-generated Swagger documentation

### Slice 5 — Frontend module (`/ajustes/registros`)

**Deliverables:**

- Route `/ajustes/registros` added to the router and the sidebar Settings section
- Page heading, table, filters, detail drawer, empty state, and plan-tier banner as specified in Section 14
- Stack: TanStack Query for data fetching, React Hook Form for filter state, Phosphor Icons (regular weight), all design system components from `apps/web/src/components/ui/`
- CSV export button visible only on Clinic plan

**Acceptance criteria:**

- Every color, spacing value, radius, and type size references a design token — no raw hex values
- Active filter chips and selected table rows use the 2px teal vertical rule
- Typography follows the scale exactly — no new sizes or weights
- Touch targets meet the 44px minimum (WCAG, `--size-touch-min`)
- All Spanish copy follows the voice in `specs/design-system/principles.md`
- Layout matches the `/ajustes` patterns in `design-system/app-prototype.html`
- Responsive at standard viewport widths (mobile PWA per `mvp-scope.md`)
