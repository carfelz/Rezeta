import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  Inject,
  ParseUUIDPipe,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UsePipes,
  Res,
} from '@nestjs/common'
import type { Response } from 'express'
import { ApiTags, ApiBearerAuth, ApiSecurity, ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger'
import { AUTH_BEARER_SCHEME, AUTH_OAUTH2_SCHEME } from '../../lib/auth/index.js'
import type {
  ConsultationRecordDto,
  AuthUser,
  UpdateRecordSectionsDto,
  RecordVersionSummary,
} from '@rezeta/shared'
import { UpdateRecordSectionsSchema } from '@rezeta/shared'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { ParsePositiveIntPipe } from '../../common/pipes/parse-positive-int.pipe.js'
import { CurrentUser } from '../../common/decorators/current-user.decorator.js'
import { TenantId } from '../../common/decorators/tenant-id.decorator.js'
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js'
import { ConsultationRecordsService } from './consultation-records.service.js'
import { PdfService } from '../../lib/pdf.service.js'
import { AuditLogService } from '../../common/audit-log/audit-log.service.js'
import { httpAuditContextStore } from '../../common/audit-log/audit-context.store.js'

@ApiTags('Consultation Records')
@ApiBearerAuth(AUTH_BEARER_SCHEME)
@ApiSecurity(AUTH_OAUTH2_SCHEME)
@Controller('v1/consultations/:consultationId/record')
export class ConsultationRecordsController {
  constructor(
    @Inject(ConsultationRecordsService) private svc: ConsultationRecordsService,
    @Inject(PdfService) private pdf: PdfService,
    @Inject(AuditLogService) private auditLog: AuditLogService,
  ) {}

  @RequirePermission('consultations', 'view')
  @Get()
  @ApiOperation({ summary: 'Get the latest consultation record (historia médica)' })
  @ApiParam({ name: 'consultationId', type: String, format: 'uuid' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'RECORD_NOT_FOUND' })
  get(
    @TenantId() tenantId: string,
    @Param('consultationId', ParseUUIDPipe) consultationId: string,
  ): Promise<ConsultationRecordDto> {
    return this.svc.getLatest(consultationId, tenantId)
  }

  @RequirePermission('consultations', 'manage')
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ensure a draft record exists for this consultation' })
  @ApiParam({ name: 'consultationId', type: String, format: 'uuid' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 409, description: 'RECORD_CONSULTATION_NOT_SIGNED' })
  create(
    @TenantId() tenantId: string,
    @Param('consultationId', ParseUUIDPipe) consultationId: string,
  ): Promise<ConsultationRecordDto> {
    return this.svc.ensureDraft(consultationId, tenantId)
  }

  @RequirePermission('consultations', 'manage')
  @Patch()
  @UsePipes(new ZodValidationPipe(UpdateRecordSectionsSchema))
  @ApiOperation({ summary: 'Update draft record sections' })
  @ApiParam({ name: 'consultationId', type: String, format: 'uuid' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 409, description: 'RECORD_NOT_DRAFT' })
  update(
    @TenantId() tenantId: string,
    @Param('consultationId', ParseUUIDPipe) consultationId: string,
    @Body() dto: UpdateRecordSectionsDto,
  ): Promise<ConsultationRecordDto> {
    return this.svc.updateSections(consultationId, tenantId, dto)
  }

  @RequirePermission('consultations', 'manage')
  @Post('regenerate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Regenerate record sections from current consultation content' })
  @ApiParam({ name: 'consultationId', type: String, format: 'uuid' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 409, description: 'RECORD_ALREADY_SIGNED' })
  regenerate(
    @TenantId() tenantId: string,
    @Param('consultationId', ParseUUIDPipe) consultationId: string,
  ): Promise<ConsultationRecordDto> {
    return this.svc.regenerate(consultationId, tenantId)
  }

  @RequirePermission('consultations', 'manage')
  @Post('sign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign the draft record (makes it immutable)' })
  @ApiParam({ name: 'consultationId', type: String, format: 'uuid' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 400, description: 'RECORD_REQUIRED_SECTIONS_MISSING' })
  @ApiResponse({ status: 409, description: 'RECORD_ALREADY_SIGNED' })
  sign(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('consultationId', ParseUUIDPipe) consultationId: string,
  ): Promise<ConsultationRecordDto> {
    return this.svc.sign(consultationId, tenantId, user.id)
  }

  @RequirePermission('consultations', 'view')
  @Get('versions')
  @ApiOperation({ summary: 'List the version history of the consultation record' })
  @ApiParam({ name: 'consultationId', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Ordered versionNumber desc; empty array when no record exists' })
  getVersions(
    @TenantId() tenantId: string,
    @Param('consultationId', ParseUUIDPipe) consultationId: string,
  ): Promise<RecordVersionSummary[]> {
    return this.svc.listVersions(consultationId, tenantId)
  }

  @RequirePermission('consultations', 'view')
  @Get('versions/:versionNumber')
  @ApiOperation({ summary: 'Get a specific consultation record version' })
  @ApiParam({ name: 'consultationId', type: String, format: 'uuid' })
  @ApiParam({ name: 'versionNumber', type: Number })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'RECORD_NOT_FOUND' })
  getVersion(
    @TenantId() tenantId: string,
    @Param('consultationId', ParseUUIDPipe) consultationId: string,
    @Param('versionNumber', ParseIntPipe) versionNumber: number,
  ): Promise<ConsultationRecordDto> {
    return this.svc.getVersion(consultationId, tenantId, versionNumber)
  }

  @RequirePermission('consultations', 'view')
  @Get('pdf')
  @ApiOperation({ summary: 'Download the consultation record as PDF (latest, or a specific version)' })
  @ApiParam({ name: 'consultationId', type: String, format: 'uuid' })
  @ApiQuery({ name: 'version', type: Number, required: false })
  @ApiResponse({ status: 200, description: 'PDF buffer' })
  @ApiResponse({ status: 400, description: 'VALIDATION_ERROR' })
  @ApiResponse({ status: 404, description: 'RECORD_NOT_FOUND' })
  async pdfDownload(
    @TenantId() tenantId: string,
    @Param('consultationId', ParseUUIDPipe) consultationId: string,
    @Query('version', new ParsePositiveIntPipe()) version: number | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const data = await this.svc.getPdfData(consultationId, tenantId, version)
    const buffer = await this.pdf.generateHistoriaMedica(data)
    this.auditExport(tenantId, consultationId)
    const filename =
      version === undefined ? `historia-${consultationId}.pdf` : `historia-${consultationId}-v${version}.pdf`
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buffer.length),
    })
    res.end(buffer)
  }

  /** Non-fatal audit write for a clinical-data PDF download (spec §4 export auditing). */
  private auditExport(tenantId: string, consultationId: string): void {
    const httpCtx = httpAuditContextStore.getStore()
    void this.auditLog.record({
      tenantId,
      ...(httpCtx?.actorUserId ? { actorUserId: httpCtx.actorUserId } : {}),
      actorType: httpCtx ? 'user' : 'system',
      category: 'communication',
      action: 'pdf_generated',
      entityType: 'ConsultationRecord',
      entityId: consultationId,
      status: 'success',
    })
  }
}
