import { SetMetadata, type CustomDecorator } from '@nestjs/common'

/**
 * Mark an endpoint (or controller) as a PLATFORM route.
 *
 * Platform routes are served to Rezeta staff (a PlatformUser), not institution
 * users. AuthGuard resolves a PlatformUser by externalUid and sets
 * `request.platformUser` (401 if none/inactive); TenantGuard skips tenant
 * resolution; PlatformGuard requires `request.platformUser` to be present.
 *
 * Used by the /v1/staff/* controller.
 */
export const IS_PLATFORM_ROUTE_KEY = 'isPlatformRoute'
export const PlatformRoute = (): CustomDecorator => SetMetadata(IS_PLATFORM_ROUTE_KEY, true)
