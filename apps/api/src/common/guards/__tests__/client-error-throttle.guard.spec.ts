import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { HttpException, HttpStatus, type ExecutionContext } from '@nestjs/common'
import { ErrorCode } from '@rezeta/shared'
import {
  ClientErrorThrottleGuard,
  CLIENT_ERROR_RATE_LIMIT,
  MAX_TRACKED_CLIENTS,
} from '../client-error-throttle.guard.js'

function ctx(
  ip: string | undefined,
  headers: Record<string, string | string[]> = {},
): ExecutionContext {
  const req = { ip, headers }
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext
}

describe('ClientErrorThrottleGuard', () => {
  let guard: ClientErrorThrottleGuard
  const { max, windowMs } = CLIENT_ERROR_RATE_LIMIT

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    guard = new ClientErrorThrottleGuard()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows up to the limit within one window', () => {
    for (let i = 0; i < max; i++) {
      expect(guard.canActivate(ctx('1.1.1.1'))).toBe(true)
    }
  })

  it('throws 429 RATE_LIMITED on the request past the limit', () => {
    for (let i = 0; i < max; i++) guard.canActivate(ctx('1.1.1.1'))
    try {
      guard.canActivate(ctx('1.1.1.1'))
      expect.unreachable('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException)
      expect((err as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS)
      expect((err as HttpException).getResponse()).toMatchObject({ code: ErrorCode.RATE_LIMITED })
    }
  })

  it('resets the count once the window elapses', () => {
    for (let i = 0; i < max; i++) guard.canActivate(ctx('1.1.1.1'))
    vi.setSystemTime(windowMs)
    expect(guard.canActivate(ctx('1.1.1.1'))).toBe(true)
  })

  it('tracks each client independently', () => {
    for (let i = 0; i < max; i++) guard.canActivate(ctx('1.1.1.1'))
    // a different IP is unaffected by the first IP hitting its limit
    expect(guard.canActivate(ctx('2.2.2.2'))).toBe(true)
  })

  it('keys on the first x-forwarded-for hop when present', () => {
    const headers = { 'x-forwarded-for': '9.9.9.9, 10.0.0.1' }
    for (let i = 0; i < max; i++) guard.canActivate(ctx('proxy', headers))
    // same forwarded client is throttled even though req.ip is the proxy
    expect(() => guard.canActivate(ctx('proxy', headers))).toThrow(HttpException)
    // a different forwarded client on the same proxy is not
    expect(guard.canActivate(ctx('proxy', { 'x-forwarded-for': '8.8.8.8' }))).toBe(true)
  })

  it('falls back to a shared key when no ip is available', () => {
    for (let i = 0; i < max; i++) expect(guard.canActivate(ctx(undefined))).toBe(true)
    expect(() => guard.canActivate(ctx(undefined))).toThrow(HttpException)
  })

  it('keys on the first entry of an array-valued x-forwarded-for header', () => {
    const headers = { 'x-forwarded-for': ['5.5.5.5', '10.0.0.9'] }
    for (let i = 0; i < max; i++) guard.canActivate(ctx('proxy', headers))
    expect(() => guard.canActivate(ctx('proxy', headers))).toThrow(HttpException)
  })

  it('sweeps expired windows once the tracked-client cap is exceeded', () => {
    // Fill past the cap with distinct clients, then expire them all.
    for (let i = 0; i <= MAX_TRACKED_CLIENTS; i++) {
      guard.canActivate(ctx(`10.${(i >> 16) & 255}.${(i >> 8) & 255}.${i & 255}`))
    }
    vi.setSystemTime(windowMs)
    // The next request is over the cap and all prior windows are expired, so the
    // sweep runs; the guard keeps working and admits the request.
    expect(guard.canActivate(ctx('fresh-client'))).toBe(true)
  })
})
