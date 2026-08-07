import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, beforeEach } from 'vitest'
import type { PlatformPrincipal } from '@rezeta/shared'
import { makeAuthUser } from '@/test/auth-helpers'
import { useAuthStore } from '@/store/auth.store'
import type { Identity } from '@/lib/auth-routing'
import { PublicOnlyGate } from '../PublicOnlyGate'

const platformPrincipal: PlatformPrincipal = {
  id: 'platform-user-1',
  externalUid: 'fb-uid-platform',
  email: 'staffer@rezeta.app',
  fullName: 'Staff Person',
}

function renderGate(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicOnlyGate>
              <div>LOGIN FORM</div>
            </PublicOnlyGate>
          }
        />
        <Route path="/dashboard" element={<div>DASHBOARD</div>} />
        <Route path="/agenda" element={<div>AGENDA</div>} />
        <Route path="/staff/institutions" element={<div>STAFF INSTITUTIONS</div>} />
        <Route path="/staff/security" element={<div>STAFF SECURITY</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

/** Point window.location.hostname at a given host for the duration of a test. */
function withHostname(hostname: string, run: () => void): void {
  const original = window.location
  Object.defineProperty(window, 'location', {
    value: { ...original, hostname },
    writable: true,
    configurable: true,
  })
  try {
    run()
  } finally {
    Object.defineProperty(window, 'location', {
      value: original,
      writable: true,
      configurable: true,
    })
  }
}

function setIdentity(identity: Identity): void {
  useAuthStore.setState({ identity })
}

describe('PublicOnlyGate', () => {
  beforeEach(() => {
    setIdentity({ kind: 'loading' })
  })

  it('shows the loading spinner while identity is loading', () => {
    setIdentity({ kind: 'loading' })
    renderGate('/login')
    expect(screen.getByText('Cargando...')).toBeInTheDocument()
    expect(screen.queryByText('LOGIN FORM')).not.toBeInTheDocument()
    expect(screen.queryByText('DASHBOARD')).not.toBeInTheDocument()
  })

  it('renders children when nobody is signed in', () => {
    setIdentity({ kind: 'anonymous' })
    renderGate('/login')
    expect(screen.getByText('LOGIN FORM')).toBeInTheDocument()
  })

  it('renders children (never navigates) when the session is unprovisioned', () => {
    // resolveDestination returns null for 'unprovisioned' by design — the
    // caller must render rather than fall back to a default path.
    setIdentity({ kind: 'unprovisioned' })
    renderGate('/login')
    expect(screen.getByText('LOGIN FORM')).toBeInTheDocument()
  })

  it('redirects a clinic identity to /dashboard by default', () => {
    withHostname('app-dev.rezeta.co', () => {
      setIdentity({ kind: 'clinic', user: makeAuthUser('doctor') })
      renderGate('/login')
      expect(screen.getByText('DASHBOARD')).toBeInTheDocument()
      expect(screen.queryByText('LOGIN FORM')).not.toBeInTheDocument()
    })
  })

  it('redirects a clinic identity to a safe same-app ?redirectTo= when present', () => {
    withHostname('app-dev.rezeta.co', () => {
      setIdentity({ kind: 'clinic', user: makeAuthUser('doctor') })
      renderGate('/login?redirectTo=%2Fagenda')
      expect(screen.getByText('AGENDA')).toBeInTheDocument()
    })
  })

  it('falls back to /dashboard for a clinic identity when ?redirectTo= belongs to the staff app', () => {
    withHostname('app-dev.rezeta.co', () => {
      setIdentity({ kind: 'clinic', user: makeAuthUser('doctor') })
      renderGate('/login?redirectTo=%2Fstaff%2Finstitutions')
      expect(screen.getByText('DASHBOARD')).toBeInTheDocument()
    })
  })

  it('redirects a staff identity to /staff/institutions by default', () => {
    withHostname('staff-dev.rezeta.co', () => {
      setIdentity({ kind: 'staff', principal: platformPrincipal })
      renderGate('/login')
      expect(screen.getByText('STAFF INSTITUTIONS')).toBeInTheDocument()
    })
  })

  it('honours ?redirectTo=/staff/security for a staff identity on a staff host', () => {
    withHostname('staff-dev.rezeta.co', () => {
      setIdentity({ kind: 'staff', principal: platformPrincipal })
      renderGate('/login?redirectTo=%2Fstaff%2Fsecurity')
      expect(screen.getByText('STAFF SECURITY')).toBeInTheDocument()
    })
  })

  it('ignores a doctor-app ?redirectTo= for a staff identity on a staff host', () => {
    // AuthGate stamps ?redirectTo=%2Fdashboard when it bounces a staff
    // identity off a doctor-app route; honouring it here would walk straight
    // back into the login loop this refactor exists to remove.
    withHostname('staff-dev.rezeta.co', () => {
      setIdentity({ kind: 'staff', principal: platformPrincipal })
      renderGate('/login?redirectTo=%2Fdashboard')
      expect(screen.getByText('STAFF INSTITUTIONS')).toBeInTheDocument()
    })
  })
})
