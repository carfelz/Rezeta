import type { ExecutionContext } from '@nestjs/common'
import { createParamDecorator } from '@nestjs/common'
import type { PlatformPrincipal } from '@rezeta/shared'

/**
 * Yields the resolved PlatformPrincipal from a @PlatformRoute() handler.
 * `request.platformUser` is set by AuthGuard and required by PlatformGuard, so
 * it is always present by the time a controller method runs.
 */
export const CurrentPlatformUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PlatformPrincipal => {
    const request = ctx.switchToHttp().getRequest<{ platformUser: PlatformPrincipal }>()
    return request.platformUser
  },
)
