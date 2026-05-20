import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  Inject,
  ParseUUIDPipe,
  ParseIntPipe,
  UsePipes,
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
import { AUTH_BEARER_SCHEME, AUTH_OAUTH2_SCHEME } from '../../lib/auth/index.js'
import type { Prescription, ImagingOrder, LabOrder } from '@rezeta/shared'
import {
  CreatePrescriptionGroupSchema,
  CreateImagingOrderGroupSchema,
  CreateLabOrderGroupSchema,
  GenerateAllOrdersSchema,
  PatchImagingOrderSchema,
  PatchLabOrderSchema,
  RenameOrderGroupSchema,
  type CreatePrescriptionGroupDto,
  type CreateImagingOrderGroupDto,
  type CreateLabOrderGroupDto,
  type GenerateAllOrdersDto,
  type PatchImagingOrderDto,
  type PatchLabOrderDto,
  type RenameOrderGroupDto,
} from '@rezeta/shared'
import type { AuthUser } from '@rezeta/shared'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { CurrentUser } from '../../common/decorators/current-user.decorator.js'
import { TenantId } from '../../common/decorators/tenant-id.decorator.js'
import { OrdersService, type GenerateAllOrdersResult } from './orders.service.js'

@ApiTags('Orders')
@ApiBearerAuth(AUTH_BEARER_SCHEME)
@ApiSecurity(AUTH_OAUTH2_SCHEME)
@Controller('v1/consultations/:consultationId')
export class OrdersController {
  constructor(@Inject(OrdersService) private svc: OrdersService) {}

  // ── Prescriptions ──────────────────────────────────────────────────────────

  @Get('prescriptions')
  @ApiOperation({ summary: 'List prescriptions for consultation' })
  @ApiParam({ name: 'consultationId', type: String, format: 'uuid' })
  @ApiResponse({ status: 200 })
  listPrescriptions(
    @TenantId() tenantId: string,
    @Param('consultationId', ParseUUIDPipe) consultationId: string,
  ): Promise<Prescription[]> {
    return this.svc.listPrescriptions(consultationId, tenantId)
  }

