import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UsePipes,
  ParseUUIDPipe,
  Inject,
  Res,
} from '@nestjs/common'
import type { Response } from 'express'
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiSecurity,
} from '@nestjs/swagger'
import { AUTH_BEARER_SCHEME, AUTH_OAUTH2_SCHEME } from '../../lib/auth/index.js'
import type { Patient } from '@rezeta/db'
import {
  CreatePatientSchema,
  UpdatePatientSchema,
  type CreatePatientDto,
  type UpdatePatientDto,
  type AuthUser,
} from '@rezeta/shared'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { CurrentUser } from '../../common/decorators/current-user.decorator.js'
import { TenantId } from '../../common/decorators/tenant-id.decorator.js'
import { parseLimit } from '../../common/pagination/parse-limit.js'
import { PatientsService } from './patients.service.js'
import { ConsultationRecordsService } from '../consultation-records/consultation-records.service.js'
import { PdfService } from '../../lib/pdf.service.js'
import { AuditLogService } from '../../common/audit-log/audit-log.service.js'
import { httpAuditContextStore } from '../../common/audit-log/audit-context.store.js'

const PATIENT_EXAMPLE = {
  id: '018e3f2a-1111-7000-8000-000000000001',
  tenantId: '018e3f2a-0000-7000-8000-000000000002',
  ownerUserId: '018e3f2a-0000-7000-8000-000000000001',
  firstName: 'Ana María',
  lastName: 'Reyes',
  dateOfBirth: '1982-03-15',
  sex: 'female',
  documentType: 'cedula',
  documentNumber: '001-1234567-8',
  phone: '+1-809-555-0123',
  email: 'ana.reyes@example.com',
  createdAt: '2026-04-01T10:00:00.000Z',
  updatedAt: '2026-04-01T10:00:00.000Z',
  deletedAt: null,
}

@ApiTags('Patients')
@ApiBearerAuth(AUTH_BEARER_SCHEME)
@ApiSecurity(AUTH_OAUTH2_SCHEME)
@Controller('v1/patients')
export class PatientsController {
  constructor(
    @Inject(PatientsService) private service: PatientsService,
    @Inject(ConsultationRecordsService) private recordsSvc: ConsultationRecordsService,
    @Inject(PdfService) private pdf: PdfService,
    @Inject(AuditLogService) private auditLog: AuditLogService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List patients',
    description: "Returns paginated patients belonging to the authenticated doctor's tenant.",
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Full-text search on name, document number, or email.',
    example: 'Ana',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: 'Pagination cursor from a previous response.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Page size (default 50, max 100).',
    example: '50',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated patient list.',
    schema: {
      type: 'object',
      properties: {
        items: { type: 'array', items: { type: 'object' } },
        hasMore: { type: 'boolean' },
        nextCursor: { type: 'string', nullable: true },
      },
    },
  })
  list(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Query('search') search?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ): Promise<{ items: Patient[]; hasMore: boolean; nextCursor?: string }> {
    return this.service.list({
      tenantId,
      ownerId: user.id,
      ...(search ? { search } : {}),
      ...(cursor ? { cursor } : {}),
      limit: parseLimit(limit),
    })
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a patient by ID' })
  @ApiParam({ name: 'id', format: 'uuid', example: '018e3f2a-1111-7000-8000-000000000001' })
  @ApiResponse({
    status: 200,
    description: 'Patient record.',
    schema: { type: 'object', example: PATIENT_EXAMPLE },
  })
  @ApiResponse({ status: 404, description: 'Patient not found.' })
  getOne(@Param('id', ParseUUIDPipe) id: string, @TenantId() tenantId: string): Promise<Patient> {
    return this.service.getById(id, tenantId)
  }

  @Post()
  @UsePipes(new ZodValidationPipe(CreatePatientSchema))
  @ApiOperation({ summary: 'Create a patient' })
  @ApiBody({
    description: 'Patient demographics.',
    schema: {
      type: 'object',
      required: ['firstName', 'lastName'],
      properties: {
        firstName: { type: 'string', example: 'Ana María' },
        lastName: { type: 'string', example: 'Reyes' },
        dateOfBirth: { type: 'string', format: 'date', example: '1982-03-15' },
        sex: { type: 'string', enum: ['male', 'female', 'other'], example: 'female' },
        documentType: { type: 'string', enum: ['cedula', 'passport', 'rnc'], example: 'cedula' },
        documentNumber: { type: 'string', example: '001-1234567-8' },
        phone: { type: 'string', example: '+1-809-555-0123' },
        email: { type: 'string', format: 'email', example: 'ana.reyes@example.com' },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Patient created.',
    schema: { type: 'object', example: PATIENT_EXAMPLE },
  })
  create(
    @Body() dto: CreatePatientDto,
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<Patient> {
    return this.service.create(tenantId, user.id, dto)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a patient' })
  @ApiParam({ name: 'id', format: 'uuid', example: '018e3f2a-1111-7000-8000-000000000001' })
  @ApiBody({
    description: 'Fields to update (all optional).',
    schema: {
      type: 'object',
      properties: {
        firstName: { type: 'string', example: 'Ana María' },
        lastName: { type: 'string', example: 'Reyes' },
        phone: { type: 'string', example: '+1-809-555-9999' },
        email: { type: 'string', format: 'email', example: 'ana.updated@example.com' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Updated patient.',
    schema: { type: 'object', example: PATIENT_EXAMPLE },
  })
  @ApiResponse({ status: 404, description: 'Patient not found.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdatePatientSchema)) dto: UpdatePatientDto,
    @TenantId() tenantId: string,
  ): Promise<Patient> {
    return this.service.update(id, tenantId, dto)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a patient' })
  @ApiParam({ name: 'id', format: 'uuid', example: '018e3f2a-1111-7000-8000-000000000001' })
  @ApiResponse({ status: 204, description: 'Patient soft-deleted.' })
  @ApiResponse({ status: 404, description: 'Patient not found.' })
  remove(@Param('id', ParseUUIDPipe) id: string, @TenantId() tenantId: string): Promise<void> {
    return this.service.remove(id, tenantId)
  }

  @Get(':id/record-export')
  @ApiOperation({ summary: 'Download the patient expediente (all signed records) as PDF' })
  @ApiParam({ name: 'id', format: 'uuid', example: '018e3f2a-1111-7000-8000-000000000001' })
  @ApiResponse({ status: 200, description: 'PDF buffer' })
  @ApiResponse({ status: 404, description: 'PATIENT_NOT_FOUND' })
  async recordExport(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const data = await this.recordsSvc.getExpedienteData(id, tenantId)
    const buffer = await this.pdf.generateExpediente(data)
    this.auditExport(tenantId, id)
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="expediente-${id}.pdf"`,
      'Content-Length': String(buffer.length),
    })
    res.end(buffer)
  }

  /** Non-fatal audit write for a clinical-data PDF download (spec §4 export auditing). */
  private auditExport(tenantId: string, patientId: string): void {
    const httpCtx = httpAuditContextStore.getStore()
    void this.auditLog.record({
      tenantId,
      ...(httpCtx?.actorUserId ? { actorUserId: httpCtx.actorUserId } : {}),
      actorType: httpCtx ? 'user' : 'system',
      category: 'system',
      action: 'export_generated',
      entityType: 'Patient',
      entityId: patientId,
      status: 'success',
    })
  }
}
