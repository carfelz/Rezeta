# Self-Hosted Authentication — Design

**Date:** 2026-08-07
**Status:** Approved in brainstorming, ready for planning
**Supersedes:** `docs/superpowers/specs/2026-07-19-identity-module-design.md` decisions 1 and 2
(provider choice and "plan-B exit documented, not built"), and its §10 exit runbook.

## 1. Summary

Replace Firebase / GCP Identity Platform with authentication we run ourselves:
Passport.js strategies over our own Postgres credential tables. Rezeta stops
delegating the credential layer and becomes its own identity provider.

Feature parity is required at cutover: email/password with set-password links,
TOTP MFA, per-tenant OIDC SSO, and Google sign-in all keep working.

Authorization is explicitly **not** part of this work. The existing role ×
module × access-level model stays exactly as it is (see §11).

## 2. Drivers

All four applied, which is why abstracting Firebase better was not an option:

1. **Vendor lock-in / control** — core auth should not be owned by Google.
2. **Cost** — MFA, OIDC SSO, and multi-tenancy sit behind paid Identity Platform tiers.
3. **Compliance / data residency** — Dominican medical-data expectations, and
   institution clients who require credentials not be held by a US cloud provider.
   This driver alone rules out swapping one managed provider for another.
4. **Developer friction** — emulator setup, a GCP project per environment, and
   staff-vs-clinic account juggling.

## 3. Decisions (locked)

Settled during brainstorming; not open for re-litigation in implementation plans.

1. **We become the IdP.** Not Zitadel, not Keycloak. The July design's exit
   runbook assumed another external IdP and a straight `IAuthProvider` swap;
   holding credentials ourselves means new tables, so that runbook does not apply.
2. **Clean cutover, no migration.** No real users exist in any environment.
   No scrypt hash export, no dual-verify window, no forced-reset campaign.
3. **Sessions are opaque tokens in Postgres**, sent as a bearer header exactly
   as today. Not JWTs: `AuthGuard` already queries the database on every request
   to resolve the user and capabilities, so a stateless token saves nothing while
   costing key rotation, a refresh endpoint, and revocation that lags by the
   access-token lifetime.
4. **`external_uid` is renamed to `identity_id`.** Once we mint the value,
   "external" misleads every future reader. The rename (slice 1) and the retype
   to `uuid` (slice 2) are separate: Firebase UIDs are 28-character strings, not
   UUIDs — `seed.ts` is full of them — so the column must stay `VarChar(128)`
   for as long as Firebase is still issuing identities.
5. **No foreign key** from `User.identity_id` / `PlatformUser.identity_id` to
   `AuthIdentity.id`. `LoginEvent` and `UserDevice` are deliberately FK-free so
   the identity module stays extractable as a standalone service (July design §6);
   a hard FK from the clinical schema into identity would kill that. Integrity is
   enforced in the service layer.
6. **`IAuthProvider` is deleted.** It exists to abstract a swappable vendor;
   self-hosting is the decision that there is no future vendor. It has been
   leaking Firebase concepts (`oobCode`, provider-config CRUD) into callers.
7. **`POST /v1/auth/provision` collapses into `GET /v1/auth/me`.** Once our own
   session knows which identity signed in, there is nothing to trade. This ends
   `USER_NOT_PROVISIONED`-as-normal-control-flow, the bug class behind the
   identity-resolution refactor of 2026-08-04.
8. **No transitional dual-path auth.** `AuthGuard` never verifies both a
   Firebase token and one of our sessions. Slice 2 is a hard cutover; federated
   sign-in is simply unavailable until slice 4. Only test accounts exist, and
   they can use password login throughout.
9. **Casbin is out of scope** — see §11.

## 4. Architecture

The web client stops being an identity SDK and becomes a thin API client.
Credentials are posted to our API; federated sign-in is a server-side redirect,
not a popup. The API owns hashing, session issuance, MFA, and the OIDC client.

New credential layer at `apps/api/src/lib/auth/local/`, kept separate from
`modules/identity` so that module keeps its no-clinical-imports boundary:

| File | Responsibility |
| --- | --- |
| `password.service.ts` | argon2id hash/verify; dummy hash on unknown email |
| `session.service.ts` | mint, verify-by-hash, touch, revoke, revoke-all |
| `totp.service.ts` | otplib wrapper, encrypted secrets, recovery codes |
| `oidc.service.ts` | openid-client, per-connection discovery cache, state/nonce |
| `crypto.ts` | AES-256-GCM helpers for secret columns |
| `strategies/` | `local.strategy.ts`, `google.strategy.ts`, `oidc.strategy.ts` |

