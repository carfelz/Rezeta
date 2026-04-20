import { SetMetadata, type CustomDecorator } from '@nestjs/common'

/**
 * Mark an endpoint as fully public — skips Firebase token verification entirely.
 * Use only for health checks, static metadata, or truly unauthenticated endpoints.
 *
 * @example
 * @Public()
 * @Get('/health')
 * health() { return { status: 'ok' } }
 */
export const IS_PUBLIC_KEY = 'isPublic'
export const Public = (): CustomDecorator => SetMetadata(IS_PUBLIC_KEY, true)
