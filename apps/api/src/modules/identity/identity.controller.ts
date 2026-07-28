import { Controller, Get, HttpCode, HttpStatus, Inject, Post, Query, Res } from '@nestjs/common'
import type { Response } from 'express'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger'
import type { AuthUser, LoginEventItemDto, MfaSyncResultDto, SecuritySummaryDto, UserDeviceItemDto } from '@rezeta/shared'
import { AUTH_BEARER_SCHEME, AUTH_OAUTH2_SCHEME } from '../../lib/auth/index.js'
import { CurrentUser } from '../../common/decorators/current-user.decorator.js'
import { TenantId } from '../../common/decorators/tenant-id.decorator.js'
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js'
import { parseLimit } from '../../common/pagination/parse-limit.js'
import { IdentityService } from './identity.service.js'

@ApiTags('Identity')
@ApiBearerAuth(AUTH_BEARER_SCHEME)
@ApiSecurity(AUTH_OAUTH2_SCHEME)
@Controller('v1/identity')
export class IdentityController {
  constructor(@Inject(IdentityService) private svc: IdentityService) {}

  @Get('me/devices')
  @ApiOperation({ summary: 'List devices seen for the current user' })
  @ApiResponse({ status: 200 })
  myDevices(@CurrentUser() user: AuthUser): Promise<UserDeviceItemDto[]> {
    return this.svc.myDevices(user.id)
  }

  @Post('me/sign-out-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke all active sessions for the current user' })
  @ApiResponse({ status: 204 })
  async signOutAll(@CurrentUser() user: AuthUser): Promise<void> {
    await this.svc.signOutAllSessions(user)
  }

  @Post('me/mfa/sync')
  @ApiOperation({ summary: 'Sync the current user’s MFA enrollment state from the auth provider' })
  @ApiResponse({ status: 200 })
  syncMfa(@CurrentUser() user: AuthUser): Promise<MfaSyncResultDto> {
    return this.svc.syncMfaEnrollment(user)
  }

  @Get('security/summary')
  @RequirePermission('users', 'view')
  @ApiOperation({ summary: 'Tenant-scoped login telemetry summary' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  @ApiResponse({ status: 200 })
  summary(@TenantId() tenantId: string, @Query('days') days?: string): Promise<SecuritySummaryDto> {
    return this.svc.securitySummary(tenantId, days ? parseInt(days, 10) : undefined)
  }

  @Get('security/logins')
  @RequirePermission('users', 'view')
  @ApiOperation({ summary: 'Tenant login activity feed' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200 })
  logins(
    @TenantId() tenantId: string,
    @Query('days') days?: string,
    @Query('userId') userId?: string,
    @Query('limit') limit?: string,
  ): Promise<LoginEventItemDto[]> {
    return this.svc.listLogins(tenantId, {
      ...(days ? { days: parseInt(days, 10) } : {}),
      ...(userId ? { userId } : {}),
      limit: parseLimit(limit, { fallback: 50, max: 100 }),
    })
  }

  @Get('security/logins.csv')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('users', 'manage')
  @ApiOperation({ summary: 'Export tenant login activity as CSV' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  @ApiQuery({ name: 'userId', required: false })
  @ApiResponse({ status: 200, description: 'CSV file download' })
  async exportCsv(
    @TenantId() tenantId: string,
    @Query('days') days?: string,
    @Query('userId') userId?: string,
    @Res() res?: Response,
  ): Promise<void> {
    const csv = await this.svc.exportLoginsCsv(tenantId, {
      ...(days ? { days: parseInt(days, 10) } : {}),
      ...(userId ? { userId } : {}),
      limit: 1000,
    })
    const timestamp = new Date().toISOString().split('T')[0]
    res!.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="login-activity-${timestamp}.csv"`,
    })
    res!.end(csv)
  }
}
