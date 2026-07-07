import { Injectable, Inject } from '@nestjs/common'
import type {
  ConsultationRecordDto,
  ConsultationRecordKind,
  ConsultationRecordStatus,
  RecordSection,
} from '@rezeta/shared'
import { PrismaService } from '../../lib/prisma.service.js'

type RecordRow = {
  id: string
  consultationId: string
  patientId: string
  versionNumber: number
  kind: string
  status: string
  sections: unknown
  generatedAt: Date
  signedAt: Date | null
  signedBy: string | null
  createdAt: Date
  updatedAt: Date
}

function toDto(row: RecordRow): ConsultationRecordDto {
  return {
    id: row.id,
    consultationId: row.consultationId,
    patientId: row.patientId,
    versionNumber: row.versionNumber,
    kind: row.kind as ConsultationRecordKind,
    status: row.status as ConsultationRecordStatus,
    sections: row.sections as RecordSection[],
    generatedAt: row.generatedAt.toISOString(),
    signedAt: row.signedAt?.toISOString() ?? null,
    signedBy: row.signedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

@Injectable()
export class ConsultationRecordsRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async findLatest(consultationId: string, tenantId: string): Promise<ConsultationRecordDto | null> {
    const row = await this.prisma.consultationRecord.findFirst({
      where: { consultationId, tenantId, deletedAt: null },
      orderBy: { versionNumber: 'desc' },
    })
    return row ? toDto(row) : null
  }

  async create(data: {
    tenantId: string
    consultationId: string
    patientId: string
    versionNumber: number
    kind: ConsultationRecordKind
    sections: RecordSection[]
    generatedAt: Date
  }): Promise<ConsultationRecordDto> {
    const row = await this.prisma.consultationRecord.create({
      data: {
        tenantId: data.tenantId,
        consultationId: data.consultationId,
        patientId: data.patientId,
        versionNumber: data.versionNumber,
        kind: data.kind,
        status: 'draft',
        sections: data.sections as unknown as object,
        generatedAt: data.generatedAt,
      },
    })
    return toDto(row)
  }

  /** Draft-only. Returns null (no throw) when the record is not an editable draft. */
  async replaceSections(
    id: string,
    tenantId: string,
    sections: RecordSection[],
  ): Promise<ConsultationRecordDto | null> {
    const { count } = await this.prisma.consultationRecord.updateMany({
      where: { id, tenantId, status: 'draft', deletedAt: null },
      data: { sections: sections as unknown as object },
    })
    if (count === 0) return null
    const row = await this.prisma.consultationRecord.findFirst({
      where: { id, tenantId, deletedAt: null },
    })
    return row ? toDto(row) : null
  }

  /** Draft-only. Returns null when the record was not a draft (already signed). */
  async sign(id: string, tenantId: string, userId: string): Promise<ConsultationRecordDto | null> {
    const { count } = await this.prisma.consultationRecord.updateMany({
      where: { id, tenantId, status: 'draft', deletedAt: null },
      data: { status: 'signed', signedAt: new Date(), signedBy: userId },
    })
    if (count === 0) return null
    const row = await this.prisma.consultationRecord.findFirst({
      where: { id, tenantId, deletedAt: null },
    })
    return row ? toDto(row) : null
  }
}
