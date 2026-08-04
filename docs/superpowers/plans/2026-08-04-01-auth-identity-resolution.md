# Auth Identity Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the auth layer resolve *what kind of identity is signed in* as a first-class outcome, and route every post-authentication redirect through one function. Today that decision is re-derived in five places, which is why the same login-loop bug has shipped three separate fixes (#45, #46, #47) and resurfaced each time somewhere new.

**Architecture:** `AuthProvider` resolves a Firebase session to exactly one discriminated `identity` and stores it. A single pure `resolveDestination()` maps *(identity, host surface, requested redirect)* to a path. Gates and pages consume those two things and never hard-code a destination again.

**Tech stack:** React + Zustand + React Router (apps/web). No API or schema changes — this is entirely client-side.

## Background: why the bug kept moving

Three facts interact badly, and no single site knows all three:

1. `POST /v1/auth/provision` **always** 401s `USER_NOT_PROVISIONED` for a `PlatformUser` — staff deliberately have no institution `User` row. So the auth store's `status` settles to `unauthenticated` for legitimate staff, and the real "green" signal for staff is `GET /v1/staff/me`, which today lives only in `RequirePlatform`.
2. Both hosts serve the same bundle, so every route is *routable* on both; only the host decides which app the user belongs to.
3. `AuthGate` stamps the route it bounced from into `?redirectTo=`, so a failed navigation plants a destination that outranks host-aware defaults on the next sign-in.

Each shipped fix addressed one hop of that chain. Centralising the decision removes the class.

## Global Constraints

- TDD per task; 95% per-file coverage gate (`pnpm test:coverage`); zero lint errors (`pnpm lint`); no TODO/FIXME comments.
- Staff console copy is **English** in `apps/web/src/pages/staff/strings.ts`; doctor-app copy is Spanish, colocated. Everything else (code, comments, changelog, this plan) English.
- Design tokens only — no arbitrary `prop-[value]` Tailwind classes.
- Commit messages: conventional-commit, **subject entirely lower-case** (commitlint `subject-case` rejects capitals), trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Web tests: `cd apps/web && pnpm exec vitest run <path>`.
- Move `apps/web/.env` aside before `pnpm test:coverage` — it flips a fallback branch in `logger.ts` and fails the gate.
- **Behaviour-preserving for the doctor app.** Every existing institution-user redirect must land exactly where it does today; those tests should not need editing. If one does, stop and re-check the design.

---

### Task 1: The identity model and destination resolver (pure, no wiring)

**Files:**
- Modify: `apps/web/src/lib/staff-host.tsx` (or extract to `apps/web/src/lib/auth-routing.ts` if it grows past ~80 lines)
- Test: `apps/web/src/lib/__tests__/auth-routing.test.ts`

**Produces:**

```ts
export type Identity =
  | { kind: 'loading' }
  | { kind: 'anonymous' }                              // no provider session
  | { kind: 'clinic'; user: AuthUser }                 // institution User row
  | { kind: 'staff'; principal: PlatformPrincipal }    // PlatformUser row
  | { kind: 'unprovisioned' }                          // live session, neither row

export function resolveDestination(input: {
  identity: Identity
  hostname: string
  requestedRedirect: string | null
}): string
```

Rules (each gets its own test):
- `clinic` → requested redirect when safe **and** `belongsToHostApp`, else `/dashboard`.
- `staff` → requested redirect when safe **and** `belongsToHostApp`, else `/staff/institutions`.
- `anonymous` → `/login`.
- `unprovisioned` → `null`-equivalent sentinel; the caller renders an explanation rather than navigating (see Task 4). Do **not** invent a redirect here — every redirect for this state loops.
- `loading` → callers must not call it; assert it throws or returns a sentinel, and cover that.

Reuse the existing `isSafeRedirect` (move it out of `Login/index.tsx` so it is shared, not duplicated) and `belongsToHostApp`.

- [ ] Tests written and watched failing
- [ ] Implemented, all green

---

### Task 2: `AuthProvider` resolves identity

**Files:**
- Modify: `apps/web/src/providers/AuthProvider.tsx`, `apps/web/src/store/auth.store.ts`
- Test: `apps/web/src/providers/__tests__/providers.test.tsx`

Resolution sequence on each `onAuthStateChanged`:

