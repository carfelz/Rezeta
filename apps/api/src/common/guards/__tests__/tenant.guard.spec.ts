import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TenantGuard } from '../tenant.guard.js'
import { IS_PUBLIC_KEY } from '../../decorators/public.decorator.js'
import { IS_PROVISION_ROUTE_KEY } from '../../decorators/provision-route.decorator.js'

function makeContext(options: {
  isPublic?: boolean
  isProvisionRoute?: boolean
  tenantId?: string
}) {
  const reflector = {
    getAllAndOverride: vi.fn((key: string) => {
      if (key === IS_PUBLIC_KEY) return options.isPublic ?? false
      if (key === IS_PROVISION_ROUTE_KEY) return options.isProvisionRoute ?? false
      return undefined
    }),
  }

  const request: Record<string, unknown> = {
    user: { tenantId: options.tenantId ?? 'tenant-1' },
  }

  const ctx = {
    getHandler: vi.fn().mockReturnValue({}),
    getClass: vi.fn().mockReturnValue({}),
    switchToHttp: vi.fn().mockReturnValue({ getRequest: vi.fn().mockReturnValue(request) }),
  }

  return { reflector, ctx, request }
}

describe('TenantGuard', () => {
  let guard: TenantGuard

  beforeEach(() => {
    const { reflector } = makeContext({})
    guard = new TenantGuard(reflector as never)
  })

  it('returns true for public routes without setting tenantId', () => {
    const { reflector, ctx, request } = makeContext({ isPublic: true })
    guard = new TenantGuard(reflector as never)
    const result = guard.canActivate(ctx as never)
    expect(result).toBe(true)
    expect(request['tenantId']).toBeUndefined()
  })

  it('returns true for provision routes without setting tenantId', () => {
    const { reflector, ctx, request } = makeContext({ isProvisionRoute: true })
    guard = new TenantGuard(reflector as never)
    const result = guard.canActivate(ctx as never)
    expect(result).toBe(true)
    expect(request['tenantId']).toBeUndefined()
  })

  it('sets tenantId on request for authenticated routes', () => {
    const { reflector, ctx, request } = makeContext({ tenantId: 'my-tenant' })
    guard = new TenantGuard(reflector as never)
    const result = guard.canActivate(ctx as never)
    expect(result).toBe(true)
    expect(request['tenantId']).toBe('my-tenant')
  })
})
