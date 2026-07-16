# Frontend Permission Gating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate the web UI on the capability map delivered by `/auth/me` — a `useCan` hook, a `<RequireCan>` route wrapper, capability-filtered navigation, and read-only rendering of patients and consultations for `view`-only roles (the assistant case).

**Architecture:** The resolved `capabilities: CapabilityMap` already rides on `AuthUser` in `useAuthStore` (Slices 1–2). This slice reads it in one place — a `useCan(module, level)` hook that delegates to the shared `hasCapability`. Every other surface (route guard, nav filter, action gating) is built on `useCan`, so the access rules live in shared code, not scattered across components.

**Tech Stack:** React 18 + Vite, Zustand (`useAuthStore`), React Router v6 (`createBrowserRouter`, `<Navigate>`), Tailwind (design tokens only), Vitest + Testing Library (`@testing-library/react`, `@testing-library/user-event`, jsdom). Shared permission primitives imported from `@rezeta/shared`.

## Global Constraints

- **Dependency on Slices 1–2.** This plan assumes `@rezeta/shared` already exports (via `packages/shared/src/index.ts`): `hasCapability(caps: CapabilityMap, module: ModuleKey, required: AccessLevel): boolean`, `defaultCapabilitiesFor(role: UserRole): CapabilityMap`, and the types `CapabilityMap`, `ModuleKey`, `AccessLevel`, `UserRole`; and that `AuthUser` (`packages/shared/src/types/auth.ts`) now carries `capabilities: CapabilityMap` and `isPlatformAdmin: boolean`. Do not redefine any of these — import them verbatim.
- **`ModuleKey` values are exact strings** (from the catalog): `'patients' | 'consultations' | 'protocols' | 'appointments' | 'orders' | 'billing' | 'locations' | 'templates' | 'categories' | 'schedules_config' | 'audit_log' | 'users' | 'permissions'`. Use these keys verbatim — never invent a key.
- **`AccessLevel`** is `'none' | 'view' | 'manage'`. GET/read surfaces gate on `'view'`; create/edit/delete controls gate on `'manage'`.
- **Language:** ALL code, comments, tests, and commit messages in English. The ONLY Spanish permitted is user-facing UI strings, and those live in the colocated `strings.ts` next to their component. Do not hardcode any new Spanish string in a component — this slice reuses existing `strings.ts` labels and adds none.
- **Design system:** every color, spacing, radius, and type size references a token (`text-n-700`, `bg-p-500`, `rounded-sm`, …). No raw hex, no arbitrary `prop-[value]` Tailwind classes (ESLint `no-restricted-syntax` fails CI). This slice adds no new markup styling — it only conditionally renders existing elements — so no new tokens are required.
- **No `TODO/FIXME/HACK/XXX` comments** (ESLint `no-warning-comments` fails CI).
- **Quality gate:** run `pnpm lint` and `pnpm test` from the repo root before considering the slice done; zero lint errors, zero failing tests. Coverage note: every file this slice creates (`src/hooks/use-can.ts`, `src/components/auth/RequireCan.tsx`, `src/test/auth-helpers.ts`) and every file it modifies (`Sidebar.tsx`, `App.tsx`, `src/pages/**`) is already excluded from the coverage `include`/threshold set in `apps/web/vitest.config.ts` (`src/hooks/**/use-*.ts`, `src/components/auth/**`, `src/components/layout/**`, `src/test/**`, `src/pages/**`). The 95% per-file gate therefore does not apply to these files, but the tests below are still required.
- **After the slice:** prepend a `CHANGELOG.md` entry (English) under `### Added` naming the new hook, wrapper, and gated surfaces.
- **Do NOT run `git commit` as part of writing this plan.** The commit steps below are instructions for the executor.

---

### Task 1: `useCan` hook + shared test helper

Creates the single read point for capabilities and the reusable fixture every later task uses to seed the auth store.

**Files:**
- Create: `apps/web/src/hooks/use-can.ts`
- Create: `apps/web/src/test/auth-helpers.ts`
- Test: `apps/web/src/hooks/__tests__/use-can.test.ts`

