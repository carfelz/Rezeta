import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  Inject,
  ParseUUIDPipe,
  UsePipes,
} from '@nestjs/common'
import {
  ApiTags,
  ApiBearerAuth,
  ApiSecurity,
  ApiOperation,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger'
import type { Prescription, ImagingOrder, LabOrder } from '@rezeta/shared'
import {
  CreatePrescriptionGroupSchema,
  CreateImagingOrderGroupSchema,
  CreateLabOrderGroupSchema,
  GenerateAllOrdersSchema,
  type CreatePrescriptionGroupDto,
  type CreateImagingOrderGroupDto,
  type CreateLabOrderGroupDto,
  type GenerateAllOrdersDto,
} from '@rezeta/shared'
import type { AuthUser } from '@rezeta/shared'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { CurrentUser } from '../../common/decorators/current-user.decorator.js'
import { TenantId } from '../../common/decorators/tenant-id.decorator.js'
import { OrdersService, type GenerateAllOrdersResult } from './orders.service.js'

@ApiTags('Orders')
@ApiBearerAuth('firebase-jwt')
@ApiSecurity('firebase-oauth2')
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
