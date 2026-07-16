import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { AuthenticatedRequest } from './auth.guard.js'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js'
import { IS_PROVISION_ROUTE_KEY } from '../decorators/provision-route.decorator.js'
import { IS_PLATFORM_ROUTE_KEY } from '../decorators/platform-route.decorator.js'

/**
 * TenantGuard — runs after AuthGuard (and PlatformGuard).
 *
 * Reads tenantId from the authenticated institution user (set by AuthGuard) and
 * exposes it on req.tenantId, which the @TenantId() decorator reads. This is the
 * tenant-isolation invariant: an institution user is always pinned to their own
 * tenant.
 *
 * Skipped for @Public() and @ProvisionRoute() endpoints (no resolved user yet),
 * and for @PlatformRoute() endpoints (platform staff have NO tenant — they never
 * enter a tenant-scoped query path).
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(@Inject(Reflector) private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const handler = ctx.getHandler()
    const classRef = ctx.getClass()

    // Skip for public routes
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [handler, classRef])
    if (isPublic) return true

    // Skip for the provision route (user not yet in DB)
    const isProvisionRoute = this.reflector.getAllAndOverride<boolean>(IS_PROVISION_ROUTE_KEY, [
      handler,
      classRef,
    ])
    if (isProvisionRoute) return true

    // Skip for platform routes (platform staff have no tenant)
    const isPlatformRoute = this.reflector.getAllAndOverride<boolean>(IS_PLATFORM_ROUTE_KEY, [
      handler,
      classRef,
    ])
    if (isPlatformRoute) return true

    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>()
    // req.user is guaranteed to be set by AuthGuard at this point
    request.tenantId = request.user.tenantId
    return true
  }
}
