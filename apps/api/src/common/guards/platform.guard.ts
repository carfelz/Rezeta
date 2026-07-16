import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ErrorCode } from '@rezeta/shared'
import type { AuthenticatedRequest } from './auth.guard.js'
import { IS_PLATFORM_ROUTE_KEY } from '../decorators/platform-route.decorator.js'

/**
 * PlatformGuard — 2nd global guard (AuthGuard → PlatformGuard → TenantGuard →
 * PermissionGuard).
 *
 * No-op on every non-platform route. On a @PlatformRoute() handler it requires
 * that AuthGuard resolved a PlatformUser (`request.platformUser`); if not, the
 * caller is not platform staff → 403 FORBIDDEN. AuthGuard already 401s a token
 * that resolves no PlatformUser, so in practice this is defense-in-depth for the
 * platform boundary.
 */
@Injectable()
export class PlatformGuard implements CanActivate {
  constructor(@Inject(Reflector) private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isPlatformRoute = this.reflector.getAllAndOverride<boolean>(IS_PLATFORM_ROUTE_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ])
    if (!isPlatformRoute) return true

    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>()
    if (!request.platformUser) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'Platform access required',
      })
    }
    return true
  }
}
