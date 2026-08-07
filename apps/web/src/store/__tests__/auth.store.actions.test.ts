import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  signInWithGoogle: vi.fn(),
  signInWithSso: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  authClient: {
    signIn: mocks.signIn,
    signInWithGoogle: mocks.signInWithGoogle,
    signInWithSso: mocks.signInWithSso,
    signOut: mocks.signOut,
    onAuthStateChanged: vi.fn(),
    getToken: vi.fn().mockResolvedValue(null),
    errorCodeToMessage: vi.fn((c: string) => c),
  },
}))

import { useAuthStore } from '@/store/auth.store'

function resetStore() {
  const { result } = renderHook(() => useAuthStore())
  act(() => {
    result.current._setUser(null)
    result.current._setSession(null)
    result.current._setIdentity({ kind: 'loading' })
  })
}

describe('useAuthStore — signIn', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.signIn.mockResolvedValue(undefined)
    resetStore()
  })

  it('delegates to authClient.signIn with credentials', async () => {
    const { result } = renderHook(() => useAuthStore())
    await act(() => result.current.signIn('doc@rezeta.app', 'mypassword'))
    expect(mocks.signIn).toHaveBeenCalledWith('doc@rezeta.app', 'mypassword')
  })

  it('propagates error with code intact', async () => {
    const err = Object.assign(new Error('User not found'), { code: 'auth/user-not-found' })
    mocks.signIn.mockRejectedValue(err)

    const { result } = renderHook(() => useAuthStore())
    await expect(act(() => result.current.signIn('x@x.com', 'p'))).rejects.toThrow('User not found')
  })

  it('propagates generic Error', async () => {
    mocks.signIn.mockRejectedValue(new Error('network failure'))
    const { result } = renderHook(() => useAuthStore())
    await expect(act(() => result.current.signIn('x@x.com', 'p'))).rejects.toThrow(
      'network failure',
    )
  })
})

describe('useAuthStore — signInWithGoogle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.signInWithGoogle.mockResolvedValue(undefined)
    resetStore()
  })

  it('delegates to authClient.signInWithGoogle', async () => {
    const { result } = renderHook(() => useAuthStore())
    await act(() => result.current.signInWithGoogle())
    expect(mocks.signInWithGoogle).toHaveBeenCalledOnce()
  })

  it('propagates error with code intact', async () => {
    const err = Object.assign(new Error('mfa required'), { code: 'auth/multi-factor-auth-required' })
    mocks.signInWithGoogle.mockRejectedValue(err)

    const { result } = renderHook(() => useAuthStore())
    await expect(act(() => result.current.signInWithGoogle())).rejects.toThrow('mfa required')
  })
})

describe('useAuthStore — signInWithSso', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.signInWithSso.mockResolvedValue(undefined)
    resetStore()
  })

  it('delegates to authClient.signInWithSso with the provider id', async () => {
    const { result } = renderHook(() => useAuthStore())
    await act(() => result.current.signInWithSso('oidc.hospital-x1'))
    expect(mocks.signInWithSso).toHaveBeenCalledWith('oidc.hospital-x1')
  })

  it('propagates error with code intact', async () => {
    const err = Object.assign(new Error('mfa required'), { code: 'auth/multi-factor-auth-required' })
    mocks.signInWithSso.mockRejectedValue(err)

    const { result } = renderHook(() => useAuthStore())
    await expect(act(() => result.current.signInWithSso('oidc.hospital-x1'))).rejects.toThrow(
      'mfa required',
    )
  })
})

describe('useAuthStore — signOut', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.signOut.mockResolvedValue(undefined)
    resetStore()
  })

  it('delegates to authClient.signOut', async () => {
    const { result } = renderHook(() => useAuthStore())
    await act(() => result.current.signOut())
    expect(mocks.signOut).toHaveBeenCalled()
  })
})