1. No session → `{ kind: 'anonymous' }`.
2. Session → `POST /v1/auth/provision`.
   - 200 → `{ kind: 'clinic', user }`.
   - 401 `USER_NOT_PROVISIONED` → `GET /v1/staff/me`.
     - 200 → `{ kind: 'staff', principal }`.
     - anything else → `{ kind: 'unprovisioned' }` (keep the Firebase session; do **not** sign out).
   - any other error → sign out, `{ kind: 'anonymous' }`.

Keep the existing `status` field derived from `identity` (`clinic` → `authenticated`, `loading` → `loading`, everything else → `unauthenticated`) so nothing outside this plan breaks mid-refactor. Remove it in Task 6 once no consumer is left.

Watch for: the `USER_NOT_PROVISIONED` log currently fires at `logger.error` and POSTs to `/v1/logs/client-error` on every staff page load. It is an expected condition and misled debugging twice — demote it to debug level as part of this task.

- [ ] Tests written and watched failing
- [ ] Implemented, all green

---

### Task 3: `PublicOnlyGate` owns the post-login redirect

**Files:**
- Modify: `apps/web/src/components/auth/PublicOnlyGate.tsx`, `apps/web/src/pages/Login/index.tsx`
- Test: existing suites for both

The login page should stop deciding destinations entirely: **delete `redirectAfterSuccess`**. `signIn` only signs in; when `identity` settles to `clinic` or `staff`, `PublicOnlyGate` redirects via `resolveDestination`. This removes the optimistic navigate-before-identity-resolves race that made the host check unreliable, and it means one gate handles password, Google, SSO and TOTP with no per-path duplication.

Keep a test asserting `/login?redirectTo=/staff/security` still lands there on a staff host — the guard must not degrade into "ignore redirectTo".

- [ ] Tests written and watched failing
- [ ] Implemented, all green

---

### Task 4: `RequirePlatform` reads identity instead of fetching

**Files:**
- Modify: `apps/web/src/components/auth/RequirePlatform.tsx`
- Test: `apps/web/src/components/auth/__tests__/RequirePlatform.test.tsx`

Branch purely on `identity`: `staff` renders children; `clinic` → `/dashboard`; `anonymous` → `/login`; `unprovisioned` → the existing `NoStaffAccess` screen; `loading` → null. The `useStaffMe` call moves into `AuthProvider` (Task 2), so this gate stops duplicating the request. Keep `useStaffMe` itself for staff pages that display the principal (e.g. `PlatformUsers.tsx`), reading from the store.

- [ ] Tests written and watched failing
- [ ] Implemented, all green

---

### Task 5: `AuthGate` and `SetPassword`

**Files:**
- Modify: `apps/web/src/components/auth/AuthGate.tsx`, `apps/web/src/pages/SetPassword/index.tsx`
- Test: existing suites

`AuthGate` requires `clinic`; anything else routes through `resolveDestination`. It should keep stamping `?redirectTo=`, which is now safe because the resolver validates the surface. `SetPassword` drops its own `defaultPostLoginPath` call for the same reason as Task 3.

- [ ] Tests written and watched failing
- [ ] Implemented, all green

---

### Task 6: Remove the derived `status` shim

**Files:** `apps/web/src/store/auth.store.ts` and any remaining consumers.

Grep for `status ===` across `apps/web/src`; every hit should be gone or converted to `identity.kind`. Delete the shim. This task is what makes the refactor actually reduce the number of places that decide.

- [ ] Grep clean, all green

---

## Verification

- `pnpm lint`, `pnpm test`, `pnpm test:coverage` all clean.
- Manual on dev after deploy, since none of this is reachable from a unit test end-to-end:
  1. Signed out on `staff-dev.rezeta.co` → login page.
  2. Sign in as `staff@rezeta.co` → `/staff/institutions`.
  3. Same, arriving at `/login?redirectTo=%2Fdashboard` → still `/staff/institutions`.
  4. `/login?redirectTo=%2Fstaff%2Fsecurity` → `/staff/security`.
  5. Institution user on `app-dev.rezeta.co` → `/dashboard`, unchanged.
  6. Institution user on `staff-dev.rezeta.co` → `/dashboard`, no loop.

## Out of scope

Server-side changes. The `USER_NOT_PROVISIONED` contract stays exactly as it is — it is correct, and the fix is for the client to stop treating an expected outcome as an error.
