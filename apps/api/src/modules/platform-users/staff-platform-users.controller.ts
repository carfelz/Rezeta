import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
} from '@nestjs/common'
import { ApiBearerAuth, ApiSecurity, ApiTags } from '@nestjs/swagger'
import {
  CreatePlatformUserSchema,
  SetActiveSchema,
  type CreatePlatformUserDto,
  type PlatformPrincipal,
  type PlatformUserApiDto,
  type SetActiveDto,
} from '@rezeta/shared'
import { AUTH_BEARER_SCHEME, AUTH_OAUTH2_SCHEME } from '../../lib/auth/index.js'
import { CurrentPlatformUser } from '../../common/decorators/current-platform-user.decorator.js'
import { PlatformRoute } from '../../common/decorators/platform-route.decorator.js'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { PlatformUsersService } from './platform-users.service.js'

@ApiTags('Staff')
@ApiBearerAuth(AUTH_BEARER_SCHEME)
@ApiSecurity(AUTH_OAUTH2_SCHEME)
@PlatformRoute()
@Controller('v1/staff/identity/users')
export class StaffPlatformUsersController {
  constructor(@Inject(PlatformUsersService) private svc: PlatformUsersService) {}

  @Get()
  list(): Promise<PlatformUserApiDto[]> {
    return this.svc.listUsers()
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentPlatformUser() actor: PlatformPrincipal,
    @Body(new ZodValidationPipe(CreatePlatformUserSchema)) dto: CreatePlatformUserDto,
  ): Promise<PlatformUserApiDto> {
    return this.svc.createUser(actor.id, dto)
  }

  @Patch(':id/active')
  setActive(
    @CurrentPlatformUser() actor: PlatformPrincipal,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(SetActiveSchema)) dto: SetActiveDto,
  ): Promise<PlatformUserApiDto> {
    return this.svc.setActive(actor.id, id, dto)
  }

  @Post(':id/resend-invite')
  @HttpCode(HttpStatus.OK)
  resendInvite(
    @CurrentPlatformUser() actor: PlatformPrincipal,
    @Param('id') id: string,
  ): Promise<PlatformUserApiDto> {
    return this.svc.resendInvite(actor.id, id)
  }
}
