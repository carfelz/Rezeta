import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Inject, Param, Patch, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import {
  CreateSsoConnectionSchema,
  SsoConnectionStatusSchema,
  UpdateSsoConnectionSchema,
  type CreateSsoConnectionDto,
  type PlatformPrincipal,
  type SsoConnectionDto,
  type SsoTestResultDto,
  type UpdateSsoConnectionDto,
} from '@rezeta/shared'
import { AUTH_BEARER_SCHEME, AUTH_OAUTH2_SCHEME } from '../../lib/auth/index.js'
import { CurrentPlatformUser } from '../../common/decorators/current-platform-user.decorator.js'
import { PlatformRoute } from '../../common/decorators/platform-route.decorator.js'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { SsoConnectionService } from './sso-connection.service.js'

const SetSsoConnectionStatusSchema = z.object({ status: SsoConnectionStatusSchema })
type SetSsoConnectionStatusDto = z.infer<typeof SetSsoConnectionStatusSchema>

/**
 * Staff console CRUD + connectivity test for SSO connections. Mutations
 * pass the acting PlatformPrincipal id through to the service so audit log
 * entries record who made the change (see SsoConnectionService docs).
 */
@ApiTags('Staff')
@ApiBearerAuth(AUTH_BEARER_SCHEME)
@ApiSecurity(AUTH_OAUTH2_SCHEME)
@PlatformRoute()
@Controller('v1/staff/identity/sso-connections')
export class StaffSsoConnectionsController {
  constructor(@Inject(SsoConnectionService) private svc: SsoConnectionService) {}

  @Get()
  @ApiOperation({ summary: 'List all SSO connections across tenants' })
  @ApiResponse({ status: 200 })
  list(): Promise<SsoConnectionDto[]> {
    return this.svc.list()
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an SSO connection for a tenant' })
  @ApiResponse({ status: 201 })
  create(
    @CurrentPlatformUser() actor: PlatformPrincipal,
    @Body(new ZodValidationPipe(CreateSsoConnectionSchema)) dto: CreateSsoConnectionDto,
  ): Promise<SsoConnectionDto> {
    return this.svc.create(dto, actor.id)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an SSO connection' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  update(
    @CurrentPlatformUser() actor: PlatformPrincipal,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateSsoConnectionSchema)) dto: UpdateSsoConnectionDto,
  ): Promise<SsoConnectionDto> {
    return this.svc.update(id, dto, actor.id)
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Activate or disable an SSO connection' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  setStatus(
    @CurrentPlatformUser() actor: PlatformPrincipal,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(SetSsoConnectionStatusSchema)) dto: SetSsoConnectionStatusDto,
  ): Promise<SsoConnectionDto> {
    return this.svc.setStatus(id, dto.status, actor.id)
  }

  @Post(':id/test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test connectivity to the connection issuer discovery document' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  test(@Param('id') id: string): Promise<SsoTestResultDto> {
    return this.svc.testConnection(id)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete (soft) an SSO connection' })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 404 })
  async remove(@CurrentPlatformUser() actor: PlatformPrincipal, @Param('id') id: string): Promise<void> {
    await this.svc.remove(id, actor.id)
  }
}
