import { Body, Controller, Get, Inject, Param, Patch, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger'
import {
  CreateUserSchema,
  ChangeRoleSchema,
  SetActiveSchema,
  type AuthUser,
  type CreateUserDto,
  type ChangeRoleDto,
  type SetActiveDto,
  type ManagedUserDto,
} from '@rezeta/shared'
import { AUTH_BEARER_SCHEME, AUTH_OAUTH2_SCHEME } from '../../lib/auth/index.js'
import { CurrentUser } from '../../common/decorators/current-user.decorator.js'
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { UsersService } from './users.service.js'

@ApiTags('Users')
@ApiBearerAuth(AUTH_BEARER_SCHEME)
@ApiSecurity(AUTH_OAUTH2_SCHEME)
@Controller('v1/users')
export class UsersManagementController {
  constructor(@Inject(UsersService) private svc: UsersService) {}

  @Get()
  @RequirePermission('users', 'view')
  @ApiOperation({ summary: 'List users in the institution' })
  @ApiResponse({ status: 200 })
  async list(@CurrentUser() user: AuthUser): Promise<ManagedUserDto[]> {
    return this.svc.listUsers(user.tenantId)
  }

  @Post()
  @RequirePermission('users', 'manage')
  @ApiOperation({ summary: 'Invite a user (create Firebase account + provisioned row)' })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 403, description: 'Actor may only create roles below their own.' })
  async create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateUserSchema)) dto: CreateUserDto,
  ): Promise<ManagedUserDto> {
    return this.svc.createUser(user.tenantId, user.role, user.id, dto)
  }

  @Patch(':id/role')
  @RequirePermission('users', 'manage')
  @ApiOperation({ summary: "Change a user's role" })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 403 })
  async changeRole(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ChangeRoleSchema)) dto: ChangeRoleDto,
  ): Promise<ManagedUserDto> {
    return this.svc.changeRole(user.tenantId, user.role, user.id, id, dto)
  }

  @Patch(':id/active')
  @RequirePermission('users', 'manage')
  @ApiOperation({ summary: 'Activate or deactivate a user (soft-deactivate)' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 403 })
  async setActive(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(SetActiveSchema)) dto: SetActiveDto,
  ): Promise<ManagedUserDto> {
    return this.svc.setActive(user.tenantId, user.role, user.id, id, dto)
  }
}
