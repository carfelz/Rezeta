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
  ApiRequestError: class ApiRequestError extends Error {
    constructor(public readonly error: { code: string; message: string }) {
      super(error.message)
      this.name = 'ApiRequestError'
    }
  },
}))

import { ErrorCode } from '@rezeta/shared'
import { apiClient, ApiRequestError } from '@/lib/api-client'
import { useAuthStore } from '@/store/auth.store'
import {
  useOnboardingStarters,
  useOnboardingDefault,
  useOnboardingCustom,
} from '../onboarding/use-onboarding'

const alreadySeededError = (): Error =>
  new ApiRequestError({
    code: ErrorCode.TENANT_ALREADY_SEEDED,
    message: 'Tenant has already been seeded',
  })

const mockUser = {
  id: 'user-1',
  externalUid: 'fb-uid',
  tenantId: 'tenant-1',
  email: 'doctor@rezeta.app',
  fullName: 'Dr. Juan García',
  role: 'super_admin' as const,
  specialty: 'Cardiología',
  licenseNumber: 'CMP-001',
  tenantSeededAt: '2026-01-01T00:00:00Z',
}

const mockStarters = [
  {
    clientId: 'c-1',
    name: 'Intervención de emergencia',
    categoryName: 'Emergencia',
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

  // A concurrent onboarding request (React StrictMode double-invokes the mount
  // effect in dev; a double-click does it in prod) makes the loser receive
  // TENANT_ALREADY_SEEDED. The tenant *is* seeded, so this is a success.
  it('treats TENANT_ALREADY_SEEDED as success by loading the current user', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(alreadySeededError())
    vi.mocked(apiClient.get).mockResolvedValue(mockUser)

    const { result } = renderHook(() => useOnboardingDefault(), { wrapper: makeWrapper() })
    await act(async () => {
      await result.current.mutateAsync()
    })

    expect(apiClient.get).toHaveBeenCalledWith('/v1/auth/me')
    expect(result.current.isError).toBe(false)

    const { result: storeResult } = renderHook(() => useAuthStore())
    expect(storeResult.current.user).toEqual(mockUser)
  })

  it('still surfaces unrelated failures', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('network down'))

    const { result } = renderHook(() => useOnboardingDefault(), { wrapper: makeWrapper() })
    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toThrow(/network down/)
    })

    expect(apiClient.get).not.toHaveBeenCalled()
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

  it('treats TENANT_ALREADY_SEEDED as success by loading the current user', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(alreadySeededError())
    vi.mocked(apiClient.get).mockResolvedValue(mockUser)

    const { result } = renderHook(() => useOnboardingCustom(), { wrapper: makeWrapper() })
    await act(async () => {
      await result.current.mutateAsync({ templates: [], types: [] } as Parameters<
        typeof result.current.mutateAsync
      >[0])
    })

    expect(apiClient.get).toHaveBeenCalledWith('/v1/auth/me')
    expect(result.current.isError).toBe(false)

    const { result: storeResult } = renderHook(() => useAuthStore())
    expect(storeResult.current.user).toEqual(mockUser)
  })
})
