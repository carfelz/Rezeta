import { Body, Controller, Get, Inject, Patch } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiResponse, ApiTags } from '@nestjs/swagger'
import { AUTH_BEARER_SCHEME, AUTH_OAUTH2_SCHEME } from '../../lib/auth/index.js'
import {
  UpdatePermissionSchema,
  type UpdatePermissionDto,
  type PermissionMatrixResponse,
  type CapabilityMap,
  MODULE_KEYS,
  PERMISSION_CATALOG,
} from '@rezeta/shared'
import type { AuthUser } from '@rezeta/shared'
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js'
import { CurrentUser } from '../../common/decorators/current-user.decorator.js'
import { TenantId } from '../../common/decorators/tenant-id.decorator.js'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { PermissionsService } from './permissions.service.js'

@ApiTags('Permissions')
@ApiBearerAuth(AUTH_BEARER_SCHEME)
@ApiSecurity(AUTH_OAUTH2_SCHEME)
@Controller('v1/permissions')
export class PermissionsController {
  constructor(@Inject(PermissionsService) private readonly svc: PermissionsService) {}

  @Get()
  @RequirePermission('permissions', 'view')
  @ApiOperation({ summary: 'Get the tenant permission matrix + catalog structure' })
  @ApiResponse({ status: 200 })
  async getMatrix(@TenantId() tenantId: string): Promise<PermissionMatrixResponse> {
    const matrix = await this.svc.getMatrix(tenantId)
    const modules = MODULE_KEYS.map((key) => PERMISSION_CATALOG[key])
    return { matrix, modules }
  }

  @Patch()
  @RequirePermission('permissions', 'manage')
  @ApiOperation({ summary: 'Update one role/module access level (rank-rule enforced)' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 403 })
  update(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(UpdatePermissionSchema)) dto: UpdatePermissionDto,
  ): Promise<CapabilityMap> {
    return this.svc.updateModule(
      tenantId,
      user.role,
      user.id,
      dto.role,
      dto.moduleKey,
      dto.accessLevel,
    )
  }
}
