/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi } from 'vitest'
import { ForbiddenException } from '@nestjs/common'
import { PlatformGuard } from '../platform.guard.js'
import { IS_PLATFORM_ROUTE_KEY } from '../../decorators/platform-route.decorator.js'

function makeCtx(request: unknown) {
  return {
    getHandler: vi.fn().mockReturnValue({}),
    getClass: vi.fn().mockReturnValue({}),
    switchToHttp: vi.fn().mockReturnValue({ getRequest: vi.fn().mockReturnValue(request) }),
  } as never
}

function build(isPlatformRoute: boolean): PlatformGuard {
  const reflector = {
    getAllAndOverride: vi.fn((key: string) =>
      key === IS_PLATFORM_ROUTE_KEY ? isPlatformRoute : false,
    ),
  }
  return new PlatformGuard(reflector as never)
}

describe('PlatformGuard', () => {
  it('is a no-op (returns true) on non-platform routes even without a platformUser', () => {
    const guard = build(false)
    expect(guard.canActivate(makeCtx({}))).toBe(true)
  })

  it('allows a platform route when request.platformUser is set', () => {
    const guard = build(true)
    expect(guard.canActivate(makeCtx({ platformUser: { id: 'p1' } }))).toBe(true)
  })

  it('rejects a platform route with 403 FORBIDDEN when platformUser is missing', () => {
    const guard = build(true)
    expect(() => guard.canActivate(makeCtx({}))).toThrow(ForbiddenException)
  })
})
