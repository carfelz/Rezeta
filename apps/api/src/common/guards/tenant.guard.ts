import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { AuthenticatedRequest } from './firebase-auth.guard.js'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js'
import { IS_PROVISION_ROUTE_KEY } from '../decorators/provision-route.decorator.js'

/**
 * TenantGuard — runs after FirebaseAuthGuard.
 *
 * Reads tenantId from the authenticated user (set by FirebaseAuthGuard) and
 * makes it available on req.tenantId, which the @TenantId() decorator reads.
 *
 * Skipped for @Public() and @ProvisionRoute() endpoints since those don't
 * have a fully resolved user yet.
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

    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>()
    // req.user is guaranteed to be set by FirebaseAuthGuard at this point
    request.tenantId = request.user.tenantId
    return true
  }
}