  @Get('prescriptions/:prescriptionId/pdf')
  @ApiOperation({ summary: 'Download prescription as PDF' })
  @ApiParam({ name: 'consultationId', type: String, format: 'uuid' })
  @ApiParam({ name: 'prescriptionId', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'PDF buffer' })
  @ApiResponse({ status: 404, description: 'PRESCRIPTION_NOT_FOUND' })
  async downloadPrescriptionPdf(
    @TenantId() tenantId: string,
    @Param('consultationId', ParseUUIDPipe) consultationId: string,
    @Param('prescriptionId', ParseUUIDPipe) prescriptionId: string,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.svc.getPrescriptionPdf(consultationId, prescriptionId, tenantId)
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="receta-${prescriptionId}.pdf"`,
      'Content-Length': String(buffer.length),
    })
    res.end(buffer)
  }

  @Get('prescriptions/:prescriptionId')
  @ApiOperation({ summary: 'Get prescription by ID' })
  @ApiParam({ name: 'consultationId', type: String, format: 'uuid' })
  @ApiParam({ name: 'prescriptionId', type: String, format: 'uuid' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'PRESCRIPTION_NOT_FOUND' })
  getPrescription(
    @TenantId() tenantId: string,
    @Param('consultationId', ParseUUIDPipe) consultationId: string,
    @Param('prescriptionId', ParseUUIDPipe) prescriptionId: string,
  ): Promise<Prescription> {
    return this.svc.getPrescription(consultationId, prescriptionId, tenantId)
  }

  @Post('prescriptions')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(CreatePrescriptionGroupSchema))
  @ApiOperation({ summary: 'Create a prescription group for this consultation' })
  @ApiParam({ name: 'consultationId', type: String, format: 'uuid' })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 404, description: 'CONSULTATION_NOT_FOUND' })
  createPrescription(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('consultationId', ParseUUIDPipe) consultationId: string,
    @Body() dto: CreatePrescriptionGroupDto,
  ): Promise<Prescription> {
    return this.svc.createPrescription(consultationId, tenantId, user.id, dto)
  }

  @Delete('prescriptions/:prescriptionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a prescription' })
  @ApiParam({ name: 'consultationId', type: String, format: 'uuid' })
  @ApiParam({ name: 'prescriptionId', type: String, format: 'uuid' })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 404, description: 'PRESCRIPTION_NOT_FOUND' })
  deletePrescription(
    @TenantId() tenantId: string,
    @Param('consultationId', ParseUUIDPipe) consultationId: string,
    @Param('prescriptionId', ParseUUIDPipe) prescriptionId: string,
  ): Promise<void> {
    return this.svc.deletePrescription(consultationId, prescriptionId, tenantId)
  }

  // ── Imaging orders ─────────────────────────────────────────────────────────

  @Get('imaging-orders')
  @ApiOperation({ summary: 'List imaging orders for consultation' })
  @ApiParam({ name: 'consultationId', type: String, format: 'uuid' })
  @ApiResponse({ status: 200 })
  listImagingOrders(
    @TenantId() tenantId: string,
    @Param('consultationId', ParseUUIDPipe) consultationId: string,
  ): Promise<ImagingOrder[]> {
    return this.svc.listImagingOrders(consultationId, tenantId)
  }

  @Get('imaging-orders/:orderId')
  @ApiOperation({ summary: 'Get imaging order by ID' })
  @ApiParam({ name: 'consultationId', type: String, format: 'uuid' })
  @ApiParam({ name: 'orderId', type: String, format: 'uuid' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'IMAGING_ORDER_NOT_FOUND' })
  getImagingOrder(
    @TenantId() tenantId: string,
    @Param('consultationId', ParseUUIDPipe) consultationId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ): Promise<ImagingOrder> {
    return this.svc.getImagingOrder(consultationId, orderId, tenantId)
  }

  @Post('imaging-orders')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(CreateImagingOrderGroupSchema))
  @ApiOperation({ summary: 'Create an imaging order group for this consultation' })
  @ApiParam({ name: 'consultationId', type: String, format: 'uuid' })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 404, description: 'CONSULTATION_NOT_FOUND' })
  createImagingOrder(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('consultationId', ParseUUIDPipe) consultationId: string,
    @Body() dto: CreateImagingOrderGroupDto,
  ): Promise<ImagingOrder[]> {
    return this.svc.createImagingOrder(consultationId, tenantId, user.id, dto)
  }

  @Get('imaging-orders/group-pdf')
  @ApiOperation({ summary: 'Download imaging order group as PDF' })
  @ApiParam({ name: 'consultationId', type: String, format: 'uuid' })
  @ApiQuery({ name: 'groupOrder', type: Number })
  @ApiResponse({ status: 200, description: 'PDF buffer' })
  @ApiResponse({ status: 404, description: 'IMAGING_ORDER_NOT_FOUND' })
  async downloadImagingOrderGroupPdf(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('consultationId', ParseUUIDPipe) consultationId: string,
    @Query('groupOrder', ParseIntPipe) groupOrder: number,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.svc.getImagingOrderGroupPdf(
      consultationId,
      groupOrder,
      tenantId,
      user.id,
    )
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="imagenes-${consultationId}-g${groupOrder}.pdf"`,
      'Content-Length': String(buffer.length),
    })
    res.end(buffer)
  }

  @Patch('imaging-orders/rename-group')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(RenameOrderGroupSchema))
  @ApiOperation({ summary: 'Rename an imaging order group' })
  @ApiParam({ name: 'consultationId', type: String, format: 'uuid' })
  @ApiQuery({ name: 'groupOrder', type: Number })
  @ApiResponse({ status: 200 })
  renameImagingOrderGroup(
    @TenantId() tenantId: string,
    @Param('consultationId', ParseUUIDPipe) consultationId: string,
    @Query('groupOrder', ParseIntPipe) groupOrder: number,
    @Body() dto: RenameOrderGroupDto,
  ): Promise<ImagingOrder[]> {
    return this.svc.renameImagingOrderGroup(consultationId, groupOrder, tenantId, dto)
  }

  @Patch('imaging-orders/:orderId')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(PatchImagingOrderSchema))
  @ApiOperation({ summary: 'Move imaging order to a different group' })
  @ApiParam({ name: 'consultationId', type: String, format: 'uuid' })
  @ApiParam({ name: 'orderId', type: String, format: 'uuid' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'IMAGING_ORDER_NOT_FOUND' })
  patchImagingOrder(
    @TenantId() tenantId: string,
    @Param('consultationId', ParseUUIDPipe) consultationId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: PatchImagingOrderDto,
  ): Promise<ImagingOrder> {
    return this.svc.patchImagingOrder(consultationId, orderId, tenantId, dto)
  }

  @Delete('imaging-orders/:orderId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an imaging order' })
  @ApiParam({ name: 'consultationId', type: String, format: 'uuid' })
  @ApiParam({ name: 'orderId', type: String, format: 'uuid' })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 404, description: 'IMAGING_ORDER_NOT_FOUND' })
  deleteImagingOrder(
    @TenantId() tenantId: string,
    @Param('consultationId', ParseUUIDPipe) consultationId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ): Promise<void> {
    return this.svc.deleteImagingOrder(consultationId, orderId, tenantId)
  }

  // ── Lab orders ─────────────────────────────────────────────────────────────

  @Get('lab-orders')
  @ApiOperation({ summary: 'List lab orders for consultation' })
  @ApiParam({ name: 'consultationId', type: String, format: 'uuid' })
  @ApiResponse({ status: 200 })
  listLabOrders(
    @TenantId() tenantId: string,
    @Param('consultationId', ParseUUIDPipe) consultationId: string,
  ): Promise<LabOrder[]> {
    return this.svc.listLabOrders(consultationId, tenantId)
  }

  @Get('lab-orders/:orderId')
  @ApiOperation({ summary: 'Get lab order by ID' })
  @ApiParam({ name: 'consultationId', type: String, format: 'uuid' })
  @ApiParam({ name: 'orderId', type: String, format: 'uuid' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'LAB_ORDER_NOT_FOUND' })
  getLabOrder(
    @TenantId() tenantId: string,
    @Param('consultationId', ParseUUIDPipe) consultationId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ): Promise<LabOrder> {
    return this.svc.getLabOrder(consultationId, orderId, tenantId)
  }

  @Post('lab-orders')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(CreateLabOrderGroupSchema))
  @ApiOperation({ summary: 'Create a lab order group for this consultation' })
  @ApiParam({ name: 'consultationId', type: String, format: 'uuid' })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 404, description: 'CONSULTATION_NOT_FOUND' })
  createLabOrder(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('consultationId', ParseUUIDPipe) consultationId: string,
    @Body() dto: CreateLabOrderGroupDto,
  ): Promise<LabOrder[]> {
    return this.svc.createLabOrder(consultationId, tenantId, user.id, dto)
  }

  @Get('lab-orders/group-pdf')
  @ApiOperation({ summary: 'Download lab order group as PDF' })
  @ApiParam({ name: 'consultationId', type: String, format: 'uuid' })
  @ApiQuery({ name: 'groupOrder', type: Number })
  @ApiResponse({ status: 200, description: 'PDF buffer' })
  @ApiResponse({ status: 404, description: 'LAB_ORDER_NOT_FOUND' })
  async downloadLabOrderGroupPdf(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('consultationId', ParseUUIDPipe) consultationId: string,
    @Query('groupOrder', ParseIntPipe) groupOrder: number,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.svc.getLabOrderGroupPdf(consultationId, groupOrder, tenantId, user.id)
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="laboratorio-${consultationId}-g${groupOrder}.pdf"`,
      'Content-Length': String(buffer.length),
    })
    res.end(buffer)
  }

  @Patch('lab-orders/rename-group')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(RenameOrderGroupSchema))
  @ApiOperation({ summary: 'Rename a lab order group' })
  @ApiParam({ name: 'consultationId', type: String, format: 'uuid' })
  @ApiQuery({ name: 'groupOrder', type: Number })
  @ApiResponse({ status: 200 })
  renameLabOrderGroup(
    @TenantId() tenantId: string,
    @Param('consultationId', ParseUUIDPipe) consultationId: string,
    @Query('groupOrder', ParseIntPipe) groupOrder: number,
    @Body() dto: RenameOrderGroupDto,
  ): Promise<LabOrder[]> {
    return this.svc.renameLabOrderGroup(consultationId, groupOrder, tenantId, dto)
  }

  @Patch('lab-orders/:orderId')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(PatchLabOrderSchema))
  @ApiOperation({ summary: 'Move lab order to a different group' })
  @ApiParam({ name: 'consultationId', type: String, format: 'uuid' })
  @ApiParam({ name: 'orderId', type: String, format: 'uuid' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'LAB_ORDER_NOT_FOUND' })
  patchLabOrder(
    @TenantId() tenantId: string,
    @Param('consultationId', ParseUUIDPipe) consultationId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: PatchLabOrderDto,
  ): Promise<LabOrder> {
    return this.svc.patchLabOrder(consultationId, orderId, tenantId, dto)
  }

  @Delete('lab-orders/:orderId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a lab order' })
  @ApiParam({ name: 'consultationId', type: String, format: 'uuid' })
  @ApiParam({ name: 'orderId', type: String, format: 'uuid' })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 404, description: 'LAB_ORDER_NOT_FOUND' })
  deleteLabOrder(
    @TenantId() tenantId: string,
    @Param('consultationId', ParseUUIDPipe) consultationId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ): Promise<void> {
    return this.svc.deleteLabOrder(consultationId, orderId, tenantId)
  }

  // ── Generate all ───────────────────────────────────────────────────────────

  @Post('orders/generate-all')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(GenerateAllOrdersSchema))
  @ApiOperation({ summary: 'Create all order types in a single request' })
  @ApiParam({ name: 'consultationId', type: String, format: 'uuid' })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 404, description: 'CONSULTATION_NOT_FOUND' })
  generateAll(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('consultationId', ParseUUIDPipe) consultationId: string,
    @Body() dto: GenerateAllOrdersDto,
  ): Promise<GenerateAllOrdersResult> {
    return this.svc.generateAll(consultationId, tenantId, user.id, dto)
  }
}
