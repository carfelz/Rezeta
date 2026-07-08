import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { UnauthorizedException, InternalServerErrorException, Logger } from '@nestjs/common'

// Mock firebase-admin BEFORE importing the provider
const m = vi.hoisted(() => {
  const mockVerifyIdToken = vi.fn()
  const mockRevokeRefreshTokens = vi.fn()
  const mockDeleteUser = vi.fn()
  const mockAuth = vi.fn(() => ({
    verifyIdToken: mockVerifyIdToken,
    revokeRefreshTokens: mockRevokeRefreshTokens,
    deleteUser: mockDeleteUser,
  }))
  const mockInitializeApp = vi.fn()
  const mockCert = vi.fn((c: unknown) => c)
  const mockApps: unknown[] = []
  return {
    mockVerifyIdToken,
    mockRevokeRefreshTokens,
    mockDeleteUser,
    mockAuth,
    mockInitializeApp,
    mockCert,
    mockApps,
  }
})

vi.mock('firebase-admin', () => ({
  apps: m.mockApps,
  initializeApp: (...args: unknown[]) => {
    const app = { auth: m.mockAuth, ...((args[0] as object) ?? {}) }
    m.mockInitializeApp(...args)
    return app
  },
  credential: { cert: m.mockCert },
}))

const {
  mockVerifyIdToken,
  mockRevokeRefreshTokens,
  mockDeleteUser,
  mockInitializeApp,
  mockCert,
  mockApps,
} = m

import { FirebaseAuthProvider } from '../firebase-auth.provider.js'

function makeConfig(opts: {
  projectId?: string
  clientEmail?: string
  privateKey?: string
  webApiKey?: string
}) {
  return {
    get: vi.fn((key: string) => {
      if (key === 'firebase') {
        return {
          projectId: opts.projectId ?? '',
          clientEmail: opts.clientEmail ?? '',
          privateKey: opts.privateKey ?? '',
          webApiKey: opts.webApiKey ?? '',
        }
      }
      return undefined
    }),
  }
}

