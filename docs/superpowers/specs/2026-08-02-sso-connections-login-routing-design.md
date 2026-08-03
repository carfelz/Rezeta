# Enterprise SSO Connections + Login Routing (identity slice 6)

Design for the final slice of the identity milestone
(`docs/superpowers/specs/2026-07-19-identity-module-design.md` §8 slice 6,
screens 1B and 5). Validated in brainstorming on 2026-08-02.

## 1. Summary

Platform staff can configure a per-institution OIDC single-sign-on connection
(screen 5, "Conexiones SSO"); the login screen routes an email to its sign-in
methods and swaps the password field for an SSO action when the email's domain
has an active connection (screen 1B). The Google social login button from
screen 1A — designed in the identity milestone but never shipped with
slice 2 — ships here too, since it shares all of the popup sign-in plumbing.

## 2. Decisions (settled this brainstorm)

1. **Google login is in scope.** `signInWithGoogle()` and the "Continuar con
   Google" button ship in this slice; the routing endpoint advertises
   `google` from day one.
2. **No plan gating.** The identity design's "enterprise plan" note is not
   implementable (plan enum is `free/solo/practice/clinic`). Staff-managed
   creation *is* the gate: only platform staff can create a connection and
   they decide which institution gets one. Pricing enforcement waits for a
   plans revision.
3. **Swap-in-place login UX.** The single login form stays. After the email
   field settles (debounced blur) the client calls the routing endpoint; only
   an SSO-routed domain changes what the user sees. Non-SSO users see no
   difference.
4. **OIDC only this slice.** The `type` column ships (values: `oidc`), SAML is
   a fast-follow when a real institution needs it — certs, entity IDs, and
   metadata parsing stay out of this slice.
5. **`allow_password` is routing-level only.** When off, the routing endpoint
   stops advertising `password` and the UI hides the field. Provider-side
   hard enforcement (GCP blocking functions) is a documented non-goal.
6. **Architecture: one Identity Platform OIDC provider config per
   connection** (`oidc.<slug>`), managed through `IAuthProvider` with the
   Firebase Admin SDK; the browser signs in with the standard
   `signInWithPopup(OAuthProvider(providerId))`. Credentials never touch
   Rezeta servers (identity design §2 decision 1, §3). Rejected: provider
   multi-tenancy (requires migrating every user into IdP tenants) and
   self-brokered OIDC (auth codes would flow through our API).

## 3. Data model

New Prisma model `SsoConnection` (soft-deleted config, per identity design §4):

| column | type | notes |
| --- | --- | --- |
| `id` | uuid pk | |
| `tenant_id` | uuid FK → Tenant | multiple connections per tenant allowed |
| `type` | varchar | `'oidc'` only this slice |
| `provider_id` | varchar unique | Identity Platform config id, `oidc.<slug>`; generated at create (sanitized display name + short random suffix), immutable afterwards |
| `display_name` | varchar | shown on the login button ("Continuar con …") |
| `issuer_url` | varchar | OIDC issuer / discovery base |
| `client_id` | varchar | |
| `domains` | text[] | lowercase email domains |
| `allow_password` | boolean default true | |
| `status` | varchar | `active` / `disabled` |
| `deleted_at` | timestamp nullable | soft delete |
| `created_at` / `updated_at` | timestamp | |

**No secret column.** The client secret is write-only pass-through: the API
forwards it to the Identity Platform provider config and never stores nor
returns it. Edits keep the existing secret unless a new one is provided.

**Domain uniqueness:** a domain may belong to at most one *active* connection
platform-wide (routing would otherwise be ambiguous). Enforced in the service
on create/update/reactivate; violation returns `SSO_DOMAIN_ALREADY_CLAIMED`
(new code in the closed enum, `packages/shared/src/errors.ts`).

## 4. API surface

**Staff (control plane, staff guard): `/v1/staff/identity/sso-connections`**

- `GET` — list all connections with tenant name joined (cross-institution).
- `POST` — create: `{tenantId, displayName, issuerUrl, clientId, clientSecret,
  domains[], allowPassword}`. Creates the provider config first, then the
  row; provider failure aborts the create.
- `PATCH :id` — update; `clientSecret` optional (only forwarded when present).
- `PATCH :id/status` — deactivate/reactivate; deactivation also disables the
  provider config at the IdP so new sign-ins fail provider-side.
