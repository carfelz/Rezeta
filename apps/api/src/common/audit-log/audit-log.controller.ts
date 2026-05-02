import {
  Controller,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
  Inject,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import type { Response } from 'express'
import {
  ApiTags,
  ApiBearerAuth,
  ApiSecurity,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger'
import type { AuditLogItem, AuditLogListResponse } from '@rezeta/shared'
import { TenantId } from '../decorators/tenant-id.decorator.js'
import { AuditLogService } from './audit-log.service.js'
import type { AuditLogFilters } from './audit-log.types.js'

@ApiTags('Audit Logs')
@ApiBearerAuth('firebase-jwt')
@ApiSecurity('firebase-oauth2')
@Controller('v1/audit-logs')
export class AuditLogController {
  constructor(@Inject(AuditLogService) private readonly svc: AuditLogService) {}

  @Get()
  @ApiOperation({ summary: 'List audit log events (plan-aware retention)' })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  @ApiQuery({ name: 'actorUserId', required: false })
  @ApiQuery({
    name: 'category',
    required: false,
    enum: ['entity', 'auth', 'communication', 'system'],
  })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'entityType', required: false })
  @ApiQuery({ name: 'entityId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ['success', 'failed'] })
  @ApiResponse({ status: 200 })
  list(
    @TenantId() tenantId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limitStr?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('actorUserId') actorUserId?: string,
    @Query('category') category?: string,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('status') status?: string,
  ): Promise<AuditLogListResponse> {
    const filters: AuditLogFilters = {
      tenantId,
      ...(cursor ? { cursor } : {}),
      ...(limitStr ? { limit: parseInt(limitStr, 10) } : {}),
      ...(dateFrom ? { fromDate: new Date(dateFrom) } : {}),
      ...(dateTo ? { toDate: new Date(dateTo) } : {}),
      ...(actorUserId ? { actorUserId } : {}),
      ...(category ? { category: category as NonNullable<AuditLogFilters['category']> } : {}),
      ...(action ? { action: action as NonNullable<AuditLogFilters['action']> } : {}),
      ...(entityType ? { entityType } : {}),
      ...(entityId ? { entityId } : {}),
      ...(status ? { status: status as NonNullable<AuditLogFilters['status']> } : {}),
    }
    return this.svc.list(filters)
  }

  @Get('export.csv')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Export audit log as CSV (Clinic plan only)' })
  @ApiResponse({ status: 200, description: 'CSV file download' })
  @ApiResponse({ status: 403, description: 'Requires Clinic plan' })
  async exportCsv(
    @TenantId() tenantId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('actorUserId') actorUserId?: string,
    @Query('category') category?: string,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('status') status?: string,
    @Res() res?: Response,
  ): Promise<void> {
    const csv = await this.svc.exportCsv(tenantId, {
      ...(dateFrom ? { fromDate: new Date(dateFrom) } : {}),
      ...(dateTo ? { toDate: new Date(dateTo) } : {}),
      ...(actorUserId ? { actorUserId } : {}),
      ...(category ? { category: category as NonNullable<AuditLogFilters['category']> } : {}),
      ...(action ? { action: action as NonNullable<AuditLogFilters['action']> } : {}),
      ...(entityType ? { entityType } : {}),
      ...(entityId ? { entityId } : {}),
      ...(status ? { status: status as NonNullable<AuditLogFilters['status']> } : {}),
    })

    const timestamp = new Date().toISOString().split('T')[0]
    res!.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="audit-log-${timestamp}.csv"`,
    })
    res!.end(csv)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get audit log event by ID' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  getById(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AuditLogItem> {
    return this.svc.getById(id, tenantId)
  }
}
