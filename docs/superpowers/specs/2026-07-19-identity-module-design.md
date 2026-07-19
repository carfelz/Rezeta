# Identity Module — Design

**Date:** 2026-07-19
**Status:** Draft for review
**Mockups:** `docs/superpowers/specs/2026-07-19-identity-module-mockups.html` (also on Claude Design: "Rezeta Design System" → Feature designs → Identity Module)
**Builds on:** `docs/superpowers/specs/2026-07-15-permissions-multi-user-design.md` (roles, permission matrix, invites, `PlatformUser` control plane) — must land first.

## 1. Summary

Adds MFA, social login, enterprise SSO, login/session monitoring, and security
analytics on top of the multi-user permissions milestone. Identity remains
delegated to a managed provider; Rezeta owns everything above the credential
layer in a self-contained `modules/identity` NestJS module designed to be
extractable as a standalone API later.

## 2. Decisions (locked)

Settled during brainstorming; not open for re-litigation in implementation plans:

1. **Provider: GCP Identity Platform** — an in-place upgrade of the existing
   Firebase Auth project (same SDK, same `externalUid`s). Provides password
   auth, Google social login, per-tenant SAML/OIDC SSO, TOTP + SMS MFA, and
   server-side session revocation.
2. **Plan-B exit documented, not built.** All identity tables stay
   provider-agnostic (`externalUid` is an opaque string). §10 records the
   migration runbook to a self-hosted IdP (Zitadel/Keycloak) — including
   password-hash export — so physical custody of credential data is a future
   deployment decision, not an architecture change.
3. **SSO scope: both.** Google social login for all users as a convenience,
   plus per-institution SAML/OIDC enterprise connections (staff-managed,
   enterprise plan).
4. **MFA: optional for all users.** TOTP (primary) and SMS (fallback) are
   available to everyone; nothing is enforced. The `IdentityPolicy` table ships
   anyway with the requirement knob defaulting to `off`, so tightening to
   "required for admins" or "required for all" later is a config change.
5. **Dashboards at both levels.** Institution admins get a tenant-scoped
   security panel; platform staff get a cross-institution view. Clinical data
   is never exposed at the staff level — identity telemetry and counts only.
6. **Packaging: module in the monorepo.** `apps/api/src/modules/identity` with
   its own tables and a strict boundary (no imports from clinical modules).
   Standalone deployment is a future lift, not this milestone.

## 3. Architecture

- The web client authenticates directly against Identity Platform (credentials
  never touch Rezeta servers); the API verifies bearer tokens as today.
- `modules/identity` talks to the provider only through the existing
  `IAuthProvider` interface (`apps/api/src/lib/auth/`), which gains methods for
  MFA factor administration, SSO provider CRUD, and user export.
- Login routing: a public endpoint maps a submitted email to available sign-in
  methods (password / Google / SSO redirect by domain), response-shaped to
  avoid account enumeration.
- Session revocation is **per-user** ("close all sessions"), matching provider
  capability. The device registry (§4) is observational; per-device revoke is a
  non-goal (§11) and a documented benefit of the plan-B exit.

## 4. Data model (new tables, all in Postgres)

| Table | Purpose |
| --- | --- |
| `LoginEvent` | Every auth attempt: actor (tenant user or platform staff), outcome (`success` / `failure` / `blocked`), method (`password` / `google` / `sso`, plus MFA flag), IP, user agent, timestamp. Purpose-built telemetry for dashboards; the generic `AuditLog` keeps its immutable auth entries unchanged. |
| `UserDevice` | Devices seen per user (user-agent + IP-derived fingerprint, first/last seen). Powers "new device" chips and notification emails. |
| `MfaEnrollment` | Mirror of provider enrollment state (factor type, enrolled / last-used) — status only, **never secrets** — so adoption queries don't fan out to the provider. |
| `SsoConnection` | Per-tenant enterprise SSO config: type (SAML/OIDC), provider ID, allowed email domains, status. Staff-managed. Secrets are write-only. |
| `IdentityPolicy` | Per-tenant knobs: MFA requirement (`off` default), session max age. |

