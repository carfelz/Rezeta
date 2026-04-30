import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useAuthStore } from '@/store/auth.store'

describe('useAuthStore — internal setters', () => {
  beforeEach(() => {
    const { result } = renderHook(() => useAuthStore())
    act(() => {
      result.current._setUser(null)
      result.current._setFirebaseUser(null)
      result.current._setStatus('loading')
    })
  })

  it('initial state has null user and loading status', () => {
    const { result } = renderHook(() => useAuthStore())
    expect(result.current.user).toBeNull()
    expect(result.current.firebaseUser).toBeNull()
    expect(result.current.status).toBe('loading')
  })

  it('_setUser updates user state', () => {
    const { result } = renderHook(() => useAuthStore())
    const mockUser = {
      id: 'user-1',
      firebaseUid: 'fb-uid',
      tenantId: 'tenant-1',
      email: 'doctor@rezeta.app',
      fullName: 'Dr. Juan García',
      role: 'owner' as const,
      specialty: 'Cardiología',
      licenseNumber: 'CMP-001',
      tenantSeededAt: null,
    }
    act(() => result.current._setUser(mockUser))
    expect(result.current.user?.email).toBe('doctor@rezeta.app')
    expect(result.current.user?.role).toBe('owner')
  })

  it('_setUser can clear the user with null', () => {
    const { result } = renderHook(() => useAuthStore())
    act(() => result.current._setUser({ id: 'u', firebaseUid: 'f', tenantId: 't', email: 'e@e.com', fullName: null, role: 'owner', specialty: null, licenseNumber: null, tenantSeededAt: null }))
    act(() => result.current._setUser(null))
    expect(result.current.user).toBeNull()
  })

  it('_setStatus updates auth status', () => {
    const { result } = renderHook(() => useAuthStore())
    act(() => result.current._setStatus('authenticated'))
    expect(result.current.status).toBe('authenticated')
  })

  it('_setStatus can set unauthenticated', () => {
    const { result } = renderHook(() => useAuthStore())
    act(() => result.current._setStatus('unauthenticated'))
    expect(result.current.status).toBe('unauthenticated')
  })

  it('_setFirebaseUser stores firebase user reference', () => {
    const { result } = renderHook(() => useAuthStore())
    const fakeUser = { uid: 'fb-123', email: 'doc@test.com' } as never
    act(() => result.current._setFirebaseUser(fakeUser))
    expect(result.current.firebaseUser).toBe(fakeUser)
  })

  it('status transitions: loading → authenticated → unauthenticated', () => {
    const { result } = renderHook(() => useAuthStore())
    expect(result.current.status).toBe('loading')
    act(() => result.current._setStatus('authenticated'))
    expect(result.current.status).toBe('authenticated')
    act(() => result.current._setStatus('unauthenticated'))
    expect(result.current.status).toBe('unauthenticated')
  })
})
