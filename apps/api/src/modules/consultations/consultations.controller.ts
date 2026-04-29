import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
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
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger'
import type { ConsultationWithDetails, ConsultationProtocolUsage, AuthUser } from '@rezeta/shared'
import {
  CreateConsultationSchema,
  UpdateConsultationSchema,
  AmendConsultationSchema,
  AddProtocolUsageSchema,
  UpdateCheckedStateSchema,
  UpdateProtocolUsageSchema,
  type CreateConsultationDto,
  type UpdateConsultationDto,
  type AmendConsultationDto,
  type AddProtocolUsageDto,
  type UpdateCheckedStateDto,
  type UpdateProtocolUsageDto,
} from '@rezeta/shared'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { CurrentUser } from '../../common/decorators/current-user.decorator.js'
import { TenantId } from '../../common/decorators/tenant-id.decorator.js'
import { ConsultationsService } from './consultations.service.js'

@ApiTags('Consultations')
@ApiBearerAuth('firebase-jwt')
@ApiSecurity('firebase-oauth2')
@Controller('v1/consultations')
export class ConsultationsController {
  constructor(@Inject(ConsultationsService) private svc: ConsultationsService) {}

  @Get()
  @ApiOperation({ summary: 'List consultations' })
  @ApiQuery({ name: 'patientId', required: false, type: String })
  @ApiQuery({ name: 'locationId', required: false, type: String })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiResponse({ status: 200 })
  list(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Query('patientId') patientId?: string,
    @Query('locationId') locationId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<ConsultationWithDetails[]> {
    return this.svc.list({
      tenantId,
      userId: user.id,
      ...(patientId ? { patientId } : {}),
      ...(locationId ? { locationId } : {}),
      ...(from ? { from: new Date(from) } : {}),
      ...(to ? { to: new Date(to) } : {}),
    })
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get consultation by ID' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'CONSULTATION_NOT_FOUND' })
  getById(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ConsultationWithDetails> {
    return this.svc.getById(id, tenantId)
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(CreateConsultationSchema))
  @ApiOperation({ summary: 'Create consultation (draft)' })
  @ApiResponse({ status: 201 })
  create(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateConsultationDto,
  ): Promise<ConsultationWithDetails> {
    return this.svc.create(tenantId, user.id, dto)
  }

  @Patch(':id')
  @UsePipes(new ZodValidationPipe(UpdateConsultationSchema))
  @ApiOperation({ summary: 'Update draft consultation' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 409, description: 'CONSULTATION_ALREADY_SIGNED' })
  update(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateConsultationDto,
  ): Promise<ConsultationWithDetails> {
    return this.svc.update(id, tenantId, dto)
  }

  @Post(':id/sign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign consultation (makes it immutable)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 409, description: 'CONSULTATION_ALREADY_SIGNED' })
  sign(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ConsultationWithDetails> {
    return this.svc.sign(id, tenantId, user.id)
  }

  @Post(':id/amend')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(AmendConsultationSchema))
  @ApiOperation({ summary: 'Add amendment to signed consultation' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 400, description: 'CONSULTATION_NOT_SIGNED' })
  amend(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AmendConsultationDto,
  ): Promise<ConsultationWithDetails> {
    return this.svc.amend(id, tenantId, user.id, dto)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete draft consultation (soft delete)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 409, description: 'CONSULTATION_ALREADY_SIGNED' })
  async remove(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.svc.remove(id, tenantId)
  }

  // ── Protocol usages ───────────────────────────────────────────────────────

  @Post(':id/protocols')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(AddProtocolUsageSchema))
  @ApiOperation({ summary: 'Attach a protocol to this consultation' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 404, description: 'PROTOCOL_NOT_FOUND' })
  @ApiResponse({ status: 400, description: 'PROTOCOL_HAS_NO_ACTIVE_VERSION' })
  addProtocol(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddProtocolUsageDto,
  ): Promise<ConsultationProtocolUsage> {
    return this.svc.addProtocolUsage(id, tenantId, user.id, dto)
  }

  @Get(':id/protocols/:usageId')
  @ApiOperation({ summary: 'Get a protocol usage by ID' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiParam({ name: 'usageId', type: String, format: 'uuid' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'PROTOCOL_USAGE_NOT_FOUND' })
  getProtocolUsage(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('usageId', ParseUUIDPipe) usageId: string,
  ): Promise<ConsultationProtocolUsage> {
    return this.svc.getProtocolUsage(id, usageId, tenantId)
  }

  @Patch(':id/protocols/:usageId')
  @UsePipes(new ZodValidationPipe(UpdateProtocolUsageSchema))
  @ApiOperation({ summary: 'Update protocol usage (working copy, modifications, status)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiParam({ name: 'usageId', type: String, format: 'uuid' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'PROTOCOL_USAGE_NOT_FOUND' })
  updateProtocolUsage(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('usageId', ParseUUIDPipe) usageId: string,
    @Body() dto: UpdateProtocolUsageDto,
  ): Promise<ConsultationProtocolUsage> {
    return this.svc.updateProtocolUsage(id, usageId, tenantId, dto)
  }

  @Patch(':id/protocols/:usageId/checked-state')
  @UsePipes(new ZodValidationPipe(UpdateCheckedStateSchema))
  @ApiOperation({ summary: 'Update checked state for a protocol usage' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiParam({ name: 'usageId', type: String, format: 'uuid' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'PROTOCOL_USAGE_NOT_FOUND' })
  updateCheckedState(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('usageId', ParseUUIDPipe) usageId: string,
    @Body() dto: UpdateCheckedStateDto,
  ): Promise<ConsultationProtocolUsage> {
    return this.svc.updateCheckedState(id, usageId, tenantId, dto)
  }

  @Delete(':id/protocols/:usageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a protocol from this consultation' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiParam({ name: 'usageId', type: String, format: 'uuid' })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 404, description: 'PROTOCOL_USAGE_NOT_FOUND' })
  async removeProtocol(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('usageId', ParseUUIDPipe) usageId: string,
  ): Promise<void> {
    await this.svc.removeProtocolUsage(id, usageId, tenantId)
  }
}
