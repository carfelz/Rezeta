import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Inject,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UsePipes,
  Res,
} from '@nestjs/common'
import type { Response } from 'express'
import { ApiTags, ApiBearerAuth, ApiSecurity, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger'
import { AUTH_BEARER_SCHEME, AUTH_OAUTH2_SCHEME } from '../../lib/auth/index.js'
import type { ConsultationRecordDto, AuthUser, UpdateRecordSectionsDto } from '@rezeta/shared'
import { UpdateRecordSectionsSchema } from '@rezeta/shared'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { CurrentUser } from '../../common/decorators/current-user.decorator.js'
import { TenantId } from '../../common/decorators/tenant-id.decorator.js'
import { ConsultationRecordsService } from './consultation-records.service.js'
import { PdfService } from '../../lib/pdf.service.js'

@ApiTags('Consultation Records')
@ApiBearerAuth(AUTH_BEARER_SCHEME)
@ApiSecurity(AUTH_OAUTH2_SCHEME)
@Controller('v1/consultations/:consultationId/record')
export class ConsultationRecordsController {
  constructor(
    @Inject(ConsultationRecordsService) private svc: ConsultationRecordsService,
    @Inject(PdfService) private pdf: PdfService,
  ) {}

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

  @Get('pdf')
  @ApiOperation({ summary: 'Download the latest consultation record as PDF' })
  @ApiParam({ name: 'consultationId', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'PDF buffer' })
  @ApiResponse({ status: 404, description: 'RECORD_NOT_FOUND' })
  async pdfDownload(
    @TenantId() tenantId: string,
    @Param('consultationId', ParseUUIDPipe) consultationId: string,
    @Res() res: Response,
  ): Promise<void> {
    const data = await this.svc.getPdfData(consultationId, tenantId)
    const buffer = await this.pdf.generateHistoriaMedica(data)
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="historia-${consultationId}.pdf"`,
      'Content-Length': String(buffer.length),
    })
    res.end(buffer)
  }
}
