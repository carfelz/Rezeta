import type { ExecutionContext, CallHandler } from '@nestjs/common'
import { of, throwError, firstValueFrom } from 'rxjs'
import { AuditLogInterceptor } from '../audit-log.interceptor.js'
import { httpAuditContextStore } from '../../audit-log/audit-context.store.js'
import type { AuditLogService } from '../../audit-log/audit-log.service.js'

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

function makeHandler(result: unknown = { result: 'ok' }): CallHandler {
  return { handle: () => of(result) }
}

function makeErrorHandler(error: unknown = new Error('db failure')): CallHandler {
  return { handle: () => throwError(() => error) }
}

describe('AuditLogInterceptor', () => {
  let recordMock: ReturnType<typeof vi.fn>
  let auditLog: AuditLogService
  let interceptor: AuditLogInterceptor

  beforeEach(() => {
    recordMock = vi.fn().mockResolvedValue(undefined)
    auditLog = { record: recordMock } as unknown as AuditLogService
    interceptor = new AuditLogInterceptor(auditLog)
  })

  it('skips audit for GET requests', async () => {
    const req = makeRequest({ method: 'GET' })
    await firstValueFrom(interceptor.intercept(makeContext(req), makeHandler()))
    expect(recordMock).not.toHaveBeenCalled()
  })

  it('records audit for POST request with entity id', async () => {
    const req = makeRequest({ method: 'POST' })
    await firstValueFrom(interceptor.intercept(makeContext(req), makeHandler()))
    await new Promise((r) => setTimeout(r, 10))
    expect(recordMock).toHaveBeenCalledOnce()
    const event = recordMock.mock.calls[0]?.[0] as Record<string, unknown>
    expect(event['action']).toBe('create')
    expect(event['entityType']).toBe('Patient')
    expect(event['category']).toBe('entity')
    expect(event['actorType']).toBe('user')
  })

  it('records audit for PATCH request with action update', async () => {
    const req = makeRequest({ method: 'PATCH' })
    await firstValueFrom(interceptor.intercept(makeContext(req), makeHandler()))
    await new Promise((r) => setTimeout(r, 10))
    const event = recordMock.mock.calls[0]?.[0] as Record<string, unknown>
    expect(event['action']).toBe('update')
  })

  it('records audit for DELETE request with action delete', async () => {
    const req = makeRequest({ method: 'DELETE' })
    await firstValueFrom(interceptor.intercept(makeContext(req), makeHandler()))
    await new Promise((r) => setTimeout(r, 10))
    const event = recordMock.mock.calls[0]?.[0] as Record<string, unknown>
    expect(event['action']).toBe('delete')
  })

  it('resolves action as "sign" for POST /sign path', async () => {
    const req = makeRequest({
      method: 'POST',
      path: '/v1/consultations/abc-123/sign',
      params: { id: 'abc-123' },
    })
    await firstValueFrom(interceptor.intercept(makeContext(req), makeHandler()))
    await new Promise((r) => setTimeout(r, 10))
    const event = recordMock.mock.calls[0]?.[0] as Record<string, unknown>
    expect(event['action']).toBe('sign')
  })

  it('resolves action as "amend" for POST /amend path', async () => {
    const req = makeRequest({
      method: 'POST',
      path: '/v1/consultations/abc-123/amend',
      params: { id: 'abc-123' },
    })
    await firstValueFrom(interceptor.intercept(makeContext(req), makeHandler()))
    await new Promise((r) => setTimeout(r, 10))
    const event = recordMock.mock.calls[0]?.[0] as Record<string, unknown>
    expect(event['action']).toBe('amend')
  })

  it('skips audit when request has no user', async () => {
    const req = makeRequest({ user: undefined })
    await firstValueFrom(interceptor.intercept(makeContext(req), makeHandler()))
    expect(recordMock).not.toHaveBeenCalled()
  })

  it('skips audit when request has no tenantId', async () => {
    const req = makeRequest({ tenantId: undefined })
    await firstValueFrom(interceptor.intercept(makeContext(req), makeHandler()))
    expect(recordMock).not.toHaveBeenCalled()
  })

  it('records tenantId, actorUserId, ipAddress, userAgent, status', async () => {
    const req = makeRequest()
    await firstValueFrom(interceptor.intercept(makeContext(req), makeHandler()))
    await new Promise((r) => setTimeout(r, 10))
    const event = recordMock.mock.calls[0]?.[0] as Record<string, unknown>
    expect(event['tenantId']).toBe('tenant-id')
    expect(event['actorUserId']).toBe('user-id')
    expect(event['ipAddress']).toBe('127.0.0.1')
    expect(event['userAgent']).toBe('test-agent')
    expect(event['status']).toBe('success')
  })

  it('records status=failed when handler throws and re-throws the error', async () => {
    const req = makeRequest()
    const obs = interceptor.intercept(makeContext(req), makeErrorHandler())
    let caughtError: unknown
    await new Promise<void>((resolve) => {
      obs.subscribe({
        error: (e: unknown) => {
          caughtError = e
          resolve()
        },
      })
    })
    await new Promise((r) => setTimeout(r, 10))
    expect(caughtError).toBeInstanceOf(Error)
    expect(recordMock).toHaveBeenCalledOnce()
    const event = recordMock.mock.calls[0]?.[0] as Record<string, unknown>
    expect(event['status']).toBe('failed')
    expect(event['tenantId']).toBe('tenant-id')
    expect(event['actorUserId']).toBe('user-id')
  })

  it('sets httpAuditContextStore with tenantId and actorUserId before calling handler', async () => {
    const runSpy = vi.spyOn(httpAuditContextStore, 'run')
    const req = makeRequest()
    await firstValueFrom(interceptor.intercept(makeContext(req), makeHandler()))
    expect(runSpy).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-id', actorUserId: 'user-id' }),
      expect.any(Function),
    )
    runSpy.mockRestore()
  })

  it('includes requestId when x-request-id header is a string', async () => {
    const req = makeRequest({
      headers: { 'user-agent': 'test-agent', 'x-request-id': 'req-abc-123' },
    })
    await firstValueFrom(interceptor.intercept(makeContext(req), makeHandler()))
    await new Promise((r) => setTimeout(r, 10))
    const event = recordMock.mock.calls[0]?.[0] as Record<string, unknown>
    expect(event['requestId']).toBe('req-abc-123')
  })
})