Conventions apply: UUID PKs, `tenant_id` scoping (staff-actor rows use a
separate nullable `platform_user_id`, mirroring `AuditLog`'s actor pattern),
soft deletes where records are user-facing config (`SsoConnection`,
`IdentityPolicy`); `LoginEvent`/`UserDevice` are append-only telemetry retained for
12 months, then purged by a scheduled job (identity telemetry is not part of
the medical record, so clinical retention rules do not apply — the immutable
`AuditLog` remains the legal trail).

## 5. API surface

All under `/v1/identity/*` (tenant) and `/v1/staff/identity/*` (control plane)
so the module lifts out cleanly:

- **Self-service (any user):** list my devices, my MFA enrollments, close all
  my sessions.
- **Tenant-scoped (permission-matrix gated, admin-section capabilities):**
  login history, per-user device/session list, force sign-out (rank rule
  applies — only ranks strictly below the actor), MFA adoption, security
  metrics, compliance export.
- **Staff:** cross-institution login feed and metrics, dormant-account report,
  `SsoConnection` CRUD with a dry-run "test connection" handshake.
- **Public:** login-method routing by email (see §3).

## 6. Frontend

Five surfaces, mocked in the companion file:

1. **Login screen** — three states: credentials + "Continuar con Google";
   SSO-domain detected (password field replaced by an SSO continue action); MFA
   challenge (TOTP code entry, SMS fallback with masked number). No signup
   affordance anywhere (invite-only per permissions design).
2. **Perfil → Seguridad** (self-service): manage MFA factors, device list with
   "Nuevo" chips, "Cerrar todas las sesiones".
3. **Ajustes → Seguridad** (institution admins): stat tiles (active sessions,
   failed attempts, MFA adoption, dormant users), filterable login-activity
   table, CSV export. Lives in the Ajustes hub behind the same admin-section
   capability gating as Usuarios/Permisos.
4. **Staff platform → Seguridad**: platform tiles, per-institution activity
   table with 14-day login sparklines and signal chips (dormant accounts,
   failure spikes).
5. **Staff platform → Conexiones SSO**: connection list + edit panel (provider
   type, discovery URL, email domains, allow-password toggle, test/deactivate).

All UI strings in Spanish; design tokens per `apps/web/src/index.css` — the
mockups use only existing tokens and component patterns.

## 7. Reports, analytics, metrics

- **Compliance access report** — per-institution export of who accessed which
  patient records, built on the existing `AuditLog` (Ley 172-13 selling point).
- **Dormant account detection** — no login in N days → flag + suggested
  deactivation.
- **Invite funnel** — invite-sent → first-login time, surfaced next to
  resend-invite.
- **New-device email** — notification on first sign-in from an unseen device.
- **Platform metrics** — MAU/DAU per institution, login success ratio, MFA
  adoption; feeds the staff dashboard and future pricing decisions.

## 8. Delivery slices

Each independently shippable, in order; lands after the permissions milestone
merges:

1. Identity Platform upgrade + Google social login.
2. `LoginEvent`/`UserDevice` capture + institution security panel (screens 2–3).
3. MFA enrollment (TOTP + SMS) + `IdentityPolicy` + login challenge (screens 1C, 2).
4. Staff cross-institution dashboard + reports (screen 4).
5. Enterprise SSO connections + login routing (screens 1B, 5).

## 9. Testing

- Unit tests alongside each service; provider faked behind `IAuthProvider`;
  95% per-file coverage gate.
- Login-event capture, policy enforcement, and rank-rule checks on force
  sign-out covered in the real-Postgres integration harness.
- Dashboard components in Storybook.

## 10. Plan-B exit runbook (documented, not executed)

1. Export all users from Identity Platform via Admin SDK, including scrypt
   password hashes and hashing parameters.
2. Provision the self-hosted IdP (Zitadel preferred) and import users with
   hash-compatible settings — no forced password resets.
3. Re-create MFA enrollments (TOTP secrets are not exportable — users re-enroll;
   `MfaEnrollment` identifies exactly who to prompt).
4. Re-point `SsoConnection` provider IDs at the new IdP's connection objects.
5. Implement `IAuthProvider` for the new IdP; swap via DI. No table changes.

## 11. Non-goals (this milestone)

- Per-device session revocation (registry is observational).
- Impossible-travel detection, IP allowlists, passkeys.
- MFA enforcement defaults (engine ships, default stays `off`).
- Standalone deployment of the identity module.
- Support impersonation / staff access to tenant clinical data (unchanged from
  the permissions design).
