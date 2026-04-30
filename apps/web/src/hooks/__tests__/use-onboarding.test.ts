import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

import { apiClient } from '@/lib/api-client'
import { useAuthStore } from '@/store/auth.store'
import {
  useOnboardingStarters,
  useOnboardingDefault,
  useOnboardingCustom,
} from '../onboarding/use-onboarding'

const mockUser = {
  id: 'user-1',
  firebaseUid: 'fb-uid',
  tenantId: 'tenant-1',
  email: 'doctor@rezeta.app',
  fullName: 'Dr. Juan García',
  role: 'owner' as const,
  specialty: 'Cardiología',
  licenseNumber: 'CMP-001',
  tenantSeededAt: '2026-01-01T00:00:00Z',
}

const mockStarters = [
  {
    clientId: 'c-1',
    name: 'Intervención de emergencia',
    typeName: 'Emergencia',
    schema: {},
  },
]

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children)
}

describe('useOnboardingStarters', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fetches starter candidates', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(mockStarters)
    const { result } = renderHook(() => useOnboardingStarters(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.get).toHaveBeenCalledWith('/v1/onboarding/starters')
    expect(result.current.data).toEqual(mockStarters)
  })
})

describe('useOnboardingDefault', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const { result } = renderHook(() => useAuthStore())
    act(() => result.current._setUser(null))
  })

  it('posts to /v1/onboarding/default and updates auth store user', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(mockUser)
    const { result } = renderHook(() => useOnboardingDefault(), { wrapper: makeWrapper() })
    await act(async () => {
      await result.current.mutateAsync()
    })
    expect(apiClient.post).toHaveBeenCalledWith('/v1/onboarding/default', {})

    const { result: storeResult } = renderHook(() => useAuthStore())
    expect(storeResult.current.user).toEqual(mockUser)
  })
})

describe('useOnboardingCustom', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const { result } = renderHook(() => useAuthStore())
    act(() => result.current._setUser(null))
  })

  it('posts to /v1/onboarding/custom with payload and updates auth store', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(mockUser)
    const { result } = renderHook(() => useOnboardingCustom(), { wrapper: makeWrapper() })
    const input = {
      templates: [{ name: 'Emergencia', schema: {} }],
      types: [{ name: 'Emergencia', templateClientId: 'c-1' }],
    }
    await act(async () => {
      await result.current.mutateAsync(input as Parameters<typeof result.current.mutateAsync>[0])
    })
    expect(apiClient.post).toHaveBeenCalledWith('/v1/onboarding/custom', input)

    const { result: storeResult } = renderHook(() => useAuthStore())
    expect(storeResult.current.user).toEqual(mockUser)
  })
})
