import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const m = vi.hoisted(() => {
  const onAuthStateChanged = vi.fn()
  const signInWithEmailAndPassword = vi.fn()
  const createUserWithEmailAndPassword = vi.fn()
  const signOut = vi.fn()
  const getAuth = vi.fn(() => ({ currentUser: null }))
  const initializeApp = vi.fn(() => ({ name: 'mock-app' }))
  const getApps = vi.fn(() => [])
  return {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    getAuth,
    initializeApp,
    getApps,
  }
})

vi.mock('firebase/auth', () => ({
  getAuth: m.getAuth,
  onAuthStateChanged: m.onAuthStateChanged,
  signInWithEmailAndPassword: m.signInWithEmailAndPassword,
  createUserWithEmailAndPassword: m.createUserWithEmailAndPassword,
  signOut: m.signOut,
}))

vi.mock('firebase/app', () => ({
  initializeApp: m.initializeApp,
  getApps: m.getApps,
}))

vi.mock('../../toasts', () => ({
  firebaseErrorToSpanish: vi.fn((code: string) => `mapped:${code}`),
}))

import { FirebaseAuthClient } from '../firebase-auth-client'

describe('FirebaseAuthClient', () => {
  let client: FirebaseAuthClient

  beforeEach(() => {
    vi.clearAllMocks()
    m.getApps.mockReturnValue([])
    m.getAuth.mockReturnValue({ currentUser: null } as never)
    client = new FirebaseAuthClient()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ── init ───────────────────────────────────────────────────────────────────

  describe('module init', () => {
    it('calls initializeApp when no existing app', () => {
      m.getApps.mockReturnValue([])
      m.initializeApp.mockClear()
      new FirebaseAuthClient()
      expect(m.initializeApp).toHaveBeenCalledOnce()
    })

    it('reuses getApps()[0] when already initialized', () => {
      const existing = { name: 'existing' }
      m.getApps.mockReturnValue([existing] as never)
      m.initializeApp.mockClear()
      new FirebaseAuthClient()
      expect(m.initializeApp).not.toHaveBeenCalled()
    })
  })

  // ── onAuthStateChanged ────────────────────────────────────────────────────

  describe('onAuthStateChanged', () => {
    it('subscribes via firebase onAuthStateChanged and returns unsubscribe', () => {
      const cb = vi.fn()
      const unsub = vi.fn()
      m.onAuthStateChanged.mockImplementation((_auth, _cb) => unsub)

      const result = client.onAuthStateChanged(cb)
      expect(m.onAuthStateChanged).toHaveBeenCalledOnce()
      expect(result).toBe(unsub)
    })

    it('forwards user to callback', () => {
      const cb = vi.fn()
      m.onAuthStateChanged.mockImplementation((_auth, fbCb) => {
        fbCb({ uid: 'u1' })
        return vi.fn()
      })
      client.onAuthStateChanged(cb)
      expect(cb).toHaveBeenCalledWith({ uid: 'u1' })
    })

    it('forwards null to callback when signed out', () => {
      const cb = vi.fn()
      m.onAuthStateChanged.mockImplementation((_auth, fbCb) => {
        fbCb(null)
        return vi.fn()
      })
      client.onAuthStateChanged(cb)
      expect(cb).toHaveBeenCalledWith(null)
    })
  })

  // ── getToken ───────────────────────────────────────────────────────────────

  describe('getToken', () => {
    it('returns token when user present', async () => {
      const getIdToken = vi.fn().mockResolvedValue('tok-123')
      m.getAuth.mockReturnValue({ currentUser: { getIdToken } } as never)
      client = new FirebaseAuthClient()
      const result = await client.getToken()
      expect(result).toBe('tok-123')
      expect(getIdToken).toHaveBeenCalled()
    })

    it('returns null when no user', async () => {
      m.getAuth.mockReturnValue({ currentUser: null } as never)
      client = new FirebaseAuthClient()
      const result = await client.getToken()
      expect(result).toBeNull()
    })
  })

  // ── signIn ─────────────────────────────────────────────────────────────────

  describe('signIn', () => {
    it('delegates to firebase signInWithEmailAndPassword', async () => {
      m.signInWithEmailAndPassword.mockResolvedValue({ user: {} })
      await client.signIn('a@b.com', 'pw')
      expect(m.signInWithEmailAndPassword).toHaveBeenCalledWith(expect.anything(), 'a@b.com', 'pw')
    })

    it('propagates errors with code intact', async () => {
      const err = Object.assign(new Error('not found'), { code: 'auth/user-not-found' })
      m.signInWithEmailAndPassword.mockRejectedValue(err)
      await expect(client.signIn('a@b', 'pw')).rejects.toMatchObject({
        code: 'auth/user-not-found',
      })
    })
  })

  // ── signUp ─────────────────────────────────────────────────────────────────

  describe('signUp', () => {
    it('delegates to firebase createUserWithEmailAndPassword', async () => {
      m.createUserWithEmailAndPassword.mockResolvedValue({ user: {} })
      await client.signUp('a@b.com', 'pw')
      expect(m.createUserWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(),
        'a@b.com',
        'pw',
      )
    })

    it('propagates errors with code intact', async () => {
      const err = Object.assign(new Error('exists'), { code: 'auth/email-already-in-use' })
      m.createUserWithEmailAndPassword.mockRejectedValue(err)
      await expect(client.signUp('a@b', 'pw')).rejects.toMatchObject({
        code: 'auth/email-already-in-use',
      })
    })
  })

  // ── signOut ────────────────────────────────────────────────────────────────

  describe('signOut', () => {
    it('delegates to firebase signOut', async () => {
      m.signOut.mockResolvedValue(undefined)
      await client.signOut()
      expect(m.signOut).toHaveBeenCalledOnce()
    })

    it('swallows errors silently', async () => {
      m.signOut.mockRejectedValue(new Error('network down'))
      await expect(client.signOut()).resolves.toBeUndefined()
    })
  })

  // ── errorCodeToMessage ─────────────────────────────────────────────────────

  describe('errorCodeToMessage', () => {
    it('forwards to firebaseErrorToSpanish', () => {
      const result = client.errorCodeToMessage('auth/user-not-found')
      expect(result).toBe('mapped:auth/user-not-found')
    })
  })
})
