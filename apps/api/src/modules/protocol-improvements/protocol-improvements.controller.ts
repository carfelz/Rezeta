import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  HttpCode,
  HttpStatus,
  Inject,
  ParseUUIDPipe,
} from '@nestjs/common'
import {
  ApiTags,
  ApiBearerAuth,
  ApiSecurity,
  ApiOperation,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger'
import { AUTH_BEARER_SCHEME, AUTH_OAUTH2_SCHEME } from '../../lib/auth/index.js'
import type { ProtocolSuggestion, AuthUser } from '@rezeta/shared'
import { CurrentUser } from '../../common/decorators/current-user.decorator.js'
import { TenantId } from '../../common/decorators/tenant-id.decorator.js'
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js'
import { ProtocolImprovementsService } from './protocol-improvements.service.js'

@ApiTags('Protocol Improvements')
@ApiBearerAuth(AUTH_BEARER_SCHEME)
@ApiSecurity(AUTH_OAUTH2_SCHEME)
@Controller('v1/protocols/:protocolId/suggestions')
export class ProtocolImprovementsController {
  constructor(@Inject(ProtocolImprovementsService) private svc: ProtocolImprovementsService) {}

  @RequirePermission('protocols', 'view')
  @Get()
  @ApiOperation({ summary: 'List pending suggestions for a protocol' })
  @ApiParam({ name: 'protocolId', type: String, format: 'uuid' })
  @ApiResponse({ status: 200 })
  list(
    @TenantId() tenantId: string,
    @Param('protocolId', ParseUUIDPipe) protocolId: string,
  ): Promise<ProtocolSuggestion[]> {
    return this.svc.list(protocolId, tenantId)
  }

  @RequirePermission('protocols', 'manage')
  @Post(':suggestionId/apply')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Apply suggestion — creates new protocol version with suggested changes',
  })
  @ApiParam({ name: 'protocolId', type: String, format: 'uuid' })
  @ApiParam({ name: 'suggestionId', type: String, format: 'uuid' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'SUGGESTION_NOT_FOUND' })
  apply(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('protocolId', ParseUUIDPipe) protocolId: string,
    @Param('suggestionId', ParseUUIDPipe) suggestionId: string,
  ): Promise<ProtocolSuggestion> {
    return this.svc.apply(protocolId, suggestionId, tenantId, user.id)
  }

  @RequirePermission('protocols', 'manage')
  @Post(':suggestionId/create-variant')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create a new protocol variant from a suggestion' })
  @ApiParam({ name: 'protocolId', type: String, format: 'uuid' })
  @ApiParam({ name: 'suggestionId', type: String, format: 'uuid' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'SUGGESTION_NOT_FOUND' })
  createVariant(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('protocolId', ParseUUIDPipe) protocolId: string,
    @Param('suggestionId', ParseUUIDPipe) suggestionId: string,
  ): Promise<ProtocolSuggestion> {
    return this.svc.createVariant(protocolId, suggestionId, tenantId, user.id)
  }

  @RequirePermission('protocols', 'manage')
  @Delete(':suggestionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Dismiss a suggestion' })
  @ApiParam({ name: 'protocolId', type: String, format: 'uuid' })
  @ApiParam({ name: 'suggestionId', type: String, format: 'uuid' })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 404, description: 'SUGGESTION_NOT_FOUND' })
  async dismiss(
    @TenantId() tenantId: string,
    @Param('protocolId', ParseUUIDPipe) protocolId: string,
    @Param('suggestionId', ParseUUIDPipe) suggestionId: string,
  ): Promise<void> {
    await this.svc.dismiss(protocolId, suggestionId, tenantId)
  }
}
