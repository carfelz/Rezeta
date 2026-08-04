import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'

const mocks = vi.hoisted(() => ({ useStaffMe: vi.fn(), signOut: vi.fn() }))
vi.mock('@/hooks/staff/use-staff-me', () => ({ useStaffMe: mocks.useStaffMe }))
vi.mock('@/lib/auth', () => ({ authClient: { signOut: mocks.signOut } }))

import { RequirePlatform } from '../RequirePlatform'

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

describe('RequirePlatform', () => {
  beforeEach(() => {
    mocks.useStaffMe.mockReset()
    mocks.signOut.mockReset()
    // Zustand setState merges, so `session` must be reset explicitly or it
    // leaks between cases — the gate now branches on it.
    useAuthStore.setState({ session: null })
    // Auth store status defaults to 'loading' on module init; most cases below
    // exercise the post-Firebase-resolution behavior, so seed 'authenticated'
    // (any non-'loading' value) unless the test is specifically about the
    // loading gate itself.
    useAuthStore.setState({ status: 'authenticated' })
  })

  it('renders children when the staff-me query succeeds', () => {
    mocks.useStaffMe.mockReturnValue({ data: { id: 'p1' }, isLoading: false, isError: false })
    renderGate()
    expect(screen.getByText('STAFF AREA')).toBeInTheDocument()
  })

  it('redirects to the dashboard when the staff-me query errors (401 for institution users)', () => {
    mocks.useStaffMe.mockReturnValue({ data: undefined, isLoading: false, isError: true })
    renderGate()
    expect(screen.getByText('DASHBOARD')).toBeInTheDocument()
    expect(screen.queryByText('STAFF AREA')).not.toBeInTheDocument()
  })

  it('explains the problem instead of redirecting when a signed-in identity is not a platform user', () => {
    // A PlatformUser whose row is missing/inactive: Firebase session is live
    // (kept by AuthProvider) but there is no institution User row either, so
    // redirecting to /dashboard would bounce off AuthGate straight to /login.
    useAuthStore.setState({ status: 'unauthenticated', session: {} })
    mocks.useStaffMe.mockReturnValue({ data: undefined, isLoading: false, isError: true })
    renderGate()
    expect(screen.getByText('No staff access')).toBeInTheDocument()
    expect(screen.queryByText('DASHBOARD')).not.toBeInTheDocument()
    expect(screen.queryByText('LOGIN')).not.toBeInTheDocument()
    expect(screen.queryByText('STAFF AREA')).not.toBeInTheDocument()
  })

  it('signs out from the no-access screen', () => {
    useAuthStore.setState({ status: 'unauthenticated', session: {} })
    mocks.useStaffMe.mockReturnValue({ data: undefined, isLoading: false, isError: true })
    renderGate()
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(mocks.signOut).toHaveBeenCalledOnce()
  })

  it('redirects to login when nobody is signed in', () => {
    useAuthStore.setState({ status: 'unauthenticated', session: null })
    mocks.useStaffMe.mockReturnValue({ data: undefined, isLoading: false, isError: true })
    renderGate()
    expect(screen.getByText('LOGIN')).toBeInTheDocument()
    expect(screen.queryByText('No staff access')).not.toBeInTheDocument()
  })

  it('renders neither while the staff-me query is loading', () => {
    mocks.useStaffMe.mockReturnValue({ data: undefined, isLoading: true, isError: false })
    renderGate()
    expect(screen.queryByText('STAFF AREA')).not.toBeInTheDocument()
    expect(screen.queryByText('DASHBOARD')).not.toBeInTheDocument()
  })

  it('renders neither while the institution auth store has not resolved Firebase yet (status=loading)', () => {
    useAuthStore.setState({ status: 'loading' })
    mocks.useStaffMe.mockReturnValue({ data: { id: 'p1' }, isLoading: false, isError: false })
    renderGate()
    expect(mocks.useStaffMe).toHaveBeenCalledWith(false)
    expect(screen.queryByText('STAFF AREA')).not.toBeInTheDocument()
    expect(screen.queryByText('DASHBOARD')).not.toBeInTheDocument()
  })

  it('enables the staff-me query once the auth store settles (status=unauthenticated for a platform identity)', () => {
    useAuthStore.setState({ status: 'unauthenticated' })
    mocks.useStaffMe.mockReturnValue({ data: { id: 'p1' }, isLoading: false, isError: false })
    renderGate()
    expect(mocks.useStaffMe).toHaveBeenCalledWith(true)
    expect(screen.getByText('STAFF AREA')).toBeInTheDocument()
  })
})
