import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  authClient: {
    signIn: mocks.signIn,
    signUp: mocks.signUp,
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
    result.current._setStatus('loading')
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

describe('useAuthStore — signUp', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.signUp.mockResolvedValue(undefined)
    resetStore()
  })

  it('delegates to authClient.signUp', async () => {
    const { result } = renderHook(() => useAuthStore())
    await act(() => result.current.signUp('doc@rezeta.app', 'securepass'))
    expect(mocks.signUp).toHaveBeenCalledWith('doc@rezeta.app', 'securepass')
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
