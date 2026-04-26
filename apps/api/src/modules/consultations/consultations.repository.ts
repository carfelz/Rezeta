import { Injectable, Inject } from '@nestjs/common'
import { Prisma } from '@rezeta/db'
import type {
  Consultation,
  ConsultationWithDetails,
  ConsultationAmendment,
  ConsultationProtocolUsage,
} from '@rezeta/shared'
import type {
  CreateConsultationDto,
  UpdateConsultationDto,
  AmendConsultationDto,
} from '@rezeta/shared'
import { PrismaService } from '../../lib/prisma.service.js'

type PrismaConsultation = {
  id: string
  tenantId: string
  patientId: string
  userId: string
  locationId: string
  appointmentId: string | null
  status: string
  chiefComplaint: string | null
  subjective: string | null
  objective: string | null
  assessment: string | null
  plan: string | null
  vitals: unknown
  diagnoses: unknown
  consultedAt: Date
  signedAt: Date | null
  signedBy: string | null
  contentHash: string | null
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

type PrismaProtocolUsage = {
  id: string
  tenantId: string
  consultationId: string | null
  protocolId: string
  protocolVersionId: string
  checkedState: unknown
  completedAt: Date | null
  notes: string | null
  appliedAt: Date
  protocol: { title: string; type: { name: string } }
  protocolVersion: { versionNumber: number }
}

type PrismaConsultationWithRelations = PrismaConsultation & {
  patient: { firstName: string; lastName: string }
  location: { name: string }
  doctor: { fullName: string | null }
  amendments: PrismaAmendment[]
  protocolUsages: PrismaProtocolUsage[]
}

function toConsultation(row: PrismaConsultation): Consultation {
  return {
    id: row.id,
    tenantId: row.tenantId,
    patientId: row.patientId,
    doctorUserId: row.userId,
    locationId: row.locationId,
    appointmentId: row.appointmentId,
    status: row.status as Consultation['status'],
    chiefComplaint: row.chiefComplaint,
    subjective: row.subjective,
    objective: row.objective,
    assessment: row.assessment,
    plan: row.plan,
    vitals: (row.vitals ?? null) as Consultation['vitals'],
    diagnoses: (row.diagnoses as string[]) ?? [],
    consultedAt: row.consultedAt.toISOString(),
    signedAt: row.signedAt?.toISOString() ?? null,
    signedByUserId: row.signedBy,
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

function toProtocolUsage(row: PrismaProtocolUsage): ConsultationProtocolUsage {
  return {
    id: row.id,
    tenantId: row.tenantId,
    consultationId: row.consultationId ?? '',
    protocolId: row.protocolId,
    protocolVersionId: row.protocolVersionId,
    checkedState: (row.checkedState ?? {}) as Record<string, boolean>,
    completedAt: row.completedAt?.toISOString() ?? null,
    notes: row.notes,
    appliedAt: row.appliedAt.toISOString(),
    protocolTitle: row.protocol.title,
    protocolTypeName: row.protocol.type.name,
    versionNumber: row.protocolVersion.versionNumber,
  }
}

function toConsultationWithDetails(row: PrismaConsultationWithRelations): ConsultationWithDetails {
  return {
    ...toConsultation(row),
    patientName: `${row.patient.firstName} ${row.patient.lastName}`.trim(),
    locationName: row.location.name,
    doctorName: row.doctor.fullName ?? '',
    amendments: row.amendments.map(toAmendment),
    protocolUsages: row.protocolUsages.map(toProtocolUsage),
  }
}

const RELATIONS_INCLUDE = {
  patient: { select: { firstName: true, lastName: true } },
  location: { select: { name: true } },
  doctor: { select: { fullName: true } },
  amendments: { orderBy: { amendmentNumber: 'asc' as const } },
  protocolUsages: {
    where: { deletedAt: null },
    include: {
      protocol: { select: { title: true, type: { select: { name: true } } } },
      protocolVersion: { select: { versionNumber: true } },
    },
    orderBy: { appliedAt: 'asc' as const },
  },
}

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
        userId: params.userId,
        deletedAt: null,
        ...(params.patientId ? { patientId: params.patientId } : {}),
        ...(params.locationId ? { locationId: params.locationId } : {}),
        ...(params.from || params.to
          ? {
              consultedAt: {
                ...(params.from ? { gte: params.from } : {}),
                ...(params.to ? { lte: params.to } : {}),
              },
            }
          : {}),
      },
      include: RELATIONS_INCLUDE,
      orderBy: { consultedAt: 'desc' },
    })
    return rows.map((r) =>
      toConsultationWithDetails(r as unknown as PrismaConsultationWithRelations),
    )
  }

  async findById(id: string, tenantId: string): Promise<ConsultationWithDetails | null> {
    const row = await this.prisma.consultation.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: RELATIONS_INCLUDE,
    })
    return row ? toConsultationWithDetails(row as unknown as PrismaConsultationWithRelations) : null
  }

  async create(
    tenantId: string,
    userId: string,
    dto: CreateConsultationDto,
  ): Promise<ConsultationWithDetails> {
    const row = await this.prisma.consultation.create({
      data: {
        tenantId,
        userId,
        patientId: dto.patientId,
        locationId: dto.locationId,
        ...(dto.appointmentId != null ? { appointmentId: dto.appointmentId } : {}),
        ...(dto.chiefComplaint != null ? { chiefComplaint: dto.chiefComplaint } : {}),
        ...(dto.subjective != null ? { subjective: dto.subjective } : {}),
        ...(dto.objective != null ? { objective: dto.objective } : {}),
        ...(dto.assessment != null ? { assessment: dto.assessment } : {}),
        ...(dto.plan != null ? { plan: dto.plan } : {}),
        vitals: dto.vitals != null ? (dto.vitals as Prisma.InputJsonValue) : Prisma.JsonNull,
        diagnoses: (dto.diagnoses ?? []) as Prisma.InputJsonValue,
        status: 'draft',
      },
      include: RELATIONS_INCLUDE,
    })
    return toConsultationWithDetails(row as unknown as PrismaConsultationWithRelations)
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdateConsultationDto,
  ): Promise<ConsultationWithDetails> {
    const row = await this.prisma.consultation.update({
      where: { id, tenantId, deletedAt: null },
      data: {
        ...(dto.chiefComplaint !== undefined ? { chiefComplaint: dto.chiefComplaint } : {}),
        ...(dto.subjective !== undefined ? { subjective: dto.subjective } : {}),
        ...(dto.objective !== undefined ? { objective: dto.objective } : {}),
        ...(dto.assessment !== undefined ? { assessment: dto.assessment } : {}),
        ...(dto.plan !== undefined ? { plan: dto.plan } : {}),
        ...(dto.vitals !== undefined
          ? { vitals: dto.vitals != null ? (dto.vitals as Prisma.InputJsonValue) : Prisma.JsonNull }
          : {}),
        ...(dto.diagnoses !== undefined
          ? { diagnoses: dto.diagnoses as Prisma.InputJsonValue }
          : {}),
      },
      include: RELATIONS_INCLUDE,
    })
    return toConsultationWithDetails(row as unknown as PrismaConsultationWithRelations)
  }

  async sign(
    id: string,
    tenantId: string,
    userId: string,
    contentHash: string,
  ): Promise<ConsultationWithDetails> {
    const row = await this.prisma.consultation.update({
      where: { id, tenantId, deletedAt: null },
      data: { status: 'signed', signedAt: new Date(), signedBy: userId, contentHash },
      include: RELATIONS_INCLUDE,
    })
    return toConsultationWithDetails(row as unknown as PrismaConsultationWithRelations)
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

    const content: Record<string, unknown> = {}
    if (dto.chiefComplaint !== undefined) content['chiefComplaint'] = dto.chiefComplaint
    if (dto.subjective !== undefined) content['subjective'] = dto.subjective
    if (dto.objective !== undefined) content['objective'] = dto.objective
    if (dto.assessment !== undefined) content['assessment'] = dto.assessment
    if (dto.plan !== undefined) content['plan'] = dto.plan
    if (dto.vitals !== undefined) content['vitals'] = dto.vitals
    if (dto.diagnoses !== undefined) content['diagnoses'] = dto.diagnoses

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
    return toConsultationWithDetails(row as unknown as PrismaConsultationWithRelations)
  }

  async softDelete(id: string, tenantId: string): Promise<void> {
    await this.prisma.consultation.update({
      where: { id, tenantId, deletedAt: null },
      data: { deletedAt: new Date() },
    })
  }

  async addProtocolUsage(
    consultationId: string,
    tenantId: string,
    userId: string,
    protocolId: string,
    protocolVersionId: string,
  ): Promise<ConsultationProtocolUsage> {
    const row = await this.prisma.protocolUsage.create({
      data: {
        tenantId,
        consultationId,
        protocolId,
        protocolVersionId,
        userId,
        checkedState: {} as Prisma.InputJsonValue,
      },
      include: {
        protocol: { select: { title: true, type: { select: { name: true } } } },
        protocolVersion: { select: { versionNumber: true } },
      },
    })
    return toProtocolUsage(row as unknown as PrismaProtocolUsage)
  }

  async updateCheckedState(
    usageId: string,
    tenantId: string,
    checkedState: Record<string, boolean>,
    completedAt: Date | null | undefined,
    notes: string | null | undefined,
  ): Promise<ConsultationProtocolUsage> {
    const row = await this.prisma.protocolUsage.update({
      where: { id: usageId, tenantId, deletedAt: null },
      data: {
        checkedState: checkedState as Prisma.InputJsonValue,
        ...(completedAt !== undefined ? { completedAt } : {}),
        ...(notes !== undefined ? { notes } : {}),
      },
      include: {
        protocol: { select: { title: true, type: { select: { name: true } } } },
        protocolVersion: { select: { versionNumber: true } },
      },
    })
    return toProtocolUsage(row as unknown as PrismaProtocolUsage)
  }

  async removeProtocolUsage(usageId: string, tenantId: string): Promise<void> {
    await this.prisma.protocolUsage.update({
      where: { id: usageId, tenantId, deletedAt: null },
      data: { deletedAt: new Date() },
    })
  }

  async findProtocolUsageById(
    usageId: string,
    tenantId: string,
  ): Promise<ConsultationProtocolUsage | null> {
    const row = await this.prisma.protocolUsage.findFirst({
      where: { id: usageId, tenantId, deletedAt: null },
      include: {
        protocol: { select: { title: true, type: { select: { name: true } } } },
        protocolVersion: { select: { versionNumber: true } },
      },
    })
    return row ? toProtocolUsage(row as unknown as PrismaProtocolUsage) : null
  }
}
