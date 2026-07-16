import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Post, UsePipes } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger'
import {
  CreateInstitutionSchema,
  type CreateInstitutionDto,
  type InstitutionCreatedDto,
  type PlatformPrincipal,
} from '@rezeta/shared'
import { AUTH_BEARER_SCHEME, AUTH_OAUTH2_SCHEME } from '../../lib/auth/index.js'
import { CurrentPlatformUser } from '../../common/decorators/current-platform-user.decorator.js'
import { PlatformRoute } from '../../common/decorators/platform-route.decorator.js'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { StaffService } from './staff.service.js'

@ApiTags('Staff')
@ApiBearerAuth(AUTH_BEARER_SCHEME)
@ApiSecurity(AUTH_OAUTH2_SCHEME)
@PlatformRoute()
@Controller('v1/staff')
export class StaffController {
  constructor(@Inject(StaffService) private svc: StaffService) {}

  @Get('me')
  @ApiOperation({ summary: 'Return the authenticated platform principal' })
  @ApiResponse({ status: 200, description: 'Platform principal.' })
  @ApiResponse({ status: 401, description: 'Caller is not a platform user.' })
  me(@CurrentPlatformUser() platformUser: PlatformPrincipal): PlatformPrincipal {
    return platformUser
  }

  @Post('institutions')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(CreateInstitutionSchema))
  @ApiOperation({ summary: 'Create a new institution (tenant) and its initial super_admin' })
  @ApiResponse({ status: 201, description: 'Institution created.' })
  @ApiResponse({ status: 401, description: 'Caller is not a platform user.' })
  async createInstitution(
    @CurrentPlatformUser() actor: PlatformPrincipal,
    @Body() dto: CreateInstitutionDto,
  ): Promise<InstitutionCreatedDto> {
    return this.svc.createInstitution(dto, actor.id)
  }
}
