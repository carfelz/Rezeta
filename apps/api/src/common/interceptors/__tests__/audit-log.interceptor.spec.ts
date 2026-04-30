import type { ExecutionContext, CallHandler } from '@nestjs/common'
import { of } from 'rxjs'
import { firstValueFrom } from 'rxjs'
import { AuditLogInterceptor } from '../audit-log.interceptor.js'
import type { PrismaService } from '../../../lib/prisma.service.js'

function makeRequest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    method: 'POST',
    path: '/v1/patients/abc-123',
    params: { id: 'abc-123' },
    ip: '127.0.0.1',
    headers: { 'user-agent': 'test-agent' },
    user: {
      id: 'user-id',
      tenantId: 'tenant-id',
      email: 'doc@test.com',
      fullName: 'Dr Test',
      role: 'owner',
      firebaseUid: 'fb-uid',
      specialty: null,
      licenseNumber: null,
      tenantSeededAt: null,
    },
    tenantId: 'tenant-id',
    ...overrides,
  }
}

function makeContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext
}

function makeHandler(): CallHandler {
  return { handle: () => of({ result: 'ok' }) }
}

describe('AuditLogInterceptor', () => {
  let createMock: ReturnType<typeof vi.fn>
  let prisma: PrismaService
  let interceptor: AuditLogInterceptor

  beforeEach(() => {
    createMock = vi.fn().mockResolvedValue({})
    prisma = {
      auditLog: { create: createMock },
    } as unknown as PrismaService
    interceptor = new AuditLogInterceptor(prisma)
  })

  it('skips audit for GET requests', async () => {
    const req = makeRequest({ method: 'GET' })
    await firstValueFrom(interceptor.intercept(makeContext(req), makeHandler()))
    expect(createMock).not.toHaveBeenCalled()
  })

  it('creates audit log for POST request with entity id', async () => {
    const req = makeRequest({ method: 'POST' })
    await firstValueFrom(interceptor.intercept(makeContext(req), makeHandler()))
    // Wait for the async tap to fire
    await new Promise((r) => setTimeout(r, 10))
    expect(createMock).toHaveBeenCalledOnce()
    const callArg = createMock.mock.calls[0]?.[0] as { data: { action: string; entityType: string } }
    expect(callArg.data.action).toBe('create')
    expect(callArg.data.entityType).toBe('Patient')
  })

  it('creates audit log for PATCH request', async () => {
    const req = makeRequest({ method: 'PATCH' })
    await firstValueFrom(interceptor.intercept(makeContext(req), makeHandler()))
    await new Promise((r) => setTimeout(r, 10))
    const callArg = createMock.mock.calls[0]?.[0] as { data: { action: string } }
    expect(callArg.data.action).toBe('update')
  })

  it('creates audit log for DELETE request', async () => {
    const req = makeRequest({ method: 'DELETE' })
    await firstValueFrom(interceptor.intercept(makeContext(req), makeHandler()))
    await new Promise((r) => setTimeout(r, 10))
    const callArg = createMock.mock.calls[0]?.[0] as { data: { action: string } }
    expect(callArg.data.action).toBe('delete')
  })

  it('resolves action as "sign" for POST /sign path', async () => {
    const req = makeRequest({
      method: 'POST',
      path: '/v1/consultations/abc-123/sign',
      params: { id: 'abc-123' },
    })
    await firstValueFrom(interceptor.intercept(makeContext(req), makeHandler()))
    await new Promise((r) => setTimeout(r, 10))
    const callArg = createMock.mock.calls[0]?.[0] as { data: { action: string } }
    expect(callArg.data.action).toBe('sign')
  })

  it('resolves action as "amend" for POST /amend path', async () => {
    const req = makeRequest({
      method: 'POST',
      path: '/v1/consultations/abc-123/amend',
      params: { id: 'abc-123' },
    })
    await firstValueFrom(interceptor.intercept(makeContext(req), makeHandler()))
    await new Promise((r) => setTimeout(r, 10))
    const callArg = createMock.mock.calls[0]?.[0] as { data: { action: string } }
    expect(callArg.data.action).toBe('amend')
  })

  it('skips audit when request has no user', async () => {
    const req = makeRequest({ user: undefined })
    await firstValueFrom(interceptor.intercept(makeContext(req), makeHandler()))
    expect(createMock).not.toHaveBeenCalled()
  })

  it('skips audit when request has no tenantId', async () => {
    const req = makeRequest({ tenantId: undefined })
    await firstValueFrom(interceptor.intercept(makeContext(req), makeHandler()))
    expect(createMock).not.toHaveBeenCalled()
  })

  it('skips audit when path has no entity id param', async () => {
    const req = makeRequest({
      method: 'POST',
      path: '/v1/patients',
      params: {},
    })
    await firstValueFrom(interceptor.intercept(makeContext(req), makeHandler()))
    await new Promise((r) => setTimeout(r, 10))
    expect(createMock).not.toHaveBeenCalled()
  })

  it('stores correct tenantId, userId, and ipAddress', async () => {
    const req = makeRequest()
    await firstValueFrom(interceptor.intercept(makeContext(req), makeHandler()))
    await new Promise((r) => setTimeout(r, 10))
    const callArg = createMock.mock.calls[0]?.[0] as {
      data: { tenantId: string; userId: string; ipAddress: string; userAgent: string }
    }
    expect(callArg.data.tenantId).toBe('tenant-id')
    expect(callArg.data.userId).toBe('user-id')
    expect(callArg.data.ipAddress).toBe('127.0.0.1')
    expect(callArg.data.userAgent).toBe('test-agent')
  })
})
