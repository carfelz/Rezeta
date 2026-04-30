import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  firebaseAuth: { currentUser: null } as any,
}))

vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: mocks.signInWithEmailAndPassword,
  createUserWithEmailAndPassword: mocks.createUserWithEmailAndPassword,
  signOut: mocks.signOut,
}))

vi.mock('@/lib/firebase', () => ({
  get auth() {
    return mocks.firebaseAuth
  },
}))

import { useAuthStore } from '@/store/auth.store'

function resetStore() {
  const { result } = renderHook(() => useAuthStore())
  act(() => {
    result.current._setUser(null)
    result.current._setFirebaseUser(null)
    result.current._setStatus('loading')
  })
}

describe('useAuthStore — signIn', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.firebaseAuth = { currentUser: null }
    mocks.signInWithEmailAndPassword.mockResolvedValue({ user: {} })
    resetStore()
  })

  it('throws when Firebase not configured (auth=null)', async () => {
    mocks.firebaseAuth = null
    const { result } = renderHook(() => useAuthStore())
    await expect(act(() => result.current.signIn('e@e.com', 'pass'))).rejects.toThrow(
      'Firebase not configured',
    )
  })

  it('calls signInWithEmailAndPassword with credentials', async () => {
    const { result } = renderHook(() => useAuthStore())
    await act(() => result.current.signIn('doc@rezeta.app', 'mypassword'))
    expect(mocks.signInWithEmailAndPassword).toHaveBeenCalledWith(
      mocks.firebaseAuth,
      'doc@rezeta.app',
      'mypassword',
    )
  })

  it('re-throws FirebaseError message', async () => {
    const { FirebaseError } = await import('firebase/app')
    const firebaseErr = new FirebaseError('auth/user-not-found', 'User not found')
    mocks.signInWithEmailAndPassword.mockRejectedValue(firebaseErr)

    const { result } = renderHook(() => useAuthStore())
    await expect(act(() => result.current.signIn('x@x.com', 'p'))).rejects.toThrow('User not found')
  })

  it('re-throws generic Error message', async () => {
    mocks.signInWithEmailAndPassword.mockRejectedValue(new Error('network failure'))
    const { result } = renderHook(() => useAuthStore())
    await expect(act(() => result.current.signIn('x@x.com', 'p'))).rejects.toThrow(
      'network failure',
    )
  })

  it('throws Unknown error for non-Error rejections', async () => {
    mocks.signInWithEmailAndPassword.mockRejectedValue('string error')
    const { result } = renderHook(() => useAuthStore())
    await expect(act(() => result.current.signIn('x@x.com', 'p'))).rejects.toThrow('Unknown error')
  })
})

describe('useAuthStore — signUp', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.firebaseAuth = { currentUser: null }
    mocks.createUserWithEmailAndPassword.mockResolvedValue({ user: {} })
    resetStore()
  })

  it('throws when Firebase not configured', async () => {
    mocks.firebaseAuth = null
    const { result } = renderHook(() => useAuthStore())
    await expect(act(() => result.current.signUp('e@e.com', 'pass'))).rejects.toThrow(
      'Firebase not configured',
    )
  })

  it('calls createUserWithEmailAndPassword', async () => {
    const { result } = renderHook(() => useAuthStore())
    await act(() => result.current.signUp('doc@rezeta.app', 'securepass'))
    expect(mocks.createUserWithEmailAndPassword).toHaveBeenCalledWith(
      mocks.firebaseAuth,
      'doc@rezeta.app',
      'securepass',
    )
  })
})

describe('useAuthStore — signOut', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.firebaseAuth = { currentUser: null }
    mocks.signOut.mockResolvedValue(undefined)
    resetStore()
  })

  it('sets unauthenticated state when auth is null', async () => {
    mocks.firebaseAuth = null
    const { result } = renderHook(() => useAuthStore())
    act(() => result.current._setStatus('authenticated'))
    await act(() => result.current.signOut())

    expect(result.current.status).toBe('unauthenticated')
    expect(result.current.user).toBeNull()
    expect(result.current.firebaseUser).toBeNull()
  })

  it('calls Firebase signOut when auth is configured', async () => {
    const { result } = renderHook(() => useAuthStore())
    await act(() => result.current.signOut())
    expect(mocks.signOut).toHaveBeenCalled()
  })
})
