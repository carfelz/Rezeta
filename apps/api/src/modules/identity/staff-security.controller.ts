import { Controller, Get, Inject } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger'
import type { StaffSecurityOverviewDto } from '@rezeta/shared'
import { AUTH_BEARER_SCHEME, AUTH_OAUTH2_SCHEME } from '../../lib/auth/index.js'
import { PlatformRoute } from '../../common/decorators/platform-route.decorator.js'
import { StaffSecurityService } from './staff-security.service.js'

@ApiTags('Staff')
@ApiBearerAuth(AUTH_BEARER_SCHEME)
@ApiSecurity(AUTH_OAUTH2_SCHEME)
@PlatformRoute()
@Controller('v1/staff/identity/security')
export class StaffSecurityController {
  constructor(@Inject(StaffSecurityService) private svc: StaffSecurityService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Cross-institution security metrics for the staff console' })
  @ApiResponse({ status: 200 })
  overview(): Promise<StaffSecurityOverviewDto> {
    return this.svc.overview()
  }
}
