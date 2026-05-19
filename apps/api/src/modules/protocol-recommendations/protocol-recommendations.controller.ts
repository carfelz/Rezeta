import { Controller, Get, Param, Query, Inject, ParseUUIDPipe } from '@nestjs/common'
import {
  ApiTags,
  ApiBearerAuth,
  ApiSecurity,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger'
import { AUTH_BEARER_SCHEME, AUTH_OAUTH2_SCHEME } from '../../lib/auth/index.js'
import type { ProtocolRecommendation, AuthUser } from '@rezeta/shared'
import { CurrentUser } from '../../common/decorators/current-user.decorator.js'
import { TenantId } from '../../common/decorators/tenant-id.decorator.js'
import { ProtocolRecommendationsService } from './protocol-recommendations.service.js'

@ApiTags('Protocol Recommendations')
@ApiBearerAuth(AUTH_BEARER_SCHEME)
@ApiSecurity(AUTH_OAUTH2_SCHEME)
@Controller('v1/patients/:patientId/protocol-recommendations')
export class ProtocolRecommendationsController {
  constructor(
    @Inject(ProtocolRecommendationsService)
    private readonly svc: ProtocolRecommendationsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List ranked protocol recommendations for a patient (gate screen)',
  })
  @ApiParam({ name: 'patientId', type: String, format: 'uuid' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200 })
  list(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Query('limit') rawLimit?: string,
  ): Promise<ProtocolRecommendation[]> {
    const parsed = rawLimit ? parseInt(rawLimit, 10) : 6
    const limit = Number.isFinite(parsed) ? Math.max(1, Math.min(20, parsed)) : 6
    return this.svc.getForPatient(tenantId, user.id, patientId, limit)
  }
}
