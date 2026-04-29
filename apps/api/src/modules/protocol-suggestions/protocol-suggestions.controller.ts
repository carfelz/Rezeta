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
import type { ProtocolSuggestion, AuthUser } from '@rezeta/shared'
import { CurrentUser } from '../../common/decorators/current-user.decorator.js'
import { TenantId } from '../../common/decorators/tenant-id.decorator.js'
import { ProtocolSuggestionsService } from './protocol-suggestions.service.js'

@ApiTags('Protocol Suggestions')
@ApiBearerAuth('firebase-jwt')
@ApiSecurity('firebase-oauth2')
@Controller('v1/protocols/:protocolId/suggestions')
export class ProtocolSuggestionsController {
  constructor(@Inject(ProtocolSuggestionsService) private svc: ProtocolSuggestionsService) {}

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
