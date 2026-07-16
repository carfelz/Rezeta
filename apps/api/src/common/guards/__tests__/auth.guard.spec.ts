import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UnauthorizedException } from '@nestjs/common'
import type { Reflector } from '@nestjs/core'
import { AuthGuard } from '../auth.guard.js'
import type { VerifiedToken } from '../../../lib/auth/index.js'

const mockAuthProvider = {
  verifyToken: vi.fn(),
  revokeUserSessions: vi.fn(),
  deleteUser: vi.fn(),
}
const mockUsers = { findByExternalUid: vi.fn() }
const mockReflector = { getAllAndOverride: vi.fn() }
const mockAuditLog = { record: vi.fn().mockResolvedValue(undefined) }

function makeCtx(overrides: {
  headers?: Record<string, string>
  isPublic?: boolean
  isProvision?: boolean
  ip?: string
}) {
  mockReflector.getAllAndOverride.mockImplementation((key: string) => {
    if (key === 'isPublic') return overrides.isPublic ?? false
    if (key === 'isProvisionRoute') return overrides.isProvision ?? false
    return false
  })
  const req = {
    headers: overrides.headers ?? {},
    ip: overrides.ip ?? '127.0.0.1',
  } as Record<string, unknown>
  return {
    getHandler: vi.fn(),
    getClass: vi.fn(),
    switchToHttp: () => ({ getRequest: () => req }),
    _req: req,
  }
}

const validUser = {
  id: 'user-1',
  externalUid: 'fb-uid',
  tenantId: 'tenant-1',
  email: 'doc@test.com',
  fullName: 'Dr. Test',
  role: 'super_admin',
  specialty: null,
  licenseNumber: null,
  isActive: true,
  tenant: { seededAt: new Date('2026-01-01'), plan: 'free' },
}

const verifiedToken: VerifiedToken = {
  externalUid: 'fb-uid',
  email: 'doc@test.com',
  rawClaims: { uid: 'fb-uid', email: 'doc@test.com' },
}

describe('AuthGuard', () => {
  let guard: AuthGuard

  beforeEach(() => {
    vi.clearAllMocks()
    guard = new AuthGuard(
      mockReflector as unknown as Reflector,
      mockAuthProvider as never,
      mockUsers as never,
      mockAuditLog as never,
    )
  })

  it('returns true for @Public() routes without checking token', async () => {
    const ctx = makeCtx({ isPublic: true })
    expect(await guard.canActivate(ctx as never)).toBe(true)
    expect(mockAuthProvider.verifyToken).not.toHaveBeenCalled()
  })

  it('throws UnauthorizedException when Authorization header is missing', async () => {
    const ctx = makeCtx({})
    await expect(guard.canActivate(ctx as never)).rejects.toThrow(UnauthorizedException)
  })

  it('throws UnauthorizedException when header is not Bearer', async () => {
    const ctx = makeCtx({ headers: { authorization: 'Basic abc123' } })
    await expect(guard.canActivate(ctx as never)).rejects.toThrow(UnauthorizedException)
  })

  it('rethrows when auth provider rejects token', async () => {
    mockAuthProvider.verifyToken.mockRejectedValue(new UnauthorizedException('invalid token'))
    const ctx = makeCtx({ headers: { authorization: 'Bearer bad-token' } })
    await expect(guard.canActivate(ctx as never)).rejects.toThrow(UnauthorizedException)
  })

  it('records login_failed audit event when token verification fails', async () => {
    mockAuthProvider.verifyToken.mockRejectedValue(new UnauthorizedException('invalid token'))
    const ctx = makeCtx({
      headers: { authorization: 'Bearer bad-token', 'user-agent': 'TestAgent/1.0' },
      ip: '10.0.0.1',
    })
    await expect(guard.canActivate(ctx as never)).rejects.toThrow(UnauthorizedException)
    expect(mockAuditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: 'user',
        category: 'auth',
        action: 'login_failed',
        status: 'failed',
        ipAddress: '10.0.0.1',
        userAgent: 'TestAgent/1.0',
      }),
    )
  })

  it('omits ipAddress in audit when request.ip is undefined on token failure', async () => {
    mockAuthProvider.verifyToken.mockRejectedValue(new UnauthorizedException('invalid token'))
    const ctx = makeCtx({ headers: { authorization: 'Bearer bad-token' } })
    // Override ip to undefined
    ctx._req.ip = undefined
    await expect(guard.canActivate(ctx as never)).rejects.toThrow(UnauthorizedException)
    const call = mockAuditLog.record.mock.calls[0]![0] as Record<string, unknown>
    expect(call.ipAddress).toBeUndefined()
  })

  it('does not record audit event when Authorization header is missing', async () => {
    const ctx = makeCtx({})
    await expect(guard.canActivate(ctx as never)).rejects.toThrow(UnauthorizedException)
    expect(mockAuditLog.record).not.toHaveBeenCalled()
  })

  it('returns true for @ProvisionRoute() after token verification (no DB lookup)', async () => {
    mockAuthProvider.verifyToken.mockResolvedValue(verifiedToken)
    const ctx = makeCtx({ headers: { authorization: 'Bearer valid-token' }, isProvision: true })
    expect(await guard.canActivate(ctx as never)).toBe(true)
    expect(mockUsers.findByExternalUid).not.toHaveBeenCalled()
    expect(ctx._req.verifiedToken).toBe(verifiedToken)
  })

  it('throws UnauthorizedException when user not found in DB', async () => {
    mockAuthProvider.verifyToken.mockResolvedValue(verifiedToken)
    mockUsers.findByExternalUid.mockResolvedValue(null)
    const ctx = makeCtx({ headers: { authorization: 'Bearer valid-token' } })
    await expect(guard.canActivate(ctx as never)).rejects.toThrow(UnauthorizedException)
  })

  it('throws UnauthorizedException when user is inactive', async () => {
    mockAuthProvider.verifyToken.mockResolvedValue(verifiedToken)
    mockUsers.findByExternalUid.mockResolvedValue({ ...validUser, isActive: false })
    const ctx = makeCtx({ headers: { authorization: 'Bearer valid-token' } })
    await expect(guard.canActivate(ctx as never)).rejects.toThrow(UnauthorizedException)
  })

  it('populates req.user and returns true for valid authenticated request', async () => {
    mockAuthProvider.verifyToken.mockResolvedValue(verifiedToken)
    mockUsers.findByExternalUid.mockResolvedValue(validUser)
    const ctx = makeCtx({ headers: { authorization: 'Bearer valid-token' } })
    expect(await guard.canActivate(ctx as never)).toBe(true)
    const req = ctx._req
    expect((req.user as Record<string, unknown>).id).toBe('user-1')
    expect((req.user as Record<string, unknown>).tenantId).toBe('tenant-1')
    expect((req.user as Record<string, unknown>).externalUid).toBe('fb-uid')
  })

  it('sets tenantSeededAt to null when seededAt is null', async () => {
    mockAuthProvider.verifyToken.mockResolvedValue(verifiedToken)
    mockUsers.findByExternalUid.mockResolvedValue({
      ...validUser,
      tenant: { seededAt: null, plan: 'free' },
    })
    const ctx = makeCtx({ headers: { authorization: 'Bearer valid-token' } })
    await guard.canActivate(ctx as never)
    const req = ctx._req
    expect((req.user as Record<string, unknown>).tenantSeededAt).toBeNull()
  })
})
