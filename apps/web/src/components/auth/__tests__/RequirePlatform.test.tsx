import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import type { PlatformPrincipal } from '@rezeta/shared'
import { makeAuthUser } from '@/test/auth-helpers'
import { useAuthStore } from '@/store/auth.store'
import type { Identity } from '@/lib/auth-routing'

const mocks = vi.hoisted(() => ({ signOut: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authClient: { signOut: mocks.signOut } }))

import { RequirePlatform } from '../RequirePlatform'

const platformPrincipal: PlatformPrincipal = {
  id: 'platform-user-1',
  externalUid: 'fb-uid-platform',
  email: 'staffer@rezeta.app',
  fullName: 'Staff Person',
}

function renderGate() {
  return render(
    <MemoryRouter initialEntries={['/staff']}>
      <Routes>
        <Route
          path="/staff"
          element={
            <RequirePlatform>
              <div>STAFF AREA</div>
            </RequirePlatform>
          }
        />
        <Route path="/dashboard" element={<div>DASHBOARD</div>} />
        <Route path="/login" element={<div>LOGIN</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

function setIdentity(identity: Identity): void {
  useAuthStore.setState({ identity })
}

describe('RequirePlatform', () => {
  beforeEach(() => {
    mocks.signOut.mockReset()
    setIdentity({ kind: 'loading' })
  })

  it('renders children when identity is staff', () => {
    setIdentity({ kind: 'staff', principal: platformPrincipal })
    renderGate()
    expect(screen.getByText('STAFF AREA')).toBeInTheDocument()
  })

  it('redirects a clinic identity to /dashboard (an institution user browsing to /staff)', () => {
    setIdentity({ kind: 'clinic', user: makeAuthUser('doctor') })
    renderGate()
    expect(screen.getByText('DASHBOARD')).toBeInTheDocument()
    expect(screen.queryByText('STAFF AREA')).not.toBeInTheDocument()
  })

  it('renders the no-access screen instead of redirecting when identity is unprovisioned', () => {
    // A live session that is neither a platform principal nor an institution
    // user. Redirecting from here is exactly what produced the old login
    // loop, so this must render an explanation instead of navigating.
    setIdentity({ kind: 'unprovisioned' })
    renderGate()
    expect(screen.getByText('No staff access')).toBeInTheDocument()
    expect(screen.queryByText('DASHBOARD')).not.toBeInTheDocument()
    expect(screen.queryByText('LOGIN')).not.toBeInTheDocument()
    expect(screen.queryByText('STAFF AREA')).not.toBeInTheDocument()
  })

  it('signs out from the no-access screen', () => {
    setIdentity({ kind: 'unprovisioned' })
    renderGate()
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(mocks.signOut).toHaveBeenCalledOnce()
  })

  it('redirects to /login when nobody is signed in', () => {
    setIdentity({ kind: 'anonymous' })
    renderGate()
    expect(screen.getByText('LOGIN')).toBeInTheDocument()
    expect(screen.queryByText('No staff access')).not.toBeInTheDocument()
  })

  it('renders nothing while identity has not resolved yet', () => {
    setIdentity({ kind: 'loading' })
    renderGate()
    expect(screen.queryByText('STAFF AREA')).not.toBeInTheDocument()
    expect(screen.queryByText('DASHBOARD')).not.toBeInTheDocument()
    expect(screen.queryByText('LOGIN')).not.toBeInTheDocument()
    expect(screen.queryByText('No staff access')).not.toBeInTheDocument()
  })
})
