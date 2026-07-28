import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const m = vi.hoisted(() => {
  const onAuthStateChanged = vi.fn()
  const signInWithEmailAndPassword = vi.fn()
  const signOut = vi.fn()
  const verifyPasswordResetCode = vi.fn()
  const confirmPasswordReset = vi.fn()
  const getAuth = vi.fn(() => ({ currentUser: null }))
  const initializeApp = vi.fn(() => ({ name: 'mock-app' }))
  const getApps = vi.fn(() => [])
  const multiFactor = vi.fn()
  const getMultiFactorResolver = vi.fn()
  const generateSecret = vi.fn()
  const assertionForEnrollment = vi.fn()
  const assertionForSignIn = vi.fn()
  return {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
    verifyPasswordResetCode,
    confirmPasswordReset,
    getAuth,
    initializeApp,
    getApps,
    multiFactor,
    getMultiFactorResolver,
    generateSecret,
    assertionForEnrollment,
    assertionForSignIn,
  }
})

vi.mock('firebase/auth', () => ({
  getAuth: m.getAuth,
  onAuthStateChanged: m.onAuthStateChanged,
  signInWithEmailAndPassword: m.signInWithEmailAndPassword,
  signOut: m.signOut,
  verifyPasswordResetCode: m.verifyPasswordResetCode,
  confirmPasswordReset: m.confirmPasswordReset,
  multiFactor: m.multiFactor,
  getMultiFactorResolver: m.getMultiFactorResolver,
  TotpMultiFactorGenerator: {
    FACTOR_ID: 'totp',
    generateSecret: m.generateSecret,
    assertionForEnrollment: m.assertionForEnrollment,
    assertionForSignIn: m.assertionForSignIn,
  },
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

  // ── verifyPasswordResetCode ───────────────────────────────────────────────

  describe('verifyPasswordResetCode', () => {
    it('returns the email for a valid code', async () => {
      m.verifyPasswordResetCode.mockResolvedValue('nurse@clinic.do')
      const email = await client.verifyPasswordResetCode('oob-1')
      expect(m.verifyPasswordResetCode).toHaveBeenCalledWith(expect.anything(), 'oob-1')
      expect(email).toBe('nurse@clinic.do')
    })

    it('propagates errors for an invalid/expired code', async () => {
      m.verifyPasswordResetCode.mockRejectedValue(new Error('expired-action-code'))
      await expect(client.verifyPasswordResetCode('bad')).rejects.toThrow('expired-action-code')
    })
  })

  // ── confirmPasswordReset ──────────────────────────────────────────────────

  describe('confirmPasswordReset', () => {
    it('delegates to firebase confirmPasswordReset', async () => {
      m.confirmPasswordReset.mockResolvedValue(undefined)
      await client.confirmPasswordReset('oob-1', 'NewPass123')
      expect(m.confirmPasswordReset).toHaveBeenCalledWith(expect.anything(), 'oob-1', 'NewPass123')
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

  // ── signIn (MFA branch) ───────────────────────────────────────────────────

  describe('signIn — multi-factor required', () => {
    it('captures the resolver and rethrows the original error', async () => {
      const mfaError = Object.assign(new Error('mfa required'), { code: 'auth/multi-factor-auth-required' })
      m.signInWithEmailAndPassword.mockRejectedValue(mfaError)
      const resolver = { hints: [], resolveSignIn: vi.fn() }
      m.getMultiFactorResolver.mockReturnValue(resolver)
      await expect(client.signIn('a@b.com', 'pw')).rejects.toBe(mfaError)
      expect(m.getMultiFactorResolver).toHaveBeenCalledWith(expect.anything(), mfaError)
    })

    it('does not call getMultiFactorResolver for a non-mfa error', async () => {
      const err = Object.assign(new Error('wrong password'), { code: 'auth/wrong-password' })
      m.signInWithEmailAndPassword.mockRejectedValue(err)
      await expect(client.signIn('a@b.com', 'pw')).rejects.toBe(err)
      expect(m.getMultiFactorResolver).not.toHaveBeenCalled()
    })
  })

  // ── completeTotpSignIn ─────────────────────────────────────────────────────

  describe('completeTotpSignIn', () => {
    it('throws when there is no pending multi-factor sign-in', async () => {
      await expect(client.completeTotpSignIn('123456')).rejects.toThrow(/no pending/i)
    })

    it('resolves sign-in using the TOTP hint and the submitted code', async () => {
      const mfaError = Object.assign(new Error('mfa required'), { code: 'auth/multi-factor-auth-required' })
      m.signInWithEmailAndPassword.mockRejectedValue(mfaError)
      const resolveSignIn = vi.fn().mockResolvedValue(undefined)
      const resolver = { hints: [{ factorId: 'totp', uid: 'enrollment-1' }], resolveSignIn }
      m.getMultiFactorResolver.mockReturnValue(resolver)
      m.assertionForSignIn.mockReturnValue('assertion-1')

      await expect(client.signIn('a@b.com', 'pw')).rejects.toBe(mfaError)
      await client.completeTotpSignIn('123456')

      expect(m.assertionForSignIn).toHaveBeenCalledWith('enrollment-1', '123456')
      expect(resolveSignIn).toHaveBeenCalledWith('assertion-1')
    })

    it('throws when the resolver has no TOTP hint (e.g. SMS-only — deferred, unsupported)', async () => {
      const mfaError = Object.assign(new Error('mfa required'), { code: 'auth/multi-factor-auth-required' })
      m.signInWithEmailAndPassword.mockRejectedValue(mfaError)
      m.getMultiFactorResolver.mockReturnValue({ hints: [{ factorId: 'phone', uid: 'p1' }], resolveSignIn: vi.fn() })

      await expect(client.signIn('a@b.com', 'pw')).rejects.toBe(mfaError)
      await expect(client.completeTotpSignIn('123456')).rejects.toThrow(/no totp factor/i)
    })

    it('cancelTotpSignIn clears the pending resolver (a later completion attempt throws)', async () => {
      const mfaError = Object.assign(new Error('mfa required'), { code: 'auth/multi-factor-auth-required' })
      m.signInWithEmailAndPassword.mockRejectedValue(mfaError)
      const resolveSignIn = vi.fn()
      m.getMultiFactorResolver.mockReturnValue({
        hints: [{ factorId: 'totp', uid: 'enrollment-1' }],
        resolveSignIn,
      })

      await expect(client.signIn('a@b.com', 'pw')).rejects.toBe(mfaError)
      client.cancelTotpSignIn()

      await expect(client.completeTotpSignIn('123456')).rejects.toThrow(/no pending/i)
      expect(resolveSignIn).not.toHaveBeenCalled()
    })

    it('cancelTotpSignIn is a no-op when nothing is pending', () => {
      expect(() => client.cancelTotpSignIn()).not.toThrow()
    })

    it('clears the pending resolver after a successful completion (a second call throws)', async () => {
      const mfaError = Object.assign(new Error('mfa required'), { code: 'auth/multi-factor-auth-required' })
      m.signInWithEmailAndPassword.mockRejectedValue(mfaError)
      const resolveSignIn = vi.fn().mockResolvedValue(undefined)
      m.getMultiFactorResolver.mockReturnValue({
        hints: [{ factorId: 'totp', uid: 'enrollment-1' }],
        resolveSignIn,
      })
      m.assertionForSignIn.mockReturnValue('assertion-1')

      await expect(client.signIn('a@b.com', 'pw')).rejects.toBe(mfaError)
      await client.completeTotpSignIn('123456')
      await expect(client.completeTotpSignIn('654321')).rejects.toThrow(/no pending/i)
    })
  })

  // ── enrollTotp ─────────────────────────────────────────────────────────────

  describe('enrollTotp', () => {
    it('throws when there is no signed-in user', async () => {
      m.getAuth.mockReturnValue({ currentUser: null } as never)
      client = new FirebaseAuthClient()
      await expect(client.enrollTotp()).rejects.toThrow(/no signed-in user/i)
    })

    it('generates a secret and returns the otpauth URL + secret key', async () => {
      const getSession = vi.fn().mockResolvedValue('session-1')
      const user = { email: 'dr@clinic.do', multiFactor: { getSession } }
      m.getAuth.mockReturnValue({ currentUser: user } as never)
      client = new FirebaseAuthClient()
      const generateQrCodeUrl = vi.fn().mockReturnValue('otpauth://totp/Rezeta:dr@clinic.do?secret=ABC')
      m.multiFactor.mockReturnValue({ getSession, enroll: vi.fn() })
      m.generateSecret.mockResolvedValue({ secretKey: 'ABC', generateQrCodeUrl })

      const result = await client.enrollTotp()

      expect(m.generateSecret).toHaveBeenCalledWith('session-1')
      expect(generateQrCodeUrl).toHaveBeenCalledWith('dr@clinic.do', 'Rezeta')
      expect(result.secret).toBe('ABC')
      expect(result.otpauthUrl).toBe('otpauth://totp/Rezeta:dr@clinic.do?secret=ABC')
    })

    it('verify() builds the enrollment assertion and calls multiFactor(user).enroll', async () => {
      const getSession = vi.fn().mockResolvedValue('session-1')
      const user = { email: 'dr@clinic.do', multiFactor: { getSession } }
      m.getAuth.mockReturnValue({ currentUser: user } as never)
      client = new FirebaseAuthClient()
      const enroll = vi.fn().mockResolvedValue(undefined)
      m.multiFactor.mockReturnValue({ getSession, enroll })
      const secret = { secretKey: 'ABC', generateQrCodeUrl: vi.fn().mockReturnValue('otpauth://x') }
      m.generateSecret.mockResolvedValue(secret)
      m.assertionForEnrollment.mockReturnValue('enroll-assertion-1')

      const result = await client.enrollTotp()
      await result.verify('123456')

      expect(m.assertionForEnrollment).toHaveBeenCalledWith(secret, '123456')
      expect(enroll).toHaveBeenCalledWith('enroll-assertion-1', 'Authenticator app')
    })
  })

  // ── unenrollTotp ───────────────────────────────────────────────────────────

  describe('unenrollTotp', () => {
    it('throws when there is no signed-in user', async () => {
      m.getAuth.mockReturnValue({ currentUser: null } as never)
      client = new FirebaseAuthClient()
      await expect(client.unenrollTotp()).rejects.toThrow(/no signed-in user/i)
    })

    it('unenrolls the TOTP factor when one is enrolled', async () => {
      const user = { email: 'dr@clinic.do' }
      m.getAuth.mockReturnValue({ currentUser: user } as never)
      client = new FirebaseAuthClient()
      const unenroll = vi.fn().mockResolvedValue(undefined)
      const totpFactor = { factorId: 'totp', uid: 'f1' }
      m.multiFactor.mockReturnValue({ enrolledFactors: [totpFactor], unenroll })

      await client.unenrollTotp()

      expect(unenroll).toHaveBeenCalledWith(totpFactor)
    })

    it('is a no-op when no TOTP factor is enrolled', async () => {
      const user = { email: 'dr@clinic.do' }
      m.getAuth.mockReturnValue({ currentUser: user } as never)
      client = new FirebaseAuthClient()
      const unenroll = vi.fn()
      m.multiFactor.mockReturnValue({ enrolledFactors: [], unenroll })

      await client.unenrollTotp()

      expect(unenroll).not.toHaveBeenCalled()
    })
  })
})