Passport stays thin: strategies validate a credential and return an
`AuthIdentity`. Session issuance, MFA gating, lockout, and telemetry live in our
services, never in strategy callbacks — otherwise each of the four login paths
grows its own copy of the rules.

## 5. Data model

`User` and `PlatformUser` keep a unique, indexed identity column; only the
issuer of the value changes. `external_uid` becomes `identity_id` in slice 1,
still `VarChar(128)`, and is retyped to `uuid` in slice 2 once we mint the
values ourselves. No business data references it — patients,
consultations, prescriptions, and audit entries all key off `User.id` — so the
clinical schema is untouched.

Four new tables:

**`AuthIdentity`** — one row per login-capable principal, serving both `User`
and `PlatformUser` (they already join by the same column, so nothing
polymorphic is needed).

- `id` (uuid, PK — the value stored in `identity_id`)
- `email` (unique, stored lowercased)
- `passwordHash` (argon2id, nullable for SSO-only identities)
- `totpSecretEncrypted`, `totpEnrolledAt`
- `recoveryCodeHashes`
- `failedAttempts`, `lockedUntil`
- `status` (`active | suspended`), `createdAt`, `updatedAt`, `deletedAt`

**`Session`** — `tokenHash` (sha256 of 32 random bytes, unique), `identityId`,
`issuedAt`, `lastSeenAt`, `expiresAt`, `revokedAt`, `ipAddress`, `userAgent`.
The bearer token itself is never stored.

**`AuthFederatedIdentity`** — `identityId`, `provider`, `subject`, unique on
`(provider, subject)`. Resolves a Google or OIDC subject to a local identity
without trusting email alone. `provider` is `google` or `oidc:<connectionId>`,
so a subject asserted by one institution's connection can never satisfy another's.

**`AuthToken`** — one short-lived table with a `purpose` discriminator
(`password_reset`, `mfa_challenge`, `oauth_state`), plus `tokenHash`,
`payload` (JSONB), `expiresAt`, `usedAt`. One table rather than three
near-identical ones.

One new column: `SsoConnection.clientSecretEncrypted`. There is deliberately no
secret column today because the secret was write-only pass-through to Identity
Platform; running the OIDC client ourselves means holding it. Both it and
`totpSecretEncrypted` use AES-256-GCM under an `AUTH_ENCRYPTION_KEY` env var
(32-byte base64), with GCP KMS as a later upgrade.

`LoginEvent` and `UserDevice` need no changes — they were built FK-free and
provider-agnostic for exactly this scenario. The sole exception is
`LoginTelemetryService.mapFirebaseMfaUsed`, which reads a Firebase token claim
and is replaced by a boolean from our own login path.

## 6. Token lifecycle and flows

**Password login.** `POST /v1/auth/login` → `passport-local` → argon2id verify.
A miss on a nonexistent email still runs a dummy hash so response timing does
not leak account existence. Then either:

- No TOTP enrolled → issue a session, return `{ accessToken, expiresIn }`.
- TOTP enrolled → return `{ mfaRequired: true, challengeToken }`, an `AuthToken`
  with `purpose: 'mfa_challenge'` and a 5-minute TTL. `POST /v1/auth/mfa/verify`
  exchanges challenge + 6-digit code for a session. A session is never issued
  before the second factor.

**Session verification.** The bearer token is 32 random bytes, base64url. Only
`sha256(token)` is stored. `AuthGuard` hashes the incoming token, looks up the
session, rejects when revoked or past `expiresAt`, then continues into the
existing `findByIdentityId` path unchanged. `lastSeenAt` is written at most once
every 5 minutes to avoid a write per request. Idle expiry 12h, absolute cap 30d,
both configurable.

**Revocation.** Revoking stamps `revokedAt` rather than deleting the row, so the
staff security dashboard can still show when and why a session ended; a
scheduled job purges rows past `expiresAt`. Sign-out revokes one session.
Password change, suspension, and admin-forced sign-out revoke every session for
the identity. This is strictly better than today, where `revokeUserSessions` is
best-effort against Firebase and the guard cannot observe the result.

