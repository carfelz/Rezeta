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
import { AUTH_BEARER_SCHEME, AUTH_OAUTH2_SCHEME } from '../../lib/auth/index.js'
import type { AppointmentWithDetails, AuthUser } from '@rezeta/shared'
import {
  CreateAppointmentSchema,
  UpdateAppointmentSchema,
  UpdateAppointmentStatusSchema,
  AppointmentListQuerySchema,
  type CreateAppointmentDto,
  type UpdateAppointmentDto,
  type UpdateAppointmentStatusDto,
  type AppointmentListQuery,
} from '@rezeta/shared'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { CurrentUser } from '../../common/decorators/current-user.decorator.js'
import { TenantId } from '../../common/decorators/tenant-id.decorator.js'
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js'
import { AppointmentsService } from './appointments.service.js'

@ApiTags('Appointments')
@ApiBearerAuth(AUTH_BEARER_SCHEME)
@ApiSecurity(AUTH_OAUTH2_SCHEME)
@Controller('v1/appointments')
export class AppointmentsController {
  constructor(@Inject(AppointmentsService) private svc: AppointmentsService) {}

  @RequirePermission('appointments', 'view')
  @Get()
  @ApiOperation({ summary: 'List appointments' })
  @ApiQuery({ name: 'locationId', required: false, type: String })
  @ApiQuery({ name: 'patientId', required: false, type: String })
  @ApiQuery({ name: 'from', required: false, type: String, description: 'ISO datetime' })
  @ApiQuery({ name: 'to', required: false, type: String, description: 'ISO datetime' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['scheduled', 'in_progress', 'completed', 'cancelled', 'no_show'],
  })
  @ApiResponse({
    status: 200,
    description: 'Array of appointments with patient and location details',
  })
  list(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(AppointmentListQuerySchema)) query: AppointmentListQuery,
  ): Promise<AppointmentWithDetails[]> {
    return this.svc.list({
      tenantId,
      userId: user.id,
      ...(query.locationId ? { locationId: query.locationId } : {}),
      ...(query.patientId ? { patientId: query.patientId } : {}),
      ...(query.from ? { from: new Date(query.from) } : {}),
      ...(query.to ? { to: new Date(query.to) } : {}),
      ...(query.status ? { status: query.status } : {}),
    })
  }

  @RequirePermission('appointments', 'view')
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

  @RequirePermission('appointments', 'manage')
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

  @RequirePermission('appointments', 'manage')
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

  @RequirePermission('appointments', 'manage')
  @Patch(':id/status')
  @UsePipes(new ZodValidationPipe(UpdateAppointmentStatusSchema))
  @ApiOperation({ summary: 'Update appointment status' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['status'],
      properties: {
        status: {
          type: 'string',
          enum: ['scheduled', 'in_progress', 'completed', 'cancelled', 'no_show'],
        },
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

  @RequirePermission('appointments', 'manage')
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
