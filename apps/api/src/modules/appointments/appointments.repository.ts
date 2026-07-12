import { Injectable, Inject } from '@nestjs/common'
import type { Prisma } from '@rezeta/db'
import type {
  Appointment,
  AppointmentConsultationStatus,
  AppointmentWithDetails,
} from '@rezeta/shared'
import type { CreateAppointmentDto, UpdateAppointmentDto } from '@rezeta/shared'
import { PrismaService } from '../../lib/prisma.service.js'

/** Prisma client scoped to an interactive transaction (`$transaction(async (tx) => …)`). */
type TransactionClient = Prisma.TransactionClient

/** Shared relations loaded on every appointment read that returns AppointmentWithDetails. */
const DETAILS_INCLUDE = {
  patient: { select: { firstName: true, lastName: true, documentNumber: true } },
  location: { select: { name: true } },
  consultations: {
    where: { deletedAt: null },
    select: { id: true, status: true },
    orderBy: { createdAt: 'desc' as const },
    take: 1,
  },
}

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
  consultations?: { id: string; status: string }[]
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
  const linked = row.consultations?.[0] ?? null
  return {
    ...toAppointment(row),
    patientName: `${row.patient.firstName} ${row.patient.lastName}`.trim(),
    patientDocumentNumber: row.patient.documentNumber,
    locationName: row.location.name,
    consultationId: linked?.id ?? null,
    consultationStatus: (linked?.status as AppointmentConsultationStatus | undefined) ?? null,
  }
}

export interface AppointmentListParams {
  tenantId: string
  userId: string
  locationId?: string
  patientId?: string
  from?: Date
  to?: Date
  status?: string
}

@Injectable()
export class AppointmentsRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  /** Resolve to the transaction client when inside a transaction, else the base client. */
  private db(tx?: TransactionClient): PrismaService | TransactionClient {
    return tx ?? this.prisma
  }

  /**
   * Takes a per-doctor Postgres transaction-level advisory lock so concurrent
   * check-then-insert flows for the same doctor serialize. The lock auto-releases
   * when the surrounding transaction commits or rolls back. `hashtext` maps the
   * userId string to the bigint the advisory-lock API expects.
   */
  async acquireDoctorLock(tx: TransactionClient, userId: string): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`
  }

  async findMany(params: AppointmentListParams): Promise<AppointmentWithDetails[]> {
    const rows = await this.prisma.appointment.findMany({
      where: {
        tenantId: params.tenantId,
        userId: params.userId,
        deletedAt: null,
        ...(params.locationId ? { locationId: params.locationId } : {}),
        ...(params.patientId ? { patientId: params.patientId } : {}),
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
      include: DETAILS_INCLUDE,
      orderBy: { startsAt: 'asc' },
    })
    return rows.map((r) => toAppointmentWithDetails(r as PrismaAppointmentWithRelations))
  }

  async findById(id: string, tenantId: string): Promise<AppointmentWithDetails | null> {
    const row = await this.prisma.appointment.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: DETAILS_INCLUDE,
    })
    return row ? toAppointmentWithDetails(row as PrismaAppointmentWithRelations) : null
  }

  async create(
    tenantId: string,
    userId: string,
    dto: CreateAppointmentDto,
    tx?: TransactionClient,
  ): Promise<AppointmentWithDetails> {
    const row = await this.db(tx).appointment.create({
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
      include: DETAILS_INCLUDE,
    })
    return toAppointmentWithDetails(row as PrismaAppointmentWithRelations)
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdateAppointmentDto,
    tx?: TransactionClient,
  ): Promise<AppointmentWithDetails> {
    const row = await this.db(tx).appointment.update({
      where: { id, tenantId, deletedAt: null },
      data: {
        ...(dto.patientId !== undefined ? { patientId: dto.patientId } : {}),
        ...(dto.locationId !== undefined ? { locationId: dto.locationId } : {}),
        ...(dto.startsAt !== undefined ? { startsAt: new Date(dto.startsAt) } : {}),
        ...(dto.endsAt !== undefined ? { endsAt: new Date(dto.endsAt) } : {}),
        ...(dto.reason !== undefined ? { reason: dto.reason } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
      include: DETAILS_INCLUDE,
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
      include: DETAILS_INCLUDE,
    })
    return toAppointmentWithDetails(row as PrismaAppointmentWithRelations)
  }

  async softDelete(id: string, tenantId: string): Promise<void> {
    await this.prisma.appointment.update({
      where: { id, tenantId, deletedAt: null },
      data: { deletedAt: new Date() },
    })
  }

  /**
   * Returns the newest non-deleted consultation linked to this appointment, or
   * null. Used to guard manual status changes while a consultation is attached.
   */
  async findLiveConsultation(
    appointmentId: string,
    tenantId: string,
  ): Promise<{ id: string; status: string } | null> {
    return this.prisma.consultation.findFirst({
      where: { appointmentId, tenantId, deletedAt: null },
      select: { id: true, status: true },
      orderBy: { createdAt: 'desc' },
    })
  }

  async hasConflict(
    userId: string,
    tenantId: string,
    startsAt: Date,
    endsAt: Date,
    excludeId?: string,
    tx?: TransactionClient,
  ): Promise<boolean> {
    const count = await this.db(tx).appointment.count({
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
