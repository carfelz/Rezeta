import { describe, it, expect, vi } from 'vitest'
import { ForbiddenException } from '@nestjs/common'
import { ErrorCode, type CapabilityMap } from '@rezeta/shared'
import { PermissionGuard } from '../permission.guard.js'
import { IS_PUBLIC_KEY } from '../../decorators/public.decorator.js'
import {
  PERMISSION_KEY,
  type RequiredPermission,
} from '../../decorators/require-permission.decorator.js'

function makeCtx(options: {
  isPublic?: boolean
  required?: RequiredPermission | undefined
  capabilities?: Partial<CapabilityMap>
}) {
  const reflector = {
    getAllAndOverride: vi.fn((key: string) => {
      if (key === IS_PUBLIC_KEY) return options.isPublic ?? false
      if (key === PERMISSION_KEY) return options.required
      return undefined
    }),
  }
  const request = {
    user: {
      capabilities: (options.capabilities ?? {}) as CapabilityMap,
    },
  }
  const ctx = {
    getHandler: vi.fn().mockReturnValue({}),
    getClass: vi.fn().mockReturnValue({}),
    switchToHttp: vi.fn().mockReturnValue({ getRequest: vi.fn().mockReturnValue(request) }),
  }
  return { reflector, ctx }
}

describe('PermissionGuard', () => {
  it('passes through when there is no @RequirePermission metadata', () => {
    const { reflector, ctx } = makeCtx({ required: undefined })
    const guard = new PermissionGuard(reflector as never)
    expect(guard.canActivate(ctx as never)).toBe(true)
  })

  it('passes through for public routes even if metadata is present', () => {
    const { reflector, ctx } = makeCtx({
      isPublic: true,
      required: { module: 'patients', level: 'manage' },
    })
    const guard = new PermissionGuard(reflector as never)
    expect(guard.canActivate(ctx as never)).toBe(true)
  })

  it('allows when the caller has sufficient capability', () => {
    const { reflector, ctx } = makeCtx({
      required: { module: 'patients', level: 'view' },
      capabilities: { patients: 'manage' },
    })
    const guard = new PermissionGuard(reflector as never)
    expect(guard.canActivate(ctx as never)).toBe(true)
  })

  it('throws ForbiddenException with INSUFFICIENT_PERMISSION when under-privileged', () => {
    const { reflector, ctx } = makeCtx({
      required: { module: 'patients', level: 'manage' },
      capabilities: { patients: 'view' },
    })
    const guard = new PermissionGuard(reflector as never)
    try {
      guard.canActivate(ctx as never)
      expect.unreachable('guard should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException)
      const body = (err as ForbiddenException).getResponse()
      expect(body).toMatchObject({ code: ErrorCode.INSUFFICIENT_PERMISSION })
    }
  })

  it('denies when the module is absent from the capability map (defaults to none)', () => {
    const { reflector, ctx } = makeCtx({
      required: { module: 'protocols', level: 'view' },
      capabilities: {},
    })
    const guard = new PermissionGuard(reflector as never)
    expect(() => guard.canActivate(ctx as never)).toThrow(ForbiddenException)
  })
})
