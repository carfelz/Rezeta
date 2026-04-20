import { Controller, Get, Post, Inject, HttpCode, HttpStatus } from '@nestjs/common'
import type { DecodedIdToken } from 'firebase-admin/auth'
import type { AuthUser } from '@rezeta/shared'
import { ProvisionRoute } from '../../common/decorators/provision-route.decorator.js'
import { CurrentUser } from '../../common/decorators/current-user.decorator.js'
import { AuthService } from './auth.service.js'

/**
 * Access the decoded Firebase token attached by FirebaseAuthGuard on provision routes.
 * This decorator is only valid on @ProvisionRoute() endpoints.
 */
import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { AuthenticatedRequest } from '../../common/guards/firebase-auth.guard.js'

const FirebaseToken = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): DecodedIdToken => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>()
    return request.firebaseToken as DecodedIdToken
  },
)

@Controller('v1/auth')
export class AuthController {
  constructor(@Inject(AuthService) private service: AuthService) {}

  /**
   * POST /v1/auth/provision
   *
   * Idempotent. On first call: creates a Tenant + User atomically and returns the user.
   * On repeat calls: returns the existing user unchanged.
   *
   * The Firebase ID token must be present in the Authorization header, but this
   * endpoint is decorated with @ProvisionRoute() so the guard does NOT require
   * a matching User row in the DB — that's the whole point of this endpoint.
   *
   * 201 on first provision, 200 on repeat (both return the full user object).
   */
  @Post('provision')
  @ProvisionRoute()
  @HttpCode(HttpStatus.OK)  // always 200 — idempotent
  async provision(@FirebaseToken() decoded: DecodedIdToken): Promise<AuthUser> {
    const user = await this.service.provision(decoded)
    return this.service.toAuthUser(user)
  }

  /**
   * GET /v1/me
   *
   * Returns the currently authenticated user's profile.
   * Standard guarded endpoint — requires both a valid token AND an existing DB user.
   */
  @Get('me')
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user
  }
}
