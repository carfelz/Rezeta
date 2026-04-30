import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAuth } from '../use-auth'
import { useAuthStore } from '@/store/auth.store'

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

describe('useAuth', () => {
  beforeEach(() => {
    const { result } = renderHook(() => useAuthStore())
    act(() => {
      result.current._setUser(null)
      result.current._setStatus('loading')
    })
  })

  it('returns null user and isLoading=true when status is loading', () => {
    const { result } = renderHook(() => useAuth())
    expect(result.current.user).toBeNull()
    expect(result.current.isLoading).toBe(true)
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('returns isAuthenticated=true and user when status is authenticated', () => {
    const { result: storeResult } = renderHook(() => useAuthStore())
    act(() => {
      storeResult.current._setUser(mockUser)
      storeResult.current._setStatus('authenticated')
    })

    const { result } = renderHook(() => useAuth())
    expect(result.current.user).toEqual(mockUser)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('returns isLoading=false and isAuthenticated=false when unauthenticated', () => {
    const { result: storeResult } = renderHook(() => useAuthStore())
    act(() => {
      storeResult.current._setUser(null)
      storeResult.current._setStatus('unauthenticated')
    })

    const { result } = renderHook(() => useAuth())
    expect(result.current.user).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isAuthenticated).toBe(false)
  })
})
