import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { defaultCapabilitiesFor } from '@rezeta/shared'
import { useAuthStore } from '@/store/auth.store'

describe('useAuthStore — internal setters', () => {
  beforeEach(() => {
    const { result } = renderHook(() => useAuthStore())
    act(() => {
      result.current._setUser(null)
      result.current._setSession(null)
      result.current._setIdentity({ kind: 'loading' })
    })
  })

  it('initial state has null user and loading identity', () => {
    const { result } = renderHook(() => useAuthStore())
    expect(result.current.user).toBeNull()
    expect(result.current.session).toBeNull()
    expect(result.current.identity).toEqual({ kind: 'loading' })
  })

  it('_setUser updates user state', () => {
    const { result } = renderHook(() => useAuthStore())
    const mockUser = {
      id: 'user-1',
      identityId: 'fb-uid',
      tenantId: 'tenant-1',
      email: 'doctor@rezeta.app',
      fullName: 'Dr. Juan García',
      role: 'super_admin' as const,
      specialty: 'Cardiología',
      licenseNumber: 'CMP-001',
      tenantSeededAt: null,
      preferences: {},
      capabilities: defaultCapabilitiesFor('super_admin'),
    }
    act(() => result.current._setUser(mockUser))
    expect(result.current.user?.email).toBe('doctor@rezeta.app')
    expect(result.current.user?.role).toBe('super_admin')
  })

  it('_setUser refreshes identity.user when identity is clinic', () => {
    // Regression: onboarding completion (use-onboarding.ts) calls _setUser
    // with a freshly-seeded tenant, never _setIdentity. AuthGate reads
    // identity.user, not the store's separate user field — if _setUser
    // doesn't also refresh identity.user, AuthGate keeps seeing the stale
    // (pre-onboarding) tenantSeededAt and loops the doctor back to
    // /bienvenido forever. See AuthGate.test.tsx for the end-to-end version.
    const { result } = renderHook(() => useAuthStore())
    const seededUser = {
      id: 'u',
      identityId: 'f',
      tenantId: 't',
      email: 'e@e.com',
      fullName: null,
      role: 'super_admin' as const,
      specialty: null,
      licenseNumber: null,
      tenantSeededAt: null,
      preferences: {},
      capabilities: defaultCapabilitiesFor('super_admin'),
    }
    act(() => result.current._setIdentity({ kind: 'clinic', user: seededUser }))

    const onboardedUser = { ...seededUser, tenantSeededAt: '2026-08-04T00:00:00Z' }
    act(() => result.current._setUser(onboardedUser))

    expect(result.current.user).toEqual(onboardedUser)
    expect(result.current.identity).toEqual({ kind: 'clinic', user: onboardedUser })
  })

  it('_setUser leaves a non-clinic identity untouched', () => {
    const { result } = renderHook(() => useAuthStore())
    act(() => result.current._setIdentity({ kind: 'anonymous' }))

    const user = {
      id: 'u',
      identityId: 'f',
      tenantId: 't',
      email: 'e@e.com',
      fullName: null,
      role: 'super_admin' as const,
      specialty: null,
      licenseNumber: null,
      tenantSeededAt: null,
      preferences: {},
      capabilities: defaultCapabilitiesFor('super_admin'),
    }
    act(() => result.current._setUser(user))

    expect(result.current.identity).toEqual({ kind: 'anonymous' })
  })

  it('_setUser can clear the user with null', () => {
    const { result } = renderHook(() => useAuthStore())
    act(() =>
      result.current._setUser({
        id: 'u',
        identityId: 'f',
        tenantId: 't',
        email: 'e@e.com',
        fullName: null,
        role: 'super_admin',
        specialty: null,
        licenseNumber: null,
        tenantSeededAt: null,
        preferences: {},
        capabilities: defaultCapabilitiesFor('super_admin'),
      }),
    )
    act(() => result.current._setUser(null))
    expect(result.current.user).toBeNull()
  })

  it('_setSession stores session reference', () => {
    const { result } = renderHook(() => useAuthStore())
    const fakeSession = { uid: 'fb-123', email: 'doc@test.com' }
    act(() => result.current._setSession(fakeSession))
    expect(result.current.session).toBe(fakeSession)
  })

  it('_setIdentity transitions: loading → clinic → anonymous', () => {
    const { result } = renderHook(() => useAuthStore())
    const user = {
      id: 'u',
      identityId: 'f',
      tenantId: 't',
      email: 'e@e.com',
      fullName: null,
      role: 'super_admin' as const,
      specialty: null,
      licenseNumber: null,
      tenantSeededAt: null,
      preferences: {},
      capabilities: defaultCapabilitiesFor('super_admin'),
    }
    expect(result.current.identity).toEqual({ kind: 'loading' })
    act(() => result.current._setIdentity({ kind: 'clinic', user }))
    expect(result.current.identity).toEqual({ kind: 'clinic', user })
    act(() => result.current._setIdentity({ kind: 'anonymous' }))
    expect(result.current.identity).toEqual({ kind: 'anonymous' })
  })

  it('setPreferences updates preferences when user exists', () => {
    const { result } = renderHook(() => useAuthStore())
    act(() =>
      result.current._setUser({
        id: 'u',
        identityId: 'f',
        tenantId: 't',
        email: 'e@e.com',
        fullName: null,
        role: 'super_admin',
        specialty: null,
        licenseNumber: null,
        tenantSeededAt: null,
        preferences: {},
        capabilities: defaultCapabilitiesFor('super_admin'),
      }),
    )
    act(() => result.current.setPreferences({ consultationViewMode: 'canvas' }))
    expect(result.current.user?.preferences.consultationViewMode).toBe('canvas')
  })

  it('setPreferences is a no-op when user is null', () => {
    const { result } = renderHook(() => useAuthStore())
    act(() => result.current._setUser(null))
    act(() => result.current.setPreferences({ consultationViewMode: 'canvas' }))
    expect(result.current.user).toBeNull()
  })

  it('setUser replaces the cached user in state', () => {
    const { result } = renderHook(() => useAuthStore())
    const user = {
      id: 'u2',
      identityId: 'f2',
      tenantId: 't2',
      email: 'new@rezeta.app',
      fullName: 'Dr. New',
      role: 'super_admin' as const,
      specialty: 'Neurología',
      licenseNumber: null,
      tenantSeededAt: null,
      preferences: {},
      capabilities: defaultCapabilitiesFor('super_admin'),
    }
    act(() => result.current.setUser(user))
    expect(result.current.user?.email).toBe('new@rezeta.app')
    expect(result.current.user?.specialty).toBe('Neurología')
  })

  it('setUser refreshes identity.user when identity is clinic', () => {
    const { result } = renderHook(() => useAuthStore())
    const originalUser = {
      id: 'u2',
      identityId: 'f2',
      tenantId: 't2',
      email: 'doc@rezeta.app',
      fullName: 'Dr. Original',
      role: 'super_admin' as const,
      specialty: null,
      licenseNumber: null,
      tenantSeededAt: '2026-01-01T00:00:00Z',
      preferences: {},
      capabilities: defaultCapabilitiesFor('super_admin'),
    }
    act(() => result.current._setIdentity({ kind: 'clinic', user: originalUser }))

    const updatedUser = { ...originalUser, fullName: 'Dr. Updated' }
    act(() => result.current.setUser(updatedUser))

    expect(result.current.identity).toEqual({ kind: 'clinic', user: updatedUser })
  })
})
