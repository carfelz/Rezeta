import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useConsultationViewMode } from '../use-consultation-view-mode'
import { useUiStore } from '@/store/ui.store'
import { useAuthStore } from '@/store/auth.store'
import { apiClient } from '@/lib/api-client'
import type { AuthUser, UserPreferences } from '@rezeta/shared'

const STORAGE_KEY = 'rezeta:consultation-view-mode'

function makeUser(preferences: UserPreferences = {}): AuthUser {
  return {
    id: 'user-1',
    externalUid: 'ext-1',
    tenantId: 'tenant-1',
    email: 'doctor@test',
    fullName: 'Test Doctor',
    role: 'owner',
    specialty: null,
    licenseNumber: null,
    tenantSeededAt: null,
    preferences,
  }
}

describe('useConsultationViewMode', () => {
  beforeEach(() => {
    localStorage.clear()
    act(() => {
      useUiStore.setState({ viewMode: 'soap' })
      useAuthStore.setState({ user: null })
    })
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('returns soap as default mode', () => {
    const { result } = renderHook(() => useConsultationViewMode(true))
    expect(result.current.viewMode).toBe('soap')
  })

  it('reads stored mode from localStorage', () => {
    localStorage.setItem(STORAGE_KEY, 'canvas')
    const { result } = renderHook(() => useConsultationViewMode(true))
    expect(result.current.viewMode).toBe('canvas')
  })

  it('sets viewMode and persists to localStorage', () => {
    const { result } = renderHook(() => useConsultationViewMode(true))
    act(() => {
      result.current.setViewMode('canvas')
    })
    expect(result.current.viewMode).toBe('canvas')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('canvas')
  })

  it('always returns soap when hasProtocol is false', () => {
    localStorage.setItem(STORAGE_KEY, 'canvas')
    act(() => {
      useUiStore.setState({ viewMode: 'canvas' })
    })
    const { result } = renderHook(() => useConsultationViewMode(false))
    expect(result.current.viewMode).toBe('soap')
  })

  it('resets viewMode to soap when hasProtocol becomes false', () => {
    const { result, rerender } = renderHook(
      ({ hasProtocol }) => useConsultationViewMode(hasProtocol),
      { initialProps: { hasProtocol: true } },
    )
    act(() => {
      result.current.setViewMode('canvas')
    })
    expect(result.current.viewMode).toBe('canvas')

    rerender({ hasProtocol: false })
    expect(result.current.viewMode).toBe('soap')
  })

  it('handles missing localStorage gracefully', () => {
    const originalGetItem = localStorage.getItem.bind(localStorage)
    vi.spyOn(localStorage, 'getItem').mockImplementation((key) => {
      if (key === STORAGE_KEY) throw new Error('unavailable')
      return originalGetItem(key)
    })
    expect(() => renderHook(() => useConsultationViewMode(true))).not.toThrow()
    vi.restoreAllMocks()
  })

  it('handles localStorage write error gracefully', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    const { result } = renderHook(() => useConsultationViewMode(true))
    expect(() => {
      act(() => {
        result.current.setViewMode('canvas')
      })
    }).not.toThrow()
    vi.restoreAllMocks()
  })

  it('reconciles to server preference when user has consultationViewMode set', async () => {
    act(() => {
      useAuthStore.setState({ user: makeUser({ consultationViewMode: 'canvas' }) })
    })
    const { result } = renderHook(() => useConsultationViewMode(true))
    await waitFor(() => expect(result.current.viewMode).toBe('canvas'))
    expect(localStorage.getItem(STORAGE_KEY)).toBe('canvas')
  })

  it('PATCH /v1/users/me/preferences when setViewMode is called with a user', () => {
    const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})
    act(() => {
      useAuthStore.setState({ user: makeUser({}) })
    })
    const { result } = renderHook(() => useConsultationViewMode(true))
    act(() => {
      result.current.setViewMode('canvas')
    })
    expect(patchSpy).toHaveBeenCalledWith('/v1/users/me/preferences', {
      consultationViewMode: 'canvas',
    })
    patchSpy.mockRestore()
  })

  it('skips PATCH when no user is set', () => {
    const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({})
    const { result } = renderHook(() => useConsultationViewMode(true))
    act(() => {
      result.current.setViewMode('canvas')
    })
    expect(patchSpy).not.toHaveBeenCalled()
    patchSpy.mockRestore()
  })
})
