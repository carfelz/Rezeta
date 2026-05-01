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
  ApiBearerAuth,
  ApiSecurity,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger'
import {
  CreateInvoiceSchema,
  UpdateInvoiceSchema,
  UpdateInvoiceStatusSchema,
  type CreateInvoiceDto,
  type UpdateInvoiceDto,
  type UpdateInvoiceStatusDto,
  type AuthUser,
  type InvoiceWithDetails,
} from '@rezeta/shared'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { CurrentUser } from '../../common/decorators/current-user.decorator.js'
import { TenantId } from '../../common/decorators/tenant-id.decorator.js'
import { InvoicesService } from './invoices.service.js'

interface InvoiceListResult {
  items: InvoiceWithDetails[]
  hasMore: boolean
  nextCursor: string | undefined
}

@ApiTags('Invoices')
@ApiBearerAuth('firebase-jwt')
@ApiSecurity('firebase-oauth2')
@Controller('v1/invoices')
export class InvoicesController {
  constructor(@Inject(InvoicesService) private svc: InvoicesService) {}

  @Get()
  @ApiOperation({ summary: 'List invoices' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'patientId', required: false })
  @ApiQuery({ name: 'locationId', required: false })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200 })
  list(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Query('status') status?: string,
    @Query('patientId') patientId?: string,
    @Query('locationId') locationId?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ): Promise<InvoiceListResult> {
    return this.svc.list({
      tenantId,
      userId: user.id,
      status,
      patientId,
      locationId,
      cursor,
      limit: limit ? parseInt(limit, 10) : undefined,
    })
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Download invoice as PDF' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'PDF buffer' })
  @ApiResponse({ status: 404 })
  async downloadPdf(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.svc.getInvoicePdf(id, tenantId)
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="factura-${id}.pdf"`,
      'Content-Length': String(buffer.length),
    })
    res.end(buffer)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get invoice by ID' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  getById(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<InvoiceWithDetails> {
    return this.svc.getById(id, tenantId)
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(CreateInvoiceSchema))
  @ApiOperation({ summary: 'Create invoice' })
  @ApiResponse({ status: 201 })
  create(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateInvoiceDto,
  ): Promise<InvoiceWithDetails> {
    return this.svc.create(tenantId, user.id, dto)
  }

  @Patch(':id')
  @UsePipes(new ZodValidationPipe(UpdateInvoiceSchema))
  @ApiOperation({ summary: 'Update draft invoice' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200 })
  update(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInvoiceDto,
  ): Promise<InvoiceWithDetails> {
    return this.svc.update(id, tenantId, dto)
  }

  @Patch(':id/status')
  @UsePipes(new ZodValidationPipe(UpdateInvoiceStatusSchema))
  @ApiOperation({ summary: 'Transition invoice status' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200 })
  updateStatus(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInvoiceStatusDto,
  ): Promise<InvoiceWithDetails> {
    return this.svc.updateStatus(id, tenantId, dto)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete draft invoice (soft delete)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 204 })
  delete(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.svc.delete(id, tenantId)
  }
}
