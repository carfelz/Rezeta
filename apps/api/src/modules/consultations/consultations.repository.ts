import { Injectable, Inject } from '@nestjs/common'
import { Prisma } from '@rezeta/db'
import type {
  Consultation,
  ConsultationWithDetails,
  ConsultationAmendment,
  ConsultationProtocolUsage,
  ProtocolUsageModifications,
  Prescription,
  PrescriptionItemRow,
} from '@rezeta/shared'
import type {
  CreateConsultationDto,
  AmendConsultationDto,
  UpdateProtocolUsageDto,
} from '@rezeta/shared'

// UpdateConsultationDto — SOAP fields removed in schema reset v2; stub until v1.5
type UpdateConsultationDto = Record<string, never>
import type { ProtocolContent } from '@rezeta/shared'
import { PrismaService } from '../../lib/prisma.service.js'

/**
 * Thrown inside the create transaction when the status-filtered appointment
 * update matches no row (a concurrent cancel/complete raced the pre-check).
 * The service maps this to a ConflictException (APPOINTMENT_NOT_STARTABLE).
 */
export class AppointmentNotStartableError extends Error {
  constructor() {
    super('Appointment is no longer startable')
    this.name = 'AppointmentNotStartableError'
  }
}

/** Result of signing: the signed consultation plus whether the linked
 * appointment actually transitioned to `completed` (false when there was no
 * appointment or its status-filtered update no-op'd). */
export interface SignResult {
  consultation: ConsultationWithDetails
  appointmentCompleted: boolean
}

