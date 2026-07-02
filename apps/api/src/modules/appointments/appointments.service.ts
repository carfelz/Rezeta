import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common'
import type { AppointmentWithDetails } from '@rezeta/shared'
import type {
  CreateAppointmentDto,
  UpdateAppointmentDto,
  UpdateAppointmentStatusDto,
} from '@rezeta/shared'
import { ErrorCode } from '@rezeta/shared'
import { AppointmentsRepository, type AppointmentListParams } from './appointments.repository.js'

@Injectable()
export class AppointmentsService {
  constructor(@Inject(AppointmentsRepository) private repo: AppointmentsRepository) {}

  list(params: AppointmentListParams): Promise<AppointmentWithDetails[]> {
    return this.repo.findMany(params)
  }

  async getById(id: string, tenantId: string): Promise<AppointmentWithDetails> {
    const appt = await this.repo.findById(id, tenantId)
    if (!appt) {
      throw new NotFoundException({
        code: ErrorCode.APPOINTMENT_NOT_FOUND,
        message: 'Appointment not found',
      })
    }
    return appt
  }

  async create(
    tenantId: string,
    userId: string,
    dto: CreateAppointmentDto,
  ): Promise<AppointmentWithDetails> {
    const startsAt = new Date(dto.startsAt)
    const endsAt = new Date(dto.endsAt)

    if (endsAt <= startsAt) {
      throw new BadRequestException({
        code: 'INVALID_TIME_RANGE',
        message: 'endsAt must be after startsAt',
      })
    }

    const conflict = await this.repo.hasConflict(userId, tenantId, startsAt, endsAt)
    if (conflict) {
      throw new ConflictException({
        code: ErrorCode.APPOINTMENT_CONFLICT,
        message: 'Time slot overlaps with an existing appointment',
      })
    }

    return this.repo.create(tenantId, userId, dto)
  }

  async update(
    id: string,
    tenantId: string,
    userId: string,
    dto: UpdateAppointmentDto,
  ): Promise<AppointmentWithDetails> {
    await this.getById(id, tenantId)

    if (dto.startsAt || dto.endsAt) {
      const existing = await this.getById(id, tenantId)
      const startsAt = new Date(dto.startsAt ?? existing.startsAt)
      const endsAt = new Date(dto.endsAt ?? existing.endsAt)

      if (endsAt <= startsAt) {
        throw new BadRequestException({
          code: 'INVALID_TIME_RANGE',
          message: 'endsAt must be after startsAt',
        })
      }

      const conflict = await this.repo.hasConflict(userId, tenantId, startsAt, endsAt, id)
      if (conflict) {
        throw new ConflictException({
          code: ErrorCode.APPOINTMENT_CONFLICT,
          message: 'Time slot overlaps with an existing appointment',
        })
      }
    }

    return this.repo.update(id, tenantId, dto)
  }

  async updateStatus(
    id: string,
    tenantId: string,
    dto: UpdateAppointmentStatusDto,
  ): Promise<AppointmentWithDetails> {
    const appt = await this.getById(id, tenantId)
    if (appt.status === 'cancelled' && dto.status !== 'scheduled') {
      throw new ConflictException({
        code: ErrorCode.APPOINTMENT_ALREADY_CANCELLED,
        message: 'Cannot change status of a cancelled appointment',
      })
    }

    // An appointment linked to a consultation follows the consultation's
    // lifecycle — manual completion/cancellation would desync the two.
    const linked = await this.repo.findLiveConsultation(id, tenantId)
    if (linked) {
      if (dto.status === 'completed') {
        throw new ConflictException({
          code: ErrorCode.APPOINTMENT_HAS_CONSULTATION,
          message: 'Appointment status follows its consultation and cannot be completed manually',
        })
      }
      if ((dto.status === 'cancelled' || dto.status === 'no_show') && linked.status === 'open') {
        throw new ConflictException({
          code: ErrorCode.APPOINTMENT_HAS_OPEN_CONSULTATION,
          message: 'Cannot cancel or no-show an appointment with an open consultation',
        })
      }
    }

    return this.repo.updateStatus(id, tenantId, dto.status)
  }

  async remove(id: string, tenantId: string): Promise<void> {
    await this.getById(id, tenantId)
    await this.repo.softDelete(id, tenantId)
  }
}
