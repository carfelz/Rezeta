import { Injectable, Inject } from '@nestjs/common'
import type { Appointment, AppointmentWithDetails } from '@rezeta/shared'
import type { CreateAppointmentDto, UpdateAppointmentDto } from '@rezeta/shared'
import { PrismaService } from '../../lib/prisma.service.js'

type PrismaAppointment = {
  id: string
  tenantId: string
  patientId: string
  userId: string
  locationId: string
  status: string
  startsAt: Date
  endsAt: Date
  reason: string | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

type PrismaAppointmentWithRelations = PrismaAppointment & {
  patient: { firstName: string; lastName: string; documentNumber: string | null }
  location: { name: string }
}

function toAppointment(row: PrismaAppointment): Appointment {
  return {
    id: row.id,
    tenantId: row.tenantId,
    patientId: row.patientId,
    doctorUserId: row.userId,
    locationId: row.locationId,
    status: row.status as Appointment['status'],
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    reason: row.reason,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  }
}

function toAppointmentWithDetails(row: PrismaAppointmentWithRelations): AppointmentWithDetails {
  return {
    ...toAppointment(row),
    patientName: `${row.patient.firstName} ${row.patient.lastName}`.trim(),
    patientDocumentNumber: row.patient.documentNumber,
    locationName: row.location.name,
  }
}

export interface AppointmentListParams {
  tenantId: string
  userId: string
  locationId?: string
  from?: Date
  to?: Date
  status?: string
}

@Injectable()
export class AppointmentsRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async findMany(params: AppointmentListParams): Promise<AppointmentWithDetails[]> {
    const rows = await this.prisma.appointment.findMany({
      where: {
        tenantId: params.tenantId,
        userId: params.userId,
        deletedAt: null,
        ...(params.locationId ? { locationId: params.locationId } : {}),
        ...(params.status ? { status: params.status } : {}),
        ...(params.from || params.to
          ? {
              startsAt: {
                ...(params.from ? { gte: params.from } : {}),
                ...(params.to ? { lte: params.to } : {}),
              },
            }
          : {}),
      },
      include: {
        patient: { select: { firstName: true, lastName: true, documentNumber: true } },
        location: { select: { name: true } },
      },
      orderBy: { startsAt: 'asc' },
    })
    return rows.map((r) => toAppointmentWithDetails(r as PrismaAppointmentWithRelations))
  }

  async findById(id: string, tenantId: string): Promise<AppointmentWithDetails | null> {
    const row = await this.prisma.appointment.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        patient: { select: { firstName: true, lastName: true, documentNumber: true } },
        location: { select: { name: true } },
      },
    })
    return row ? toAppointmentWithDetails(row as PrismaAppointmentWithRelations) : null
  }

  async create(
    tenantId: string,
    userId: string,
    dto: CreateAppointmentDto,
  ): Promise<AppointmentWithDetails> {
    const row = await this.prisma.appointment.create({
      data: {
        tenantId,
        userId,
        patientId: dto.patientId,
        locationId: dto.locationId,
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
        reason: dto.reason ?? null,
        notes: dto.notes ?? null,
        status: 'scheduled',
      },
      include: {
        patient: { select: { firstName: true, lastName: true, documentNumber: true } },
        location: { select: { name: true } },
      },
    })
    return toAppointmentWithDetails(row as PrismaAppointmentWithRelations)
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdateAppointmentDto,
  ): Promise<AppointmentWithDetails> {
    const row = await this.prisma.appointment.update({
      where: { id, tenantId, deletedAt: null },
      data: {
        ...(dto.patientId !== undefined ? { patientId: dto.patientId } : {}),
        ...(dto.locationId !== undefined ? { locationId: dto.locationId } : {}),
        ...(dto.startsAt !== undefined ? { startsAt: new Date(dto.startsAt) } : {}),
        ...(dto.endsAt !== undefined ? { endsAt: new Date(dto.endsAt) } : {}),
        ...(dto.reason !== undefined ? { reason: dto.reason } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
      include: {
        patient: { select: { firstName: true, lastName: true, documentNumber: true } },
        location: { select: { name: true } },
      },
    })
    return toAppointmentWithDetails(row as PrismaAppointmentWithRelations)
  }

  async updateStatus(
    id: string,
    tenantId: string,
    status: string,
  ): Promise<AppointmentWithDetails> {
    const row = await this.prisma.appointment.update({
      where: { id, tenantId, deletedAt: null },
      data: { status },
      include: {
        patient: { select: { firstName: true, lastName: true, documentNumber: true } },
        location: { select: { name: true } },
      },
    })
    return toAppointmentWithDetails(row as PrismaAppointmentWithRelations)
  }

  async softDelete(id: string, tenantId: string): Promise<void> {
    await this.prisma.appointment.update({
      where: { id, tenantId, deletedAt: null },
      data: { deletedAt: new Date() },
    })
  }

  async hasConflict(
    userId: string,
    tenantId: string,
    startsAt: Date,
    endsAt: Date,
    excludeId?: string,
  ): Promise<boolean> {
    const count = await this.prisma.appointment.count({
      where: {
        userId,
        tenantId,
        deletedAt: null,
        status: { notIn: ['cancelled'] },
        ...(excludeId ? { id: { not: excludeId } } : {}),
        AND: [{ startsAt: { lt: endsAt } }, { endsAt: { gt: startsAt } }],
      },
    })
    return count > 0
  }
}
