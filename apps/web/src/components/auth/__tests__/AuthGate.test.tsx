import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useSearchParams } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PlatformPrincipal } from '@rezeta/shared'
import { makeAuthUser } from '@/test/auth-helpers'
import { useAuthStore } from '@/store/auth.store'
import type { Identity } from '@/lib/auth-routing'

const mocks = vi.hoisted(() => ({ signOut: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authClient: { signOut: mocks.signOut } }))

import { AuthGate } from '../AuthGate'

const platformPrincipal: PlatformPrincipal = {
  id: 'platform-user-1',
  externalUid: 'fb-uid-platform',
  email: 'staffer@rezeta.app',
  fullName: 'Staff Person',
}

/** Reads the ?redirectTo= the gate stamped, so tests can assert its exact value. */
function LoginProbe(): JSX.Element {
  const [searchParams] = useSearchParams()
  return <div>LOGIN redirectTo={searchParams.get('redirectTo') ?? '(none)'}</div>
}

function renderGate(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/dashboard"
          element={
            <AuthGate>
              <div>DASHBOARD CONTENT</div>
            </AuthGate>
          }
        />
        <Route
          path="/bienvenido"
          element={
            <AuthGate>
              <div>ONBOARDING CONTENT</div>
            </AuthGate>
          }
        />
        <Route path="/login" element={<LoginProbe />} />
        <Route path="/staff/institutions" element={<div>STAFF INSTITUTIONS</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

/**
 * AuthGate reads `user` from a separate store field, not `identity.user` (the
 * same split AuthProvider maintains via `_setUser` vs `_setIdentity`) — so a
 * clinic identity's `tenantSeededAt` must be seeded onto `user` too.
 */
function setIdentity(identity: Identity): void {
  useAuthStore.setState({
    identity,
    user: identity.kind === 'clinic' ? identity.user : null,
  })
}

describe('AuthGate', () => {
  beforeEach(() => {
    mocks.signOut.mockReset()
    setIdentity({ kind: 'loading' })
  })

  it('shows the loading spinner while identity is loading', () => {
    setIdentity({ kind: 'loading' })
    renderGate('/dashboard')
    expect(screen.getByText('Cargando...')).toBeInTheDocument()
    expect(screen.queryByText('DASHBOARD CONTENT')).not.toBeInTheDocument()
  })

  it('renders children for a clinic identity whose tenant is already seeded', () => {
    setIdentity({ kind: 'clinic', user: makeAuthUser('doctor') })
    renderGate('/dashboard')
    expect(screen.getByText('DASHBOARD CONTENT')).toBeInTheDocument()
  })

  it('redirects a clinic identity with an unseeded tenant to /bienvenido', () => {
    setIdentity({ kind: 'clinic', user: makeAuthUser('doctor', { tenantSeededAt: null }) })
    renderGate('/dashboard')
    expect(screen.getByText('ONBOARDING CONTENT')).toBeInTheDocument()
    expect(screen.queryByText('DASHBOARD CONTENT')).not.toBeInTheDocument()
  })

  it('renders onboarding children directly for an unseeded tenant already under /bienvenido (no redirect loop)', () => {
    setIdentity({ kind: 'clinic', user: makeAuthUser('doctor', { tenantSeededAt: null }) })
    renderGate('/bienvenido')
    expect(screen.getByText('ONBOARDING CONTENT')).toBeInTheDocument()
  })

  it('redirects an anonymous visitor to /login carrying the original path as ?redirectTo=', () => {
    setIdentity({ kind: 'anonymous' })
    renderGate('/dashboard')
    expect(screen.getByText('LOGIN redirectTo=/dashboard')).toBeInTheDocument()
  })

  it('preserves the query string in the stamped ?redirectTo=', () => {
    setIdentity({ kind: 'anonymous' })
    renderGate('/dashboard?tab=hoy')
    expect(screen.getByText('LOGIN redirectTo=/dashboard?tab=hoy')).toBeInTheDocument()
  })

  it('sends a staff identity straight to /staff/institutions (not through /login)', () => {
    setIdentity({ kind: 'staff', principal: platformPrincipal })
    renderGate('/dashboard')
    expect(screen.getByText('STAFF INSTITUTIONS')).toBeInTheDocument()
    expect(screen.queryByText(/^LOGIN/)).not.toBeInTheDocument()
  })

  it('explains the lack of access instead of a blank screen when the session is unprovisioned', () => {
    // A live session that resolved to neither a clinic user nor a platform
    // principal (e.g. a soft-deleted or failed-provisioning account). A blank
    // screen here leaves a real doctor stuck with no explanation and no way
    // out — resolveDestination's contract requires an explanation, not a
    // fallback navigation (see auth-routing.ts).
    setIdentity({ kind: 'unprovisioned' })
    renderGate('/dashboard')
    expect(screen.getByText('Sin acceso')).toBeInTheDocument()
    expect(screen.queryByText('DASHBOARD CONTENT')).not.toBeInTheDocument()
    expect(screen.queryByText(/^LOGIN/)).not.toBeInTheDocument()
    expect(screen.queryByText('STAFF INSTITUTIONS')).not.toBeInTheDocument()
    expect(screen.queryByText('Cargando...')).not.toBeInTheDocument()
  })

  it('signs out from the no-access screen', () => {
    setIdentity({ kind: 'unprovisioned' })
    renderGate('/dashboard')
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    expect(mocks.signOut).toHaveBeenCalledOnce()
  })
})