**Federated sign-in (Google and per-tenant OIDC).** Server-side redirects:

1. `GET /v1/auth/sso/:connectionId/start` stores an `oauth_state` `AuthToken`
   and 302s to the IdP.
2. `GET /v1/auth/sso/callback` validates state and nonce, then resolves
   `AuthFederatedIdentity` by `(provider, subject)`.
3. Auto-linking to an existing `AuthIdentity` happens **only** when the IdP
   asserts a verified email whose domain is owned by that `SsoConnection`.
   Otherwise a new identity is created with no clinic row, landing in the
   `unprovisioned` state `resolveDestination` already handles.
4. The callback redirects to the web app with a one-time code — an `AuthToken`
   with a 60-second TTL, single-use — which the client exchanges for a session,
   so the token never appears in a URL that could reach browser history, logs,
   or a `Referer` header.

**Set-password and reset.** `AuthToken` with `purpose: 'password_reset'`,
single-use, 1-hour TTL, delivered by nodemailer (the transport pattern in
`weekly-summary.service.ts`). This closes a real gap: today those links are
generated and logged rather than sent.

**Lockout.** `failedAttempts` and `lockedUntil` on `AuthIdentity`, exponential
backoff after 5 misses, cleared on success. Every attempt is recorded to
`LoginEvent`. Firebase did this invisibly; without it we would ship a
brute-forceable login.

## 7. API surface

| Endpoint | Purpose |
| --- | --- |
| `POST /v1/auth/login` | email + password; returns session or MFA challenge |
| `POST /v1/auth/mfa/verify` | challenge token + TOTP code → session |
| `POST /v1/auth/logout` | revoke current session |
| `GET /v1/auth/me` | resolved identity (replaces `POST /v1/auth/provision`) |
| `POST /v1/auth/password/forgot` | issue reset token, send email |
| `POST /v1/auth/password/reset` | consume reset token, set password, revoke sessions |
| `GET /v1/auth/sso/:connectionId/start` | begin federated redirect |
| `GET /v1/auth/sso/callback` | validate, resolve identity, redirect with one-time code |
| `POST /v1/auth/sso/exchange` | one-time code → session |

`POST /v1/auth/dev/token` is deleted in slice 2, as soon as `POST /v1/auth/login`
exists: it was only ever a shortcut for a web client that authenticated directly
against Firebase. Dev and production then use the same login path.

## 8. Web client

`IAuthClient` roughly halves. Removed: `verifyPasswordResetCode` and
`confirmPasswordReset` (plain API calls now), the Firebase multi-factor session
dance inside `enrollTotp`, the `completeTotpSignIn` / `cancelTotpSignIn`
resolver state, and both popup methods. Retained: `onAuthStateChanged`,
`getToken`, `signIn`, `signOut`. Added: `startSsoRedirect(connectionId)` and
`exchangeCallbackCode(code)`.

Session state becomes a token in `localStorage` plus an in-memory subscriber
list — no SDK. `AuthProvider`, `PublicOnlyGate`, `AuthGate`, `RequirePlatform`,
and `resolveDestination` are unchanged: the identity-resolution refactor of
2026-08-04 is already provider-agnostic. If one of their test suites needs
editing, that is a signal the swap is leaking past the seam.

## 9. Error handling

Added to the closed enum in `packages/shared/src/errors.ts`:
`INVALID_CREDENTIALS`, `ACCOUNT_LOCKED`, `MFA_REQUIRED`, `MFA_CODE_INVALID`,
`RESET_TOKEN_INVALID`, `SSO_STATE_INVALID`, `SSO_EMAIL_UNVERIFIED`.
`UNAUTHORIZED`, `TOKEN_INVALID`, and `TOKEN_EXPIRED` carry over.

Two deliberate rules:

- **No account enumeration.** Unknown email, wrong password, and locked account
  all return the same `INVALID_CREDENTIALS`. The true reason goes only to
  `LoginEvent` and the audit log. `ACCOUNT_LOCKED` exists for the staff security
  dashboard, never in a login response.
