import { Body, Controller, Get, Inject, Patch, UsePipes } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger'
import {
  UpdateUserPreferencesSchema,
  type AuthUser,
  type UpdateUserPreferencesDto,
  type UserPreferences,
} from '@rezeta/shared'
import { AUTH_BEARER_SCHEME, AUTH_OAUTH2_SCHEME } from '../../lib/auth/index.js'
import { CurrentUser } from '../../common/decorators/current-user.decorator.js'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { UsersService } from './users.service.js'

@ApiTags('Users')
@ApiBearerAuth(AUTH_BEARER_SCHEME)
@ApiSecurity(AUTH_OAUTH2_SCHEME)
@Controller('v1/users/me')
export class UsersController {
  constructor(@Inject(UsersService) private svc: UsersService) {}

  @Get('preferences')
  @ApiOperation({ summary: "Read the current user's UI preferences" })
  @ApiResponse({ status: 200 })
  async getPreferences(@CurrentUser() user: AuthUser): Promise<UserPreferences> {
    return this.svc.getPreferences(user.id, user.tenantId)
  }

  @Patch('preferences')
  @UsePipes(new ZodValidationPipe(UpdateUserPreferencesSchema))
  @ApiOperation({ summary: "Update the current user's UI preferences (partial merge)" })
  @ApiResponse({ status: 200 })
  async updatePreferences(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateUserPreferencesDto,
  ): Promise<UserPreferences> {
    return this.svc.updatePreferences(user.id, user.tenantId, dto)
  }
}