**Interfaces:**
- Consumes (from `@rezeta/shared`, Slices 1–2): `hasCapability`, `defaultCapabilitiesFor`, and types `CapabilityMap`, `ModuleKey`, `AccessLevel`, `UserRole`, `AuthUser`. From `@/store/auth.store`: `useAuthStore` (Zustand store; `useAuthStore.setState(...)` is available for tests).
- Produces:
  - `useCan(module: ModuleKey, level?: AccessLevel): boolean` — default `level` is `'view'`; returns `false` when unauthenticated.
  - `makeAuthUser(role: UserRole, overrides?: Partial<AuthUser>): AuthUser` — a fully-populated fake user whose `capabilities` default to `defaultCapabilitiesFor(role)`.
  - `seedAuthUser(user: AuthUser | null): void` — sets `useAuthStore` state (`user` + derived `status`).

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/hooks/__tests__/use-can.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCan } from '../use-can'
import { useAuthStore } from '@/store/auth.store'
import { makeAuthUser, seedAuthUser } from '@/test/auth-helpers'

afterEach(() => {
  seedAuthUser(null)
})

describe('useCan', () => {
  it('returns false when unauthenticated', () => {
    const { result } = renderHook(() => useCan('patients', 'view'))
    expect(result.current).toBe(false)
  })

  it('grants view but denies manage to an assistant on patients', () => {
    seedAuthUser(makeAuthUser('assistant'))
    expect(renderHook(() => useCan('patients', 'view')).result.current).toBe(true)
    expect(renderHook(() => useCan('patients', 'manage')).result.current).toBe(false)
  })

  it('grants manage to a doctor on patients', () => {
    seedAuthUser(makeAuthUser('doctor'))
    expect(renderHook(() => useCan('patients', 'manage')).result.current).toBe(true)
  })

  it('defaults the required level to view', () => {
    seedAuthUser(makeAuthUser('assistant'))
    expect(renderHook(() => useCan('patients')).result.current).toBe(true)
  })

  it('denies a module the role lacks entirely (assistant protocols)', () => {
    seedAuthUser(makeAuthUser('assistant'))
    expect(renderHook(() => useCan('protocols', 'view')).result.current).toBe(false)
  })

  it('reflects a capability override on the seeded user', () => {
    seedAuthUser(
      makeAuthUser('assistant', {
        capabilities: { ...makeAuthUser('assistant').capabilities, protocols: 'manage' },
      }),
    )
    expect(renderHook(() => useCan('protocols', 'manage')).result.current).toBe(true)
    // useAuthStore is a module singleton; assert the seed actually took effect.
    expect(useAuthStore.getState().user?.capabilities.protocols).toBe('manage')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @rezeta/web test -- src/hooks/__tests__/use-can.test.ts`
Expected: FAIL — cannot resolve `../use-can` and `@/test/auth-helpers` (modules not created yet).

- [ ] **Step 3: Create the test helper**

Create `apps/web/src/test/auth-helpers.ts`:

```ts
import type { AuthUser, UserRole } from '@rezeta/shared'
import { defaultCapabilitiesFor } from '@rezeta/shared'
import { useAuthStore } from '@/store/auth.store'

/**
 * Build a fully-populated fake AuthUser for tests. Capabilities default to the
 * catalog defaults for the role; pass `overrides.capabilities` to diverge.
 */
export function makeAuthUser(role: UserRole, overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'user-1',
    externalUid: 'fb-uid',
    tenantId: 'tenant-1',
    email: `${role}@rezeta.app`,
    fullName: 'Test User',
    role,
    specialty: null,
    licenseNumber: null,
    tenantSeededAt: '2026-01-01T00:00:00Z',
    preferences: {},
    capabilities: defaultCapabilitiesFor(role),
    isPlatformAdmin: false,
    ...overrides,
  }
}

/** Seed (or clear) the auth store with a fake user and its derived status. */
export function seedAuthUser(user: AuthUser | null): void {
  useAuthStore.setState({ user, status: user ? 'authenticated' : 'unauthenticated' })
}
```

- [ ] **Step 4: Create the `useCan` hook**

Create `apps/web/src/hooks/use-can.ts`:

```ts
import { hasCapability } from '@rezeta/shared'
import type { AccessLevel, ModuleKey } from '@rezeta/shared'
import { useAuthStore } from '@/store/auth.store'

/**
 * Returns whether the current user has at least `level` access on `module`.
 * False when unauthenticated (no capability map on the store).
 */
export function useCan(module: ModuleKey, level: AccessLevel = 'view'): boolean {
  const capabilities = useAuthStore((s) => s.user?.capabilities)
  if (!capabilities) return false
  return hasCapability(capabilities, module, level)
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @rezeta/web test -- src/hooks/__tests__/use-can.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/hooks/use-can.ts apps/web/src/test/auth-helpers.ts apps/web/src/hooks/__tests__/use-can.test.ts
git commit -m "feat(web): add useCan capability hook and auth test helper"
```

---

### Task 2: `<RequireCan>` route wrapper + apply to routes

A declarative guard that redirects to `/dashboard` when the user lacks the required access, wrapping restricted route elements in `App.tsx`.

**Files:**
- Create: `apps/web/src/components/auth/RequireCan.tsx`
- Modify: `apps/web/src/App.tsx` (imports + the two protected `children` arrays)
- Test: `apps/web/src/components/auth/__tests__/RequireCan.test.tsx`

**Interfaces:**
- Consumes: `useCan` (Task 1); `makeAuthUser`/`seedAuthUser` (Task 1); `Navigate` from `react-router-dom`; types `ModuleKey`, `AccessLevel` from `@rezeta/shared`.
- Produces: `RequireCan` component with props `{ module: ModuleKey; level?: AccessLevel; children: ReactNode }` — renders `children` when allowed, else `<Navigate to="/dashboard" replace />`. Default `level` is `'view'`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/auth/__tests__/RequireCan.test.tsx`:

```tsx
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { RequireCan } from '../RequireCan'
import { makeAuthUser, seedAuthUser } from '@/test/auth-helpers'

afterEach(() => {
  seedAuthUser(null)
})

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/protocolos"
          element={
            <RequireCan module="protocols">
              <div>Protocolos content</div>
            </RequireCan>
          }
        />
        <Route path="/dashboard" element={<div>Dashboard content</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('RequireCan', () => {
  it('redirects to /dashboard when the user lacks view on the module', () => {
    seedAuthUser(makeAuthUser('assistant')) // assistant: protocols = none
    renderAt('/protocolos')
    expect(screen.getByText('Dashboard content')).toBeInTheDocument()
    expect(screen.queryByText('Protocolos content')).not.toBeInTheDocument()
  })

  it('renders children when the user has the required access', () => {
    seedAuthUser(makeAuthUser('doctor')) // doctor: protocols = manage (>= view)
    renderAt('/protocolos')
    expect(screen.getByText('Protocolos content')).toBeInTheDocument()
    expect(screen.queryByText('Dashboard content')).not.toBeInTheDocument()
  })

  it('redirects an unauthenticated user', () => {
    renderAt('/protocolos')
    expect(screen.getByText('Dashboard content')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @rezeta/web test -- src/components/auth/__tests__/RequireCan.test.tsx`
Expected: FAIL — cannot resolve `../RequireCan`.

- [ ] **Step 3: Create the wrapper**

Create `apps/web/src/components/auth/RequireCan.tsx`:

```tsx
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import type { AccessLevel, ModuleKey } from '@rezeta/shared'
import { useCan } from '@/hooks/use-can'

interface RequireCanProps {
  module: ModuleKey
  level?: AccessLevel
  children: ReactNode
}

/**
 * Route guard: renders children when the user has at least `level` (default
 * 'view') on `module`, otherwise redirects to the dashboard. AuthGate handles
 * the unauthenticated case earlier; this guard only refines access per module.
 */
export function RequireCan({ module, level = 'view', children }: RequireCanProps): JSX.Element {
  const allowed = useCan(module, level)
  if (!allowed) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @rezeta/web test -- src/components/auth/__tests__/RequireCan.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Wire the wrapper into `App.tsx`**

In `apps/web/src/App.tsx`, add the import after the other `@/components/auth` imports (near line 4):

```tsx
import { RequireCan } from '@/components/auth/RequireCan'
```

Replace the standard protected `children` array (currently lines 72–97, the array starting with the `index` redirect and ending at the `ajustes/design-system/reference` route) with this version — `dashboard` and `agenda` stay ungated only where noted; every restricted element is wrapped with its module key:

```tsx
      // Root redirect
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      { path: 'dashboard', element: <Dashboard /> },
      {
        path: 'agenda',
        element: (
          <RequireCan module="appointments">
            <Schedule />
          </RequireCan>
        ),
      },
      {
        path: 'pacientes',
        element: (
          <RequireCan module="patients">
            <Patients />
          </RequireCan>
        ),
      },
      {
        path: 'pacientes/:id',
        element: (
          <RequireCan module="patients">
            <PatientDetail />
          </RequireCan>
        ),
      },
      {
        path: 'consultas/nueva',
        element: (
          <RequireCan module="consultations">
            <NewConsultation />
          </RequireCan>
        ),
      },
      {
        path: 'protocolos',
        element: (
          <RequireCan module="protocols">
            <Protocols />
          </RequireCan>
        ),
      },
      {
        path: 'protocolos/:id',
        element: (
          <RequireCan module="protocols">
            <ProtocolViewer />
          </RequireCan>
        ),
      },
      {
        path: 'protocolos/:id/edit',
        element: (
          <RequireCan module="protocols">
            <ProtocolEditor />
          </RequireCan>
        ),
      },
      {
        path: 'facturacion',
        element: (
          <RequireCan module="billing">
            <Billing />
          </RequireCan>
        ),
      },
      {
        path: 'ajustes',
        element: (
          <RequireCan module="templates">
            <Settings />
          </RequireCan>
        ),
      },
      {
        path: 'ajustes/plantillas',
        element: (
          <RequireCan module="templates">
            <Templates />
          </RequireCan>
        ),
      },
      {
        path: 'ajustes/plantillas/new',
        element: (
          <RequireCan module="templates">
            <TemplateEditorNew />
          </RequireCan>
        ),
      },
      {
        path: 'ajustes/plantillas/:id/edit',
        element: (
          <RequireCan module="templates">
            <TemplateEditor />
          </RequireCan>
        ),
      },
      {
        path: 'ajustes/tipos',
        element: (
          <RequireCan module="categories">
            <Types />
          </RequireCan>
        ),
      },
      {
        path: 'ajustes/ubicaciones',
        element: (
          <RequireCan module="locations">
            <Locations />
          </RequireCan>
        ),
      },
      {
        path: 'ajustes/registros',
        element: (
          <RequireCan module="audit_log">
            <AuditLog />
          </RequireCan>
        ),
      },
      {
        path: 'ajustes/horarios',
        element: (
          <RequireCan module="schedules_config">
            <Schedules />
          </RequireCan>
        ),
      },
      {
        path: 'ajustes/design-system/prototype',
        element: (
          <RequireCan module="templates">
            <AppPrototype />
          </RequireCan>
        ),
      },
      {
        path: 'ajustes/design-system/reference',
        element: (
          <RequireCan module="templates">
            <DesignSystemReference />
          </RequireCan>
        ),
      },
```

Then wrap the full-bleed consultation route (currently line 108) so it reads:

```tsx
    children: [
      {
        path: 'consultas/:id',
        element: (
          <RequireCan module="consultations">
            <Consultation />
          </RequireCan>
        ),
      },
    ],
```

Note: `/ajustes` and the two `design-system` routes gate on `'templates'` as the representative admin-section module — a doctor/admin/super_admin has it (`manage`), an assistant has `none`, matching the "assistant sees no settings" intent. Sub-pages that own a more specific module (`categories`, `locations`, `audit_log`, `schedules_config`) gate on that module directly.

- [ ] **Step 6: Run the full web test suite and lint**

Run: `pnpm --filter @rezeta/web test`
Expected: PASS (no regressions; App.tsx is integration-tested only).
Run: `pnpm --filter @rezeta/web lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/auth/RequireCan.tsx apps/web/src/components/auth/__tests__/RequireCan.test.tsx apps/web/src/App.tsx
git commit -m "feat(web): guard restricted routes with RequireCan"
```

---

### Task 3: Capability-filtered sidebar navigation

Each nav item declares an optional `ModuleKey`; items the user cannot `view` are hidden, and a group with no visible items renders nothing.

**Files:**
- Modify: `apps/web/src/components/layout/Sidebar.tsx`
- Test: `apps/web/src/components/layout/__tests__/Sidebar.test.tsx` (new)

No `strings.ts` change: all labels already exist in `apps/web/src/components/layout/strings.ts` (`sidebarStrings.navProtocols`, `navSettings`, etc.).

**Interfaces:**
- Consumes: `hasCapability` and types `CapabilityMap`, `ModuleKey` from `@rezeta/shared`; `useAuthStore`; `makeAuthUser`/`seedAuthUser` (Task 1).
- Produces: internal `NavItem.module?: ModuleKey` field and a module-scoped `canViewNav(caps, module?)` predicate. No exported API change.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/layout/__tests__/Sidebar.test.tsx`:

```tsx
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Sidebar } from '../Sidebar'
import { makeAuthUser, seedAuthUser } from '@/test/auth-helpers'

afterEach(() => {
  seedAuthUser(null)
})

function renderSidebar(): void {
  render(
    <MemoryRouter>
      <Sidebar open={false} onClose={() => undefined} />
    </MemoryRouter>,
  )
}

describe('Sidebar permission filtering', () => {
  it('hides Protocolos and Ajustes for an assistant', () => {
    seedAuthUser(makeAuthUser('assistant'))
    renderSidebar()
    // assistant: protocols = none, all admin modules = none
    expect(screen.queryByText('Protocolos')).not.toBeInTheDocument()
    expect(screen.queryByText('Ajustes')).not.toBeInTheDocument()
    // sanity: modules the assistant retains are still shown
    expect(screen.getByText('Pacientes')).toBeInTheDocument()
    expect(screen.getByText('Facturación')).toBeInTheDocument()
  })

  it('shows Protocolos and Ajustes for a doctor', () => {
    seedAuthUser(makeAuthUser('doctor'))
    renderSidebar()
    expect(screen.getByText('Protocolos')).toBeInTheDocument()
    // "Ajustes" appears only in the nav here — the user-menu copy of it lives
    // inside a closed Radix dropdown that is not rendered until opened.
    expect(screen.getByText('Ajustes')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @rezeta/web test -- src/components/layout/__tests__/Sidebar.test.tsx`
Expected: FAIL — assistant still sees "Protocolos"/"Ajustes" (no filtering yet).

- [ ] **Step 3: Add module keys and filtering to `Sidebar.tsx`**

In `apps/web/src/components/layout/Sidebar.tsx`, add the shared imports after the existing `@/store/auth.store` import (near line 7):

```tsx
import { hasCapability } from '@rezeta/shared'
import type { CapabilityMap, ModuleKey } from '@rezeta/shared'
```

Extend the `NavItem` interface (currently lines 15–22) with an optional module key:

```tsx
interface NavItem {
  to: string
  icon: string
  label: string
  count?: number
  /** Extra path prefixes that should also mark this item active. */
  alsoActiveOn?: string[]
  /** Module this item maps to; when set, hidden unless the user can `view` it. */
  module?: ModuleKey
}
```

Assign module keys in the three nav arrays. `NAV_HOY` (Dashboard has no module → always visible; Agenda maps to appointments):

```tsx
const NAV_HOY: NavItem[] = [
  { to: '/dashboard', icon: 'squares-four', label: sidebarStrings.navDashboard },
  { to: '/agenda', icon: 'calendar-blank', label: sidebarStrings.navAgenda, module: 'appointments' },
]

const NAV_CLINICO: NavItem[] = [
  {
    to: '/pacientes',
    icon: 'user',
    label: sidebarStrings.navPatients,
    alsoActiveOn: ['/consultas'],
    module: 'patients',
  },
  { to: '/protocolos', icon: 'stack', label: sidebarStrings.navProtocols, module: 'protocols' },
]

const NAV_ADMIN: NavItem[] = [
  { to: '/facturacion', icon: 'receipt', label: sidebarStrings.navBilling, module: 'billing' },
  // 'templates' represents the admin section: doctor/admin/super_admin have it,
  // assistant does not — matching the settings route guard in App.tsx.
  { to: '/ajustes', icon: 'gear-six', label: sidebarStrings.navSettings, module: 'templates' },
]
```

Add a module-scoped predicate above `NavGroup` (after the `NavGroupProps` interface / `initials` helper, near line 52):

```tsx
function canViewNav(caps: CapabilityMap | undefined, module?: ModuleKey): boolean {
  if (!module) return true
  if (!caps) return false
  return hasCapability(caps, module, 'view')
}
```

Make `NavGroup` render nothing when it has no items (guard at the top of the component body, currently around line 59):

```tsx
function NavGroup({ label, items }: NavGroupProps): JSX.Element | null {
  const { pathname } = useLocation()
  if (items.length === 0) return null
  return (
    // ...unchanged JSX...
```

Finally, in the `Sidebar` component read the capability map and filter each group before rendering. Replace the three `<NavGroup .../>` lines (currently lines 149–151) — and add the capability read next to the existing hooks near line 109:

```tsx
  const capabilities = useAuthStore((s) => s.user?.capabilities)
```

```tsx
          <NavGroup
            label={sidebarStrings.navTodayLabel}
            items={NAV_HOY.filter((item) => canViewNav(capabilities, item.module))}
          />
          <NavGroup
            label={sidebarStrings.navClinicalLabel}
            items={NAV_CLINICO.filter((item) => canViewNav(capabilities, item.module))}
          />
          <NavGroup
            label={sidebarStrings.navAdminLabel}
            items={NAV_ADMIN.filter((item) => canViewNav(capabilities, item.module))}
          />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @rezeta/web test -- src/components/layout/__tests__/Sidebar.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/layout/Sidebar.tsx apps/web/src/components/layout/__tests__/Sidebar.test.tsx
git commit -m "feat(web): filter sidebar nav by module view capability"
```

---

### Task 4: Read-only patients surface for view-only roles

Hide the create/edit/delete controls on the patients list when the user has `view` but not `manage` on `patients` (the assistant case).

**Files:**
- Modify: `apps/web/src/pages/Patients/index.tsx`
- Modify: `apps/web/src/pages/Patients/PatientRow.tsx`
- Test: `apps/web/src/pages/Patients/__tests__/PatientsReadOnly.test.tsx` (new)

**Interfaces:**
- Consumes: `useCan` (Task 1); `makeAuthUser`/`seedAuthUser` (Task 1).
- Produces: `PatientRow` gains a `canManage: boolean` prop that, when `false`, renders only the view (eye) `IconButton` — omitting the edit (pencil) and delete (trash) controls.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/pages/Patients/__tests__/PatientsReadOnly.test.tsx`:

```tsx
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { makeAuthUser, seedAuthUser } from '@/test/auth-helpers'

const patient = {
  id: 'p1',
  tenantId: 't1',
  ownerUserId: 'u1',
  firstName: 'Ana',
  lastName: 'Reyes',
  dateOfBirth: '1990-01-01',
  sex: 'female',
  documentType: 'cedula',
  documentNumber: '001-1234567-8',
  phone: '809-555-0000',
  email: null,
  address: null,
  bloodType: null,
  allergies: [],
  chronicConditions: [],
  notes: null,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  deletedAt: null,
}

vi.mock('@/hooks/patients/use-patients', () => ({
  usePatients: () => ({ data: { items: [patient], hasMore: false }, isLoading: false, isError: false }),
  useDeletePatient: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

import { Patients } from '../index'

function renderPatients(): void {
  render(
    <MemoryRouter>
      <Patients />
    </MemoryRouter>,
  )
}

afterEach(() => {
  seedAuthUser(null)
  vi.clearAllMocks()
})

describe('Patients read-only gating', () => {
  it('hides create/edit/delete controls for a view-only assistant', () => {
    seedAuthUser(makeAuthUser('assistant')) // patients = view
    renderPatients()
    expect(screen.queryByRole('button', { name: 'Registrar paciente' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar paciente' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Eliminar paciente' })).not.toBeInTheDocument()
    // read access is unaffected
    expect(screen.getByRole('button', { name: 'Ver paciente' })).toBeInTheDocument()
  })

  it('shows create/edit/delete controls for a doctor', () => {
    seedAuthUser(makeAuthUser('doctor')) // patients = manage
    renderPatients()
    expect(screen.getByRole('button', { name: 'Registrar paciente' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Editar paciente' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Eliminar paciente' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @rezeta/web test -- src/pages/Patients/__tests__/PatientsReadOnly.test.tsx`
Expected: FAIL — "Registrar paciente" / "Editar paciente" / "Eliminar paciente" still present for the assistant.

- [ ] **Step 3: Gate the create control in `Patients/index.tsx`**

In `apps/web/src/pages/Patients/index.tsx`, add the import after the existing hook imports (near line 4):

```tsx
import { useCan } from '@/hooks/use-can'
```

Inside the component (after the mutation hook, near line 25) read the capability:

```tsx
  const canManage = useCan('patients', 'manage')
```

Wrap the header "Registrar paciente" `<Button>` (currently lines 97–100) so it only renders when `canManage`:

```tsx
        {canManage && (
          <Button variant="primary" onClick={openCreate}>
            <i className="ph ph-plus mr-2" />
            {patientsPageStrings.registerButton}
          </Button>
        )}
```

Gate the `EmptyState` action the same way — pass the button only when `canManage` (currently lines 135–139). Replace the `action={...}` prop with:

```tsx
            {...(canManage
              ? {
                  action: (
                    <Button variant="primary" onClick={openCreate}>
                      {patientsPageStrings.registerButton}
                    </Button>
                  ),
                }
              : {})}
```

Pass `canManage` down to each `PatientRow` (currently lines 165–171):

```tsx
                <PatientRow
                  key={patient.id}
                  patient={patient}
                  canManage={canManage}
                  onView={() => openView(patient)}
                  onEdit={() => openEdit(patient)}
                  onDelete={() => openDelete(patient)}
                />
```

- [ ] **Step 4: Gate the row controls in `PatientRow.tsx`**

In `apps/web/src/pages/Patients/PatientRow.tsx`, add `canManage` to the props interface (currently lines 7–12):

```tsx
export interface PatientRowProps {
  patient: Patient
  canManage: boolean
  onView: () => void
  onEdit: () => void
  onDelete: () => void
}
```

Destructure it (currently line 14):

```tsx
export function PatientRow({ patient, canManage, onView, onEdit, onDelete }: PatientRowProps): JSX.Element {
```

Wrap the edit and delete `IconButton`s (currently lines 81–94) so they render only with `manage`; keep the view button always visible:

```tsx
          <IconButton
            icon="ph ph-eye"
            aria-label={patientRowStrings.viewLabel}
            tone="neutral"
            size="md"
            onClick={onView}
          />
          {canManage && (
            <>
              <IconButton
                icon="ph ph-pencil-simple"
                aria-label={patientRowStrings.editLabel}
                tone="neutral"
                size="md"
                onClick={onEdit}
              />
              <IconButton
                icon="ph ph-trash"
                aria-label={patientRowStrings.deleteLabel}
                tone="danger"
                size="md"
                onClick={onDelete}
              />
            </>
          )}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @rezeta/web test -- src/pages/Patients/__tests__/PatientsReadOnly.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/Patients/index.tsx apps/web/src/pages/Patients/PatientRow.tsx apps/web/src/pages/Patients/__tests__/PatientsReadOnly.test.tsx
git commit -m "feat(web): hide patient create/edit/delete for view-only roles"
```

---

### Task 5: Read-only consultation surface for view-only roles

When the user has `view` but not `manage` on `consultations`, force the consultation into read-only rendering and hide the sign/amend action.

**Files:**
- Modify: `apps/web/src/pages/Consultation/index.tsx`
- Modify: `apps/web/src/pages/Consultation/PageHeader.tsx`
- Test: `apps/web/src/pages/Consultation/__tests__/PageHeader.test.tsx` (extend existing)

**Interfaces:**
- Consumes: `useCan` (Task 1). `PageHeader` already accepts `isSigned`, `canSign`, `onSignClick`, `onAmend`.
- Produces: `PageHeader` gains an optional `canManage?: boolean` prop (default `true`); when `false`, neither the sign nor the amend button renders. `Consultation` computes `readOnly = isSigned || !canManageConsultations` and passes it to `ProtocolPanel`/`OrdersRail` (which already take a `readOnly` prop).

- [ ] **Step 1: Write the failing test (extend PageHeader test)**

Append these two cases inside the existing `describe('PageHeader', ...)` block in `apps/web/src/pages/Consultation/__tests__/PageHeader.test.tsx` (the `baseProps` fixture and imports at the top of that file already exist):

```tsx
  it('hides the "Firmar y cerrar" button when the user cannot manage', () => {
    render(<PageHeader {...baseProps} canManage={false} />)
    expect(screen.queryByRole('button', { name: /Firmar y cerrar/i })).not.toBeInTheDocument()
  })

  it('hides the "Enmienda" button on a signed consultation when the user cannot manage', () => {
    render(<PageHeader {...baseProps} isSigned canManage={false} />)
    expect(screen.queryByRole('button', { name: /Enmienda/i })).not.toBeInTheDocument()
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @rezeta/web test -- src/pages/Consultation/__tests__/PageHeader.test.tsx`
Expected: FAIL — the sign/amend buttons still render because `canManage` is not yet a prop (unknown prop is ignored, buttons appear).

- [ ] **Step 3: Add `canManage` to `PageHeader.tsx`**

In `apps/web/src/pages/Consultation/PageHeader.tsx`, add the prop to `PageHeaderProps` (currently lines 7–22):

```tsx
  onSignClick: () => void
  /** Whether the user may sign/amend; when false, both actions are hidden. */
  canManage?: boolean
```

Destructure it with a default (currently lines 24–39):

```tsx
  onSignClick,
  canManage = true,
}: PageHeaderProps): JSX.Element {
```

Wrap the sign/amend action block (currently lines 88–104) so it only renders when `canManage`:

```tsx
        {canManage &&
          (isSigned ? (
            <Button variant="secondary" size="sm" onClick={onAmend}>
              <i className="ph ph-pencil-simple mr-1" />
              Enmienda
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={onSignClick}
              disabled={!canSign}
              title={canSign ? undefined : pageHeaderStrings.signRequiresProtocol}
            >
              <i className="ph ph-check mr-1" />
              {pageHeaderStrings.signButton}
            </Button>
          ))}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @rezeta/web test -- src/pages/Consultation/__tests__/PageHeader.test.tsx`
Expected: PASS (all prior cases + the 2 new ones).

- [ ] **Step 5: Wire `useCan` into `Consultation/index.tsx`**

In `apps/web/src/pages/Consultation/index.tsx`, add the import after the existing hook imports (near line 9):

```tsx
import { useCan } from '@/hooks/use-can'
```

Read the capability near the other derived flags (after `const isSigned = consultationSigned`, currently line 97):

```tsx
  const canManageConsultations = useCan('consultations', 'manage')
  const readOnly = isSigned || !canManageConsultations
```

Pass `canManage` to `PageHeader` (add to the props at line 120–134):

```tsx
          onSignClick={handleSignClick}
          canManage={canManageConsultations}
```

Replace `readOnly={isSigned}` on `ProtocolPanel` (currently line 168) and on `OrdersRail` (currently line 188) with `readOnly={readOnly}`:

```tsx
          <ProtocolPanel
            consultation={consultation}
            readOnly={readOnly}
```

```tsx
          <OrdersRail
            consultation={consultation}
            readOnly={readOnly}
```

- [ ] **Step 6: Run the full web suite and lint**

Run: `pnpm --filter @rezeta/web test`
Expected: PASS (no regressions).
Run: `pnpm --filter @rezeta/web lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/pages/Consultation/index.tsx apps/web/src/pages/Consultation/PageHeader.tsx apps/web/src/pages/Consultation/__tests__/PageHeader.test.tsx
git commit -m "feat(web): render consultations read-only for view-only roles"
```

---

### Task 6: Changelog + final verification

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Prepend the changelog entry**

Add at the top of `CHANGELOG.md`:

```markdown
## [2026-07-15] Frontend permission gating

### Added

- `useCan(module, level)` hook (`apps/web/src/hooks/use-can.ts`) reading the auth
  store capability map via shared `hasCapability`.
- `<RequireCan>` route wrapper (`apps/web/src/components/auth/RequireCan.tsx`)
  redirecting to `/dashboard` when the user lacks the required module access;
  applied to protocol, billing, patient, consultation, and settings routes in
  `apps/web/src/App.tsx`.
- Capability-based sidebar nav filtering in
  `apps/web/src/components/layout/Sidebar.tsx` (each item declares a `ModuleKey`).
- `makeAuthUser`/`seedAuthUser` test helpers (`apps/web/src/test/auth-helpers.ts`).

### Changed

- Patients list (`apps/web/src/pages/Patients/index.tsx`, `PatientRow.tsx`) and
  consultation surface (`apps/web/src/pages/Consultation/index.tsx`,
  `PageHeader.tsx`) hide create/edit/delete and sign/amend controls for roles
  with `view` but not `manage`.
```

- [ ] **Step 2: Run the full lint + test gate from the repo root**

Run: `pnpm lint`
Expected: PASS (zero errors).
Run: `pnpm test`
Expected: PASS (zero failing tests).

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: changelog for frontend permission gating"
```

---

## Self-Review

**Spec coverage (contract §Frontend + design §9.2):**
- `useCan(module, level='view')` reading `useAuthStore(s => s.user?.capabilities)` + shared `hasCapability`, false when unauthenticated → Task 1. ✅
- `<RequireCan module level>` redirecting to `/dashboard`, applied to `App.tsx` routes → Task 2. ✅
- Nav filtering: each item declares a `ModuleKey`, hide items lacking `view` → Task 3. ✅
- Read-only modes for patients + consultations (hide create/edit/delete) → Tasks 4–5. ✅
- Tests: `useCan` unit (Task 1), Sidebar assistant-hides-Protocolos/Ajustes (Task 3), RequireCan redirect (Task 2), read-only patients new-patient-absent/present (Task 4); plus consultation read-only (Task 5). Helper seeds `useAuthStore` with a fake `AuthUser` incl. capabilities (`makeAuthUser`/`seedAuthUser`, Task 1). ✅

**Placeholder scan:** No `TBD`/`TODO`/"add error handling"/"similar to Task N" — every code and command step is spelled out. ✅

**Type consistency:** `useCan(module: ModuleKey, level?: AccessLevel): boolean`, `RequireCan` props `{ module, level?, children }`, `PatientRow` gains `canManage: boolean`, `PageHeader` gains `canManage?: boolean` (default `true`), `makeAuthUser(role, overrides?)` / `seedAuthUser(user|null)` — names and signatures are identical everywhere they appear. `hasCapability`/`defaultCapabilitiesFor` imported verbatim from `@rezeta/shared`. Module keys used (`patients`, `consultations`, `protocols`, `appointments`, `billing`, `templates`, `categories`, `locations`, `audit_log`, `schedules_config`) all belong to the contract's `ModuleKey` union. ✅