type PrismaConsultation = {
  id: string
  tenantId: string
  patientId: string
  doctorId: string
  locationId: string
  appointmentId: string | null
  status: string
  startedAt: Date
  signedAt: Date | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

type PrismaAmendment = {
  id: string
  consultationId: string
  amendmentNumber: number
  amendedBy: string
  reason: string
  content: unknown
  amendedAt: Date
  signedAt: Date | null
}

function toConsultation(row: PrismaConsultation): Consultation {
  return {
    id: row.id,
    tenantId: row.tenantId,
    patientId: row.patientId,
    doctorUserId: row.doctorId,
    locationId: row.locationId,
    appointmentId: row.appointmentId,
    status: row.status as Consultation['status'],
    startedAt: row.startedAt.toISOString(),
    signedAt: row.signedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  }
}

function toAmendment(row: PrismaAmendment): ConsultationAmendment {
  return {
    id: row.id,
    consultationId: row.consultationId,
    amendmentNumber: row.amendmentNumber,
    amendedByUserId: row.amendedBy,
    reason: row.reason,
    content: row.content as Record<string, unknown>,
    amendedAt: row.amendedAt.toISOString(),
    signedAt: row.signedAt?.toISOString() ?? null,
  }
}

function toProtocolUsage(row: PrismaProtocolUsageWithRels): ConsultationProtocolUsage {
  return {
    id: row.id,
    tenantId: row.tenantId,
    consultationId: row.consultationId ?? '',
    protocolId: row.protocolId,
    protocolVersionId: row.protocolVersionId,
    content: (row.content ?? { version: '1.0', blocks: [] }) as unknown as ProtocolContent,
    modifications: (row.modifications ?? {}) as unknown as ProtocolUsageModifications,
    modificationSummary: row.modificationSummary,
    parentUsageId: row.parentUsageId,
    triggerBlockId: row.triggerBlockId,
    depth: row.depth,
    status: row.status as ConsultationProtocolUsage['status'],
    completedAt: row.completedAt?.toISOString() ?? null,
    notes: row.notes,
    appliedAt: row.appliedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    protocolTitle: row.protocol.title,
    protocolTypeName: null,
    versionNumber: row.protocolVersion.versionNumber,
    childUsages:
      row.childUsages?.map((c) => ({
        id: c.id,
        protocolId: c.protocolId,
        protocolTitle: c.protocol.title,
        depth: c.depth,
        status: c.status as ConsultationProtocolUsage['status'],
      })) ?? [],
  }
}

type PrismaPrescriptionRow = {
  id: string
  tenantId: string
  consultationId: string | null
  patientId: string
  doctorId: string
  groupTitle: string | null
  groupOrder: number
  status: string
  signedAt: Date | null
  pdfUrl: string | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
  prescriptionItems: {
    id: string
    prescriptionId: string
    drug: string
    dose: string
    route: string
    frequency: string
    duration: string
    notes: string | null
    source: string | null
    createdAt: Date
  }[]
}

function toPrescriptionItemRow(
  row: PrismaPrescriptionRow['prescriptionItems'][number],
): PrescriptionItemRow {
  return {
    id: row.id,
    prescriptionId: row.prescriptionId,
    drug: row.drug,
    dose: row.dose,
    route: row.route,
    frequency: row.frequency,
    duration: row.duration,
    notes: row.notes,
    source: row.source,
    createdAt: row.createdAt.toISOString(),
  }
}

function toPrescription(row: PrismaPrescriptionRow): Prescription {
  return {
    id: row.id,
    tenantId: row.tenantId,
    patientId: row.patientId,
    doctorUserId: row.doctorId,
    consultationId: row.consultationId,
    groupTitle: row.groupTitle,
    groupOrder: row.groupOrder,
    status: row.status as Prescription['status'],
    prescriptionItems: row.prescriptionItems.map(toPrescriptionItemRow),
    pdfUrl: row.pdfUrl,
    signedAt: row.signedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  }
}

function toConsultationWithDetails(row: PrismaConsultationWithRels): ConsultationWithDetails {
  return {
    ...toConsultation(row),
    patientName: `${row.patient.firstName} ${row.patient.lastName}`.trim(),
    locationName: row.location.name,
    doctorName: row.doctor.fullName ?? '',
    patientAllergies: row.patient.allergies as string[],
    patientChronicConditions: row.patient.chronicConditions as string[],
    amendments: row.amendments.map(toAmendment),
    protocolUsages: row.protocolUsages.map(toProtocolUsage),
  }
}

const PROTOCOL_USAGE_INCLUDE = Prisma.validator<Prisma.ProtocolUsageInclude>()({
  protocol: { select: { title: true } },
  protocolVersion: { select: { versionNumber: true } },
  childUsages: {
    where: { deletedAt: null },
    select: {
      id: true,
      protocolId: true,
      depth: true,
      status: true,
      protocol: { select: { title: true } },
    },
    orderBy: { createdAt: 'asc' },
  },
})

const RELATIONS_INCLUDE = Prisma.validator<Prisma.ConsultationInclude>()({
  patient: { select: { firstName: true, lastName: true, allergies: true, chronicConditions: true } },
  location: { select: { name: true } },
  doctor: { select: { fullName: true } },
  amendments: { orderBy: { amendmentNumber: 'asc' } },
  protocolUsages: {
    where: { deletedAt: null },
    include: PROTOCOL_USAGE_INCLUDE,
    orderBy: { appliedAt: 'asc' },
  },
})

type PrismaConsultationWithRels = Prisma.ConsultationGetPayload<{
  include: typeof RELATIONS_INCLUDE
}>

type PrismaProtocolUsageWithRels = Prisma.ProtocolUsageGetPayload<{
  include: typeof PROTOCOL_USAGE_INCLUDE
}>

export interface ConsultationListParams {
  tenantId: string
  userId: string
  patientId?: string
  locationId?: string
  from?: Date
  to?: Date
}

@Injectable()
export class ConsultationsRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async findMany(params: ConsultationListParams): Promise<ConsultationWithDetails[]> {
    const rows = await this.prisma.consultation.findMany({
      where: {
        tenantId: params.tenantId,
        doctorId: params.userId,
        deletedAt: null,
        ...(params.patientId ? { patientId: params.patientId } : {}),
        ...(params.locationId ? { locationId: params.locationId } : {}),
        ...(params.from || params.to
          ? {
              startedAt: {
                ...(params.from ? { gte: params.from } : {}),
                ...(params.to ? { lte: params.to } : {}),
              },
            }
          : {}),
      },
      include: RELATIONS_INCLUDE,
      orderBy: { startedAt: 'desc' },
    })
    return rows.map((r) => toConsultationWithDetails(r))
  }

  /**
   * All live prescriptions for a patient, newest first. Tenant-scoped and
   * soft-delete filtered. Powers the patient page's "Recetas" tab.
   */
  async listPatientPrescriptions(patientId: string, tenantId: string): Promise<Prescription[]> {
    const rows = await this.prisma.prescription.findMany({
      where: { patientId, tenantId, deletedAt: null },
      include: { prescriptionItems: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map((r) => toPrescription(r as unknown as PrismaPrescriptionRow))
  }

  /**
   * Returns the most recent draft (in-progress) consultation for a patient
   * within the eligibility window. The caller decides whether to surface a
   * resume banner based on `elapsedMinutes`.
   */
  async findResumableForPatient(
    tenantId: string,
    userId: string,
    patientId: string,
    maxAgeDays: number,
  ): Promise<ConsultationWithDetails | null> {
    const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000)
    const row = await this.prisma.consultation.findFirst({
      where: {
        tenantId,
        doctorId: userId,
        patientId,
        deletedAt: null,
        status: 'open',
        updatedAt: { gte: cutoff },
      },
      include: RELATIONS_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    })
    return row ? toConsultationWithDetails(row) : null
  }

  async findById(id: string, tenantId: string): Promise<ConsultationWithDetails | null> {
    const row = await this.prisma.consultation.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: RELATIONS_INCLUDE,
    })
    return row ? toConsultationWithDetails(row) : null
  }

  /**
   * Returns the open consultation already attached to an appointment, if any.
   * Used to make appointment-driven consultation creation idempotent.
   */
  async findOpenByAppointment(
    appointmentId: string,
    tenantId: string,
  ): Promise<ConsultationWithDetails | null> {
    const row = await this.prisma.consultation.findFirst({
      where: { appointmentId, tenantId, status: 'open', deletedAt: null },
      include: RELATIONS_INCLUDE,
    })
    return row ? toConsultationWithDetails(row) : null
  }

  async create(
    tenantId: string,
    userId: string,
    dto: CreateConsultationDto,
  ): Promise<ConsultationWithDetails> {
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.consultation.create({
        data: {
          tenantId,
          doctorId: userId,
          patientId: dto.patientId,
          locationId: dto.locationId,
          ...(dto.appointmentId != null ? { appointmentId: dto.appointmentId } : {}),
          status: 'open',
        },
        include: RELATIONS_INCLUDE,
      })
      if (dto.appointmentId != null) {
        // Status-filtered so a concurrent cancel between the service pre-check
        // and this commit is a no-op (count 0) rather than being flipped back to
        // in_progress. Count 0 throws to roll the consultation create back.
        const { count } = await tx.appointment.updateMany({
          where: {
            id: dto.appointmentId,
            tenantId,
            deletedAt: null,
            status: { in: ['scheduled', 'in_progress'] },
          },
          data: { status: 'in_progress' },
        })
        if (count === 0) {
          throw new AppointmentNotStartableError()
        }
      }
      return created
    })
    return toConsultationWithDetails(row)
  }

  async update(
    id: string,
    tenantId: string,
    _dto: UpdateConsultationDto,
  ): Promise<ConsultationWithDetails> {
    // SOAP fields removed in schema reset v2 — update is a no-op until v1.5 adds new fields
    const row = await this.prisma.consultation.findFirstOrThrow({
      where: { id, tenantId, deletedAt: null },
      include: RELATIONS_INCLUDE,
    })
    return toConsultationWithDetails(row)
  }

  async sign(
    id: string,
    tenantId: string,
    _userId: string,
    appointmentId: string | null,
  ): Promise<SignResult> {
    const now = new Date()
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.protocolUsage.updateMany({
        where: { consultationId: id, tenantId, status: 'in_progress', deletedAt: null },
        data: { status: 'completed', completedAt: now },
      })
      await tx.prescription.updateMany({
        where: { consultationId: id, tenantId, status: 'queued', deletedAt: null },
        data: { status: 'signed', signedAt: now },
      })
      await tx.labOrder.updateMany({
        where: { consultationId: id, tenantId, status: 'queued', deletedAt: null },
        data: { status: 'signed', signedAt: now },
      })
      await tx.imagingOrder.updateMany({
        where: { consultationId: id, tenantId, status: 'queued', deletedAt: null },
        data: { status: 'signed', signedAt: now },
      })
      // Complete the linked appointment. `updateMany` filtered on `in_progress`
      // keeps this idempotent and never touches manually completed/cancelled rows.
      let appointmentCompleted = false
      if (appointmentId != null) {
        const { count } = await tx.appointment.updateMany({
          where: { id: appointmentId, tenantId, deletedAt: null, status: 'in_progress' },
          data: { status: 'completed' },
        })
        appointmentCompleted = count > 0
      }
      const consultation = await tx.consultation.update({
        where: { id, tenantId, deletedAt: null },
        data: { status: 'signed', signedAt: now },
        include: RELATIONS_INCLUDE,
      })
      return { consultation, appointmentCompleted }
    })
    return {
      consultation: toConsultationWithDetails(result.consultation),
      appointmentCompleted: result.appointmentCompleted,
    }
  }

  async createAmendment(
    consultationId: string,
    tenantId: string,
    userId: string,
    dto: AmendConsultationDto,
  ): Promise<ConsultationWithDetails> {
    const lastAmendment = await this.prisma.consultationAmendment.findFirst({
      where: { consultationId },
      orderBy: { amendmentNumber: 'desc' },
      select: { amendmentNumber: true },
    })
    const nextNumber = (lastAmendment?.amendmentNumber ?? 0) + 1

    const content: Record<string, unknown> = {
      amendment_content: dto.amendment_content ?? {},
    }

    await this.prisma.consultationAmendment.create({
      data: {
        consultationId,
        amendmentNumber: nextNumber,
        reason: dto.reason,
        content: content as Prisma.InputJsonValue,
        amendedBy: userId,
      },
    })

    const row = await this.prisma.consultation.findFirstOrThrow({
      where: { id: consultationId, tenantId, deletedAt: null },
      include: RELATIONS_INCLUDE,
    })
    return toConsultationWithDetails(row)
  }

  async softDelete(
    id: string,
    tenantId: string,
    appointmentId: string | null,
  ): Promise<{ appointmentReverted: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      await tx.consultation.update({
        where: { id, tenantId, deletedAt: null },
        data: { deletedAt: new Date() },
      })
      // Revert the linked appointment. `updateMany` filtered on `in_progress`
      // keeps this idempotent and never touches manually completed/cancelled rows.
      let appointmentReverted = false
      if (appointmentId != null) {
        const { count } = await tx.appointment.updateMany({
          where: { id: appointmentId, tenantId, deletedAt: null, status: 'in_progress' },
          data: { status: 'scheduled' },
        })
        appointmentReverted = count > 0
      }
      return { appointmentReverted }
    })
  }

  async launchProtocolUsage(params: {
    consultationId: string
    tenantId: string
    userId: string
    protocolId: string
    protocolVersionId: string
    content: Record<string, unknown>
    parentUsageId?: string
    triggerBlockId?: string
    depth: number
  }): Promise<ConsultationProtocolUsage> {
    const row = await this.prisma.protocolUsage.create({
      data: {
        tenantId: params.tenantId,
        consultationId: params.consultationId,
        protocolId: params.protocolId,
        protocolVersionId: params.protocolVersionId,
        userId: params.userId,
        content: params.content as Prisma.InputJsonValue,
        modifications: {} as Prisma.InputJsonValue,
        status: 'in_progress',
        depth: params.depth,
        ...(params.parentUsageId ? { parentUsageId: params.parentUsageId } : {}),
        ...(params.triggerBlockId ? { triggerBlockId: params.triggerBlockId } : {}),
      },
      include: PROTOCOL_USAGE_INCLUDE,
    })
    return toProtocolUsage(row)
  }

  async updateProtocolUsage(
    usageId: string,
    tenantId: string,
    dto: UpdateProtocolUsageDto,
  ): Promise<ConsultationProtocolUsage> {
    const data: Prisma.ProtocolUsageUpdateInput = {}

    if (dto.content !== undefined) {
      data.content = dto.content as Prisma.InputJsonValue
    }
    if (dto.modifications !== undefined) {
      // Merge new modifications onto existing ones rather than replacing
      const existing = await this.prisma.protocolUsage.findFirst({
        where: { id: usageId, tenantId },
        select: { modifications: true },
      })
      const prev = (existing?.modifications ?? {}) as Record<string, unknown[]>
      const next = dto.modifications as Record<string, unknown[]>
      const merged: Record<string, unknown[]> = { ...prev }
      for (const key of Object.keys(next)) {
        if (next[key]) {
          merged[key] = [...(prev[key] ?? []), ...next[key]]
        }
      }
      data.modifications = merged as Prisma.InputJsonValue
    }
    if (dto.modificationSummary !== undefined) {
      data.modificationSummary = dto.modificationSummary ?? null
    }
    if (dto.status !== undefined) {
      data.status = dto.status
    }
    if (dto.completedAt !== undefined) {
      data.completedAt = dto.completedAt ? new Date(dto.completedAt) : null
    }

    const row = await this.prisma.protocolUsage.update({
      where: { id: usageId, tenantId, deletedAt: null },
      data,
      include: PROTOCOL_USAGE_INCLUDE,
    })
    return toProtocolUsage(row)
  }

  async updateCheckedState(
    usageId: string,
    tenantId: string,
    completedAt: Date | null | undefined,
    notes: string | null | undefined,
  ): Promise<ConsultationProtocolUsage> {
    const row = await this.prisma.protocolUsage.update({
      where: { id: usageId, tenantId, deletedAt: null },
      data: {
        ...(completedAt !== undefined ? { completedAt } : {}),
        ...(notes !== undefined ? { notes } : {}),
      },
      include: PROTOCOL_USAGE_INCLUDE,
    })
    return toProtocolUsage(row)
  }

  async removeProtocolUsage(usageId: string, tenantId: string): Promise<void> {
    await this.prisma.protocolUsage.update({
      where: { id: usageId, tenantId, deletedAt: null },
      data: { deletedAt: new Date(), status: 'abandoned' },
    })
  }

  async findProtocolUsageById(
    usageId: string,
    tenantId: string,
  ): Promise<ConsultationProtocolUsage | null> {
    const row = await this.prisma.protocolUsage.findFirst({
      where: { id: usageId, tenantId, deletedAt: null },
      include: PROTOCOL_USAGE_INCLUDE,
    })
    return row ? toProtocolUsage(row) : null
  }

  async getUsageDepth(parentUsageId: string, tenantId: string): Promise<number> {
    const parent = await this.prisma.protocolUsage.findFirst({
      where: { id: parentUsageId, tenantId },
      select: { depth: true },
    })
    return (parent?.depth ?? 0) + 1
  }
}
