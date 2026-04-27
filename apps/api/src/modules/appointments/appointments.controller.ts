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
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger'
import type { AppointmentWithDetails, AuthUser } from '@rezeta/shared'
import {
  CreateAppointmentSchema,
  UpdateAppointmentSchema,
  UpdateAppointmentStatusSchema,
  type CreateAppointmentDto,
  type UpdateAppointmentDto,
  type UpdateAppointmentStatusDto,
} from '@rezeta/shared'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { CurrentUser } from '../../common/decorators/current-user.decorator.js'
import { TenantId } from '../../common/decorators/tenant-id.decorator.js'
import { AppointmentsService } from './appointments.service.js'

@ApiTags('Appointments')
@ApiBearerAuth('firebase-jwt')
@ApiSecurity('firebase-oauth2')
@Controller('v1/appointments')
export class AppointmentsController {
  constructor(@Inject(AppointmentsService) private svc: AppointmentsService) {}

  @Get()
  @ApiOperation({ summary: 'List appointments' })
  @ApiQuery({ name: 'locationId', required: false, type: String })
  @ApiQuery({ name: 'from', required: false, type: String, description: 'ISO datetime' })
  @ApiQuery({ name: 'to', required: false, type: String, description: 'ISO datetime' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['scheduled', 'completed', 'cancelled', 'no_show'],
  })
  @ApiResponse({
    status: 200,
    description: 'Array of appointments with patient and location details',
  })
  list(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Query('locationId') locationId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
  ): Promise<AppointmentWithDetails[]> {
    return this.svc.list({
      tenantId,
      userId: user.id,
      ...(locationId ? { locationId } : {}),
      ...(from ? { from: new Date(from) } : {}),
      ...(to ? { to: new Date(to) } : {}),
      ...(status ? { status } : {}),
    })
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get appointment by ID' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'APPOINTMENT_NOT_FOUND' })
  getById(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AppointmentWithDetails> {
    return this.svc.getById(id, tenantId)
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(CreateAppointmentSchema))
  @ApiOperation({ summary: 'Create appointment' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['patientId', 'locationId', 'startsAt', 'endsAt'],
      properties: {
        patientId: { type: 'string', format: 'uuid' },
        locationId: { type: 'string', format: 'uuid' },
        startsAt: { type: 'string', format: 'date-time' },
        endsAt: { type: 'string', format: 'date-time' },
        reason: { type: 'string', nullable: true },
        notes: { type: 'string', nullable: true },
      },
    },
  })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 409, description: 'APPOINTMENT_CONFLICT — overlapping time slot' })
  create(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateAppointmentDto,
  ): Promise<AppointmentWithDetails> {
    return this.svc.create(tenantId, user.id, dto)
  }

  @Patch(':id')
  @UsePipes(new ZodValidationPipe(UpdateAppointmentSchema))
  @ApiOperation({ summary: 'Update appointment' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'APPOINTMENT_NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'APPOINTMENT_CONFLICT' })
  update(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAppointmentDto,
  ): Promise<AppointmentWithDetails> {
    return this.svc.update(id, tenantId, user.id, dto)
  }

  @Patch(':id/status')
  @UsePipes(new ZodValidationPipe(UpdateAppointmentStatusSchema))
  @ApiOperation({ summary: 'Update appointment status' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['status'],
      properties: {
        status: { type: 'string', enum: ['scheduled', 'completed', 'cancelled', 'no_show'] },
      },
    },
  })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'APPOINTMENT_NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'APPOINTMENT_ALREADY_CANCELLED' })
  updateStatus(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAppointmentStatusDto,
  ): Promise<AppointmentWithDetails> {
    return this.svc.updateStatus(id, tenantId, dto)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel / soft-delete appointment' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 404, description: 'APPOINTMENT_NOT_FOUND' })
  async remove(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.svc.remove(id, tenantId)
  }
}