- `POST :id/test` — dry run: fetches the issuer's OIDC discovery document and
  validates issuer match + required endpoints. Cannot prove the client secret
  without a full code flow; the response states exactly what was and wasn't
  verified.
- `DELETE :id` — soft delete + disable provider config.
- Mutations are audited as regular entity events (`create`/`update`/`delete`
  on `SsoConnection`) via the existing audit interceptor — no new audit
  actions.

**Public (unauthenticated): `POST /v1/auth/login-methods`**

Body `{email}` → `{methods: ('password'|'google'|'sso')[], ssoProviderId?,
ssoDisplayName?}`. The lookup touches **only the domain** against active
connections — never the User table — so account enumeration is structurally
impossible. Non-SSO domains always receive the constant `['password',
'google']`. An SSO domain receives `['sso']`, plus `'password'`/`'google'`
when `allow_password` is on.

**`IAuthProvider` additions** (`apps/api/src/lib/auth/`): thin Admin SDK
wrappers — `createOidcProviderConfig`, `updateOidcProviderConfig`,
`setProviderConfigEnabled`, `deleteProviderConfig`. Faked in unit tests like
the existing methods.

## 5. Frontend

**Login screen** (`apps/web/src/pages/Login/index.tsx`):

- "Continuar con Google" button under a divider below the password form.
  `IAuthClient` gains `signInWithGoogle()` (popup, `GoogleAuthProvider`).
- Debounced routing check on email settle. SSO-only domain: password field
  replaced by primary "Continuar con <displayName>"; password-allowed domain:
  password form stays, SSO button appears as secondary. `IAuthClient` gains
  `signInWithSso(providerId)` (popup, `OAuthProvider(providerId)`).
- Both popup methods capture `pendingMfaResolver` on
  `auth/multi-factor-auth-required` exactly like `signIn`, reusing the
  existing TOTP challenge state.
- **Fail open:** if the routing call errors, the page shows the normal
  password + Google form — a routing hiccup must never lock anyone out.
- Popup only this slice (no redirect flow); revisit with PWA polish.
- No signup affordance anywhere (invite-only, unchanged).

**Staff platform → Conexiones SSO** (screen 5):

- New staff-nav item. Cross-institution table: institution, display name,
  domains, status chip, allow-password indicator.
- Create/edit panel per the staff platform-users modal pattern: institution
  select, display name, issuer URL, client ID, client secret (blank on edit,
  "dejar vacío para mantener"), domains input, allow-password toggle.
- Row actions: Probar (dry-run result callout), Desactivar/Activar,
  delete behind ConfirmDialog.
- Spanish strings colocated; design tokens and existing components only.

## 6. Edge cases

- **Un-invited Google/SSO sign-in:** the provider may mint a session, but
  AuthGuard finds no `User` row and rejects; telemetry records `blocked`. The
  client signs out of the provider session and shows "Esta cuenta no está
  registrada". No JIT provisioning.
- **Account linking precondition:** Identity Platform's "one account per
  email" setting must be ON so provider sign-ins link to the invited user's
  existing account (same `externalUid`). Console config — recorded as an
  environment precondition with a manual verification step in the plan.
- **Deactivation with live sessions:** disabling the provider config stops
  new sign-ins immediately; existing tokens live until expiry (~1h). Staff
  can force sign-out via the existing per-user revocation.
- **Telemetry:** no changes — `login-telemetry` already derives
  `google`/`sso` from the token's `sign_in_provider`.

## 7. Testing

Usual bars: TDD, 95% per-file coverage, zero lint.

- **API unit:** connection service (mocked repo + provider) — CRUD, domain
  uniqueness, secret pass-through (never persisted, never echoed), discovery
  validation for `test` (mocked HTTP), routing shaping (SSO-only /
  password-allowed / disabled / soft-deleted / unknown domain).
- **Integration (real Postgres, runs in CI):** CRUD + soft delete +
  domain-uniqueness + routing query + one staff-mutation audit-row assertion.
- **Web:** auth-client popup methods incl. MFA-resolver capture; Login
  swap-in-place (debounce, fail-open, both SSO button states); staff page
  (create modal, secret-blank-on-edit, test callout, deactivate confirm).

## 8. Non-goals (this slice)

- SAML connections (schema-ready; fast-follow).
- Provider-side password blocking (GCP blocking functions).
- Redirect-based sign-in flow (popup only).
- JIT / SCIM provisioning — users remain invite-only.
- Plan-based gating of SSO.
- SMS MFA (still deferred from slice 4).