describe('FirebaseAuthProvider', () => {
  let provider: FirebaseAuthProvider

  beforeEach(() => {
    vi.clearAllMocks()
    mockApps.length = 0
    delete process.env['FIREBASE_ADMIN_KEY']
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {})
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {})
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {})
    vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  // ── onModuleInit ───────────────────────────────────────────────────────────

  describe('onModuleInit', () => {
    it('initializes app from explicit config', () => {
      provider = new FirebaseAuthProvider(
        makeConfig({ projectId: 'p', clientEmail: 'c@x.com', privateKey: 'k' }) as never,
      )
      provider.onModuleInit()
      expect(mockInitializeApp).toHaveBeenCalledOnce()
    })

    it('replaces escaped \\n in privateKey', () => {
      provider = new FirebaseAuthProvider(
        makeConfig({
          projectId: 'p',
          clientEmail: 'c@x.com',
          privateKey: 'line1\\nline2',
        }) as never,
      )
      provider.onModuleInit()
      const arg = mockCert.mock.calls[0]?.[0] as { privateKey: string }
      expect(arg.privateKey).toBe('line1\nline2')
    })

    it('reuses admin.apps[0] when already initialized', () => {
      mockApps.push({ auth: m.mockAuth })
      provider = new FirebaseAuthProvider(makeConfig({}) as never)
      provider.onModuleInit()
      expect(mockInitializeApp).not.toHaveBeenCalled()
    })

    it('warns and skips init when credentials missing', () => {
      const warnSpy = vi.spyOn(Logger.prototype, 'warn')
      provider = new FirebaseAuthProvider(makeConfig({}) as never)
      provider.onModuleInit()
      expect(warnSpy).toHaveBeenCalled()
      expect(mockInitializeApp).not.toHaveBeenCalled()
    })

    it('parses FIREBASE_ADMIN_KEY JSON blob fallback', () => {
      process.env['FIREBASE_ADMIN_KEY'] = JSON.stringify({
        project_id: 'jp',
        client_email: 'jc@x.com',
        private_key: 'jk',
      })
      provider = new FirebaseAuthProvider(makeConfig({}) as never)
      provider.onModuleInit()
      expect(mockInitializeApp).toHaveBeenCalledOnce()
    })

    it('logs error on malformed FIREBASE_ADMIN_KEY JSON', () => {
      process.env['FIREBASE_ADMIN_KEY'] = '{not-json'
      const errSpy = vi.spyOn(Logger.prototype, 'error')
      provider = new FirebaseAuthProvider(makeConfig({}) as never)
      provider.onModuleInit()
      expect(errSpy).toHaveBeenCalled()
      expect(mockInitializeApp).not.toHaveBeenCalled()
    })

    it('falls through to warn when FIREBASE_ADMIN_KEY JSON has empty fields', () => {
      process.env['FIREBASE_ADMIN_KEY'] = JSON.stringify({})
      const warnSpy = vi.spyOn(Logger.prototype, 'warn')
      provider = new FirebaseAuthProvider(makeConfig({}) as never)
      provider.onModuleInit()
      expect(warnSpy).toHaveBeenCalled()
      expect(mockInitializeApp).not.toHaveBeenCalled()
    })

    it('uses explicit creds even when FIREBASE_ADMIN_KEY also present', () => {
      process.env['FIREBASE_ADMIN_KEY'] = JSON.stringify({
        project_id: 'fallback',
        client_email: 'fallback@x',
        private_key: 'fallback-key',
      })
      provider = new FirebaseAuthProvider(
        makeConfig({ projectId: 'p', clientEmail: 'c@x.com', privateKey: 'k' }) as never,
      )
      provider.onModuleInit()
      const arg = mockCert.mock.calls[0]?.[0] as { projectId: string }
      expect(arg.projectId).toBe('p')
    })
  })

  // ── verifyToken ────────────────────────────────────────────────────────────

  describe('verifyToken', () => {
    it('throws InternalServerError when app not initialized', async () => {
      provider = new FirebaseAuthProvider(makeConfig({}) as never)
      // skip onModuleInit → app stays null
      await expect(provider.verifyToken('tok')).rejects.toThrow(InternalServerErrorException)
    })

    it('returns VerifiedToken on success', async () => {
      provider = new FirebaseAuthProvider(
        makeConfig({ projectId: 'p', clientEmail: 'c', privateKey: 'k' }) as never,
      )
      provider.onModuleInit()
      mockVerifyIdToken.mockResolvedValue({ uid: 'fb-1', email: 'doc@test.com', extra: 'claim' })
      const result = await provider.verifyToken('tok')
      expect(result.externalUid).toBe('fb-1')
      expect(result.email).toBe('doc@test.com')
      expect(result.rawClaims).toMatchObject({ uid: 'fb-1' })
    })

    it('defaults email to empty string when missing', async () => {
      provider = new FirebaseAuthProvider(
        makeConfig({ projectId: 'p', clientEmail: 'c', privateKey: 'k' }) as never,
      )
      provider.onModuleInit()
      mockVerifyIdToken.mockResolvedValue({ uid: 'fb-1' })
      const result = await provider.verifyToken('tok')
      expect(result.email).toBe('')
    })

    it('throws UnauthorizedException on Firebase error', async () => {
      provider = new FirebaseAuthProvider(
        makeConfig({ projectId: 'p', clientEmail: 'c', privateKey: 'k' }) as never,
      )
      provider.onModuleInit()
      mockVerifyIdToken.mockRejectedValue(new Error('expired'))
      await expect(provider.verifyToken('tok')).rejects.toThrow(UnauthorizedException)
    })
  })

  // ── signInWithPassword ─────────────────────────────────────────────────────

  describe('signInWithPassword', () => {
    it('throws InternalServerError when webApiKey missing', async () => {
      provider = new FirebaseAuthProvider(makeConfig({}) as never)
      await expect(provider.signInWithPassword('a@b', 'p')).rejects.toThrow(
        InternalServerErrorException,
      )
    })

    it('returns SignedInToken on success', async () => {
      provider = new FirebaseAuthProvider(makeConfig({ webApiKey: 'k1' }) as never)
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ idToken: 'tok-1', expiresIn: '3600' }),
        }),
      )
      const result = await provider.signInWithPassword('a@b', 'p')
      expect(result).toEqual({ accessToken: 'tok-1', expiresIn: 3600 })
    })

    it('calls Identity Toolkit endpoint with web API key', async () => {
      provider = new FirebaseAuthProvider(makeConfig({ webApiKey: 'mykey' }) as never)
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ idToken: 't', expiresIn: '3600' }),
      })
      vi.stubGlobal('fetch', fetchMock)
      await provider.signInWithPassword('a@b', 'p')
      expect(fetchMock.mock.calls[0]![0]).toContain('identitytoolkit.googleapis.com')
      expect(fetchMock.mock.calls[0]![0]).toContain('mykey')
    })

    it('throws UnauthorizedException on non-ok response with error message', async () => {
      provider = new FirebaseAuthProvider(makeConfig({ webApiKey: 'k' }) as never)
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          json: () => Promise.resolve({ error: { message: 'INVALID_PASSWORD' } }),
        }),
      )
      await expect(provider.signInWithPassword('a@b', 'wrong')).rejects.toThrow(
        UnauthorizedException,
      )
    })

    it('throws UnauthorizedException with fallback message on no error body', async () => {
      provider = new FirebaseAuthProvider(makeConfig({ webApiKey: 'k' }) as never)
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) }),
      )
      await expect(provider.signInWithPassword('a@b', 'wrong')).rejects.toThrow(
        'Invalid credentials',
      )
    })
  })

  // ── revokeUserSessions ─────────────────────────────────────────────────────

  describe('revokeUserSessions', () => {
    it('throws InternalServerError when app not initialized', async () => {
      provider = new FirebaseAuthProvider(makeConfig({}) as never)
      await expect(provider.revokeUserSessions('uid')).rejects.toThrow(InternalServerErrorException)
    })

    it('calls admin.revokeRefreshTokens on success', async () => {
      provider = new FirebaseAuthProvider(
        makeConfig({ projectId: 'p', clientEmail: 'c', privateKey: 'k' }) as never,
      )
      provider.onModuleInit()
      mockRevokeRefreshTokens.mockResolvedValue(undefined)
      await provider.revokeUserSessions('uid-1')
      expect(mockRevokeRefreshTokens).toHaveBeenCalledWith('uid-1')
    })

    it('wraps SDK errors in InternalServerErrorException', async () => {
      provider = new FirebaseAuthProvider(
        makeConfig({ projectId: 'p', clientEmail: 'c', privateKey: 'k' }) as never,
      )
      provider.onModuleInit()
      mockRevokeRefreshTokens.mockRejectedValue(new Error('boom'))
      await expect(provider.revokeUserSessions('uid')).rejects.toThrow(InternalServerErrorException)
    })
  })

  // ── deleteUser ─────────────────────────────────────────────────────────────

  describe('deleteUser', () => {
    it('throws InternalServerError when app not initialized', async () => {
      provider = new FirebaseAuthProvider(makeConfig({}) as never)
      await expect(provider.deleteUser('uid')).rejects.toThrow(InternalServerErrorException)
    })

    it('calls admin.deleteUser on success', async () => {
      provider = new FirebaseAuthProvider(
        makeConfig({ projectId: 'p', clientEmail: 'c', privateKey: 'k' }) as never,
      )
      provider.onModuleInit()
      mockDeleteUser.mockResolvedValue(undefined)
      await provider.deleteUser('uid-1')
      expect(mockDeleteUser).toHaveBeenCalledWith('uid-1')
    })

    it('wraps SDK errors in InternalServerErrorException', async () => {
      provider = new FirebaseAuthProvider(
        makeConfig({ projectId: 'p', clientEmail: 'c', privateKey: 'k' }) as never,
      )
      provider.onModuleInit()
      mockDeleteUser.mockRejectedValue(new Error('boom'))
      await expect(provider.deleteUser('uid')).rejects.toThrow(InternalServerErrorException)
    })
  })
})
