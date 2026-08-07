import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { defaultCapabilitiesFor } from '@rezeta/shared'
import { useAuth } from '../use-auth'
import { useAuthStore } from '@/store/auth.store'

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

describe('useAuth', () => {
  beforeEach(() => {
    const { result } = renderHook(() => useAuthStore())
    act(() => {
      result.current._setUser(null)
      result.current._setIdentity({ kind: 'loading' })
    })
  })

  it('returns null user and isLoading=true when identity is loading', () => {
    const { result } = renderHook(() => useAuth())
    expect(result.current.user).toBeNull()
    expect(result.current.isLoading).toBe(true)
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('returns isAuthenticated=true and user for a clinic identity', () => {
    const { result: storeResult } = renderHook(() => useAuthStore())
    act(() => {
      storeResult.current._setUser(mockUser)
      storeResult.current._setIdentity({ kind: 'clinic', user: mockUser })
    })

    const { result } = renderHook(() => useAuth())
    expect(result.current.user).toEqual(mockUser)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('returns isLoading=false and isAuthenticated=false for an anonymous identity', () => {
    const { result: storeResult } = renderHook(() => useAuthStore())
    act(() => {
      storeResult.current._setUser(null)
      storeResult.current._setIdentity({ kind: 'anonymous' })
    })

    const { result } = renderHook(() => useAuth())
    expect(result.current.user).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isAuthenticated).toBe(false)
  })
})
