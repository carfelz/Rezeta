import { SetMetadata, type CustomDecorator } from '@nestjs/common'
import type { AccessLevel, ModuleKey } from '@rezeta/shared'

/**
 * Metadata attached by @RequirePermission, read by PermissionGuard.
 */
export const PERMISSION_KEY = 'requiredPermission'

export interface RequiredPermission {
  module: ModuleKey
  level: AccessLevel
}

/**
 * Declare the permission an endpoint requires. GET/read routes use 'view';
 * POST/PATCH/DELETE mutations use 'manage'. PermissionGuard checks the caller's
 * resolved capability for `module` against `level`.
 *
 * @example
 * @RequirePermission('patients', 'manage')
 * @Post()
 * create() { ... }
 */
export const RequirePermission = (module: ModuleKey, level: AccessLevel): CustomDecorator =>
  SetMetadata(PERMISSION_KEY, { module, level })