- **`USER_NOT_PROVISIONED` stops being a returned error** on normal page loads.
  It survives only as an `identity.kind`. Its comment in `errors.ts` ("valid
  Firebase token but no DB user yet") is rewritten.

`errorCodeToMessage` on the web currently translates Firebase codes such as
`auth/wrong-password`; it is rewritten against our enum, Spanish strings
colocated as usual.

## 10. Testing

Unit: `password.service` (including that the unknown-email path still runs a
dummy hash), `session.service`, `totp.service` against a fixed clock, AES-GCM
round-trip, OIDC state/nonce rejection.

Integration against real Postgres via the existing `db-test-utils`: password
login, password + TOTP, lockout then recovery, reset-link consumption, and an
SSO callback with a stubbed IdP.

Web: redirect kickoff and code exchange. Existing auth gate suites must pass
unedited.

Gates: `pnpm lint`, `pnpm test`, and `pnpm test:coverage` at the 95% per-file
threshold; security-sensitive files should reach 100%. Move `apps/web/.env`
aside before running coverage — it flips a fallback branch in `logger.ts`.

## 11. Out of scope

- **node-casbin and any authorization change.** The current role × module ×
  access-level grid expresses every rule needed today. `PermissionGuard` is 64
  lines doing zero database work, backed by six shipped plans of tests.
  Introducing a policy engine to reproduce existing behavior, during a
  credential-layer rewrite, doubles risk for no capability gain. If per-location
  or row-level ownership rules arrive in v1.5, Casbin can be revisited as its own
  project — `PermissionsService` is already the seam for it.
- Passkeys, SMS MFA, impossible-travel detection, IP allowlists.
- Per-device session revocation (the device registry stays observational).
- MFA enforcement defaults — `IdentityPolicy.mfaRequirement` still ships `off`.
- Standalone deployment of the identity module.

## 12. Delivery slices

Each slice lands green on `main`.

1. **Rename** `external_uid` → `identity_id` across schema, shared types,
   repositories, guard, and CLI. Pure rename: column type stays `VarChar(128)`,
   no behavior change, Firebase untouched. The TypeScript field rename must land
   as one commit — the pre-commit hook typechecks the whole workspace, so
   splitting it across packages breaks the build mid-sequence.
2. **Credential core** — new tables, argon2id, `passport-local`,
   `POST /v1/auth/login`, session verification in `AuthGuard`, reset tokens with
   real email delivery, lockout, and retyping `identity_id` to `uuid` now that
   we mint it. Also deletes `firebase-auth-client.ts`, the `firebase` web
   package, and `POST /v1/auth/dev/token`, and hides the Google and SSO buttons
   on the login page (slice 4 restores them).
3. **TOTP** rebuilt on our own stack.
4. **Federated** — Google and per-tenant OIDC by redirect; encrypted
   `client_secret`; login-page buttons restored.
5. **Excise** — delete `firebase-auth.provider.ts`, the `firebase-admin`
   package, `FIREBASE_*` config, the `emulator` script, and
   `mapFirebaseMfaUsed`; delete `IAuthProvider`; collapse `provision` into
   `GET /v1/auth/me`; add a `STATUS: SUPERSEDED` banner to the July identity
   design.

**There is no transitional Firebase fallback in `AuthGuard`.** From slice 2 it
accepts our sessions and nothing else, so there is exactly one verification path
at every point in the sequence. The cost is that Google and per-tenant SSO are
unavailable between slices 2 and 4 — acceptable because the only accounts in any
environment are the maintainer's own test users, who can sign in with a password
throughout. The benefit is that no dual-path code is ever written, and
`apps/web` becomes Firebase-free two slices earlier.

## 13. Cutover operations

Rollback is reverting the branch: no real users exist in any environment, only
the maintainer's test accounts.

Slice 2 is a hard cutover. Every Firebase-issued session stops being accepted
the moment it deploys, and passwords do not carry over — they only ever existed
as Firebase hashes, which we deliberately do not import. So for each
environment, at slice 2:

1. Re-run `bootstrap:platform` to mint the first staff account
   (`staff@rezeta.co` on dev, `staff@rezeta.test` locally), since deploys do not
   seed platform users.
2. Re-provision the remaining test users, each establishing a password through
   the set-password link — which doubles as the first real exercise of the new
   email delivery path.

TOTP enrollments are also not portable (secrets are never exportable). Any test
account with MFA re-enrolls in slice 3.

New environment configuration: `AUTH_ENCRYPTION_KEY` (32-byte base64) and SMTP
credentials for reset-link delivery. Removed: every `FIREBASE_*` variable and
the GCP service-account credentials used by the Admin SDK.
