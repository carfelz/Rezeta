import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common'
import type {
  ConsultationRecordDto,
  ConsultationRecordKind,
  RecordSection,
  UpdateRecordSectionsDto,
  ProtocolBlock,
  HistoriaMapping,
} from '@rezeta/shared'
import { ErrorCode, generateRecordSections } from '@rezeta/shared'
import type { GenerateRecordSectionsInput } from '@rezeta/shared'
import { ConsultationRecordsRepository } from './consultation-records.repository.js'
import { PrismaService } from '../../lib/prisma.service.js'
import { AuditLogService } from '../../common/audit-log/audit-log.service.js'
import { httpAuditContextStore } from '../../common/audit-log/audit-context.store.js'
import type { ExpedientePdfData, HistoriaMedicaPdfData } from '../../lib/pdf.service.js'

@Injectable()
export class ConsultationRecordsService {
  constructor(
    @Inject(ConsultationRecordsRepository) private repo: ConsultationRecordsRepository,
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(AuditLogService) private auditLog: AuditLogService,
  ) {}

  async getLatest(consultationId: string, tenantId: string): Promise<ConsultationRecordDto> {
    const record = await this.repo.findLatest(consultationId, tenantId)
    if (!record) {
      throw new NotFoundException({
        code: ErrorCode.RECORD_NOT_FOUND,
        message: 'Esta consulta no tiene historia médica generada',
      })
    }
    return record
  }

  /** Creates v1 if the consultation has no record yet; otherwise returns the latest. */
  async ensureDraft(consultationId: string, tenantId: string): Promise<ConsultationRecordDto> {
    const existing = await this.repo.findLatest(consultationId, tenantId)
    if (existing) return existing
    const { input, patientId } = await this.buildGenerationInput(consultationId, tenantId)
    const record = await this.repo.create({
      tenantId,
      consultationId,
      patientId,
      versionNumber: 1,
      kind: input.kind,
      sections: generateRecordSections(input),
      generatedAt: new Date(),
    })
    this.audit(tenantId, record.id, 'create')
    return record
  }

  /**
   * Draft latest → re-derive its sections in place (discards edits).
   * Signed latest + amended consultation → next version with enmiendas.
   * Signed latest, no amendment → conflict.
   */
  async regenerate(consultationId: string, tenantId: string): Promise<ConsultationRecordDto> {
    const latest = await this.repo.findLatest(consultationId, tenantId)
    if (!latest) return this.ensureDraft(consultationId, tenantId)
    const { input, patientId } = await this.buildGenerationInput(consultationId, tenantId)

    if (latest.status === 'draft') {
      const updated = await this.repo.replaceSections(latest.id, tenantId, generateRecordSections(input))
      if (!updated) {
        throw new ConflictException({
          code: ErrorCode.RECORD_NOT_DRAFT,
          message: 'La historia ya no es un borrador',
        })
      }
      this.audit(tenantId, latest.id, 'update')
      return updated
    }

    if (input.amendments.length === 0) {
      throw new ConflictException({
        code: ErrorCode.RECORD_ALREADY_SIGNED,
        message: 'La historia firmada solo puede regenerarse tras una enmienda de la consulta',
      })
    }
    const record = await this.repo.create({
      tenantId,
      consultationId,
      patientId,
      versionNumber: latest.versionNumber + 1,
      kind: latest.kind,
      sections: generateRecordSections({ ...input, kind: latest.kind }),
      generatedAt: new Date(),
    })
    this.audit(tenantId, record.id, 'create')
    return record
  }

  async updateSections(
    consultationId: string,
    tenantId: string,
    dto: UpdateRecordSectionsDto,
  ): Promise<ConsultationRecordDto> {
    if (dto.sections.some((s) => s.key === 'ficha_identificacion')) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'La ficha de identificación se corrige en el expediente del paciente',
      })
    }
    const latest = await this.getLatest(consultationId, tenantId)
    if (latest.status !== 'draft') {
      throw new ConflictException({
        code: ErrorCode.RECORD_NOT_DRAFT,
        message: 'La historia firmada es de solo lectura',
      })
    }
    const edits = new Map(dto.sections.map((s) => [s.key, s.content]))
    const merged: RecordSection[] = latest.sections.map((section) => {
      const editedContent = edits.get(section.key)
      return editedContent === undefined
        ? section
        : { ...section, content: editedContent, source: 'edited' as const }
    })
    const updated = await this.repo.replaceSections(latest.id, tenantId, merged)
    if (!updated) {
      throw new ConflictException({
        code: ErrorCode.RECORD_NOT_DRAFT,
        message: 'La historia firmada es de solo lectura',
      })
    }
    this.audit(tenantId, latest.id, 'update')
    return updated
  }

  async sign(consultationId: string, tenantId: string, userId: string): Promise<ConsultationRecordDto> {
    const latest = await this.getLatest(consultationId, tenantId)
    if (latest.status !== 'draft') {
      throw new ConflictException({
        code: ErrorCode.RECORD_ALREADY_SIGNED,
        message: 'La historia ya está firmada',
      })
    }
    const missing = latest.sections
      .filter((s) => s.required && s.content.trim() === '')
      .map((s) => s.key)
    if (missing.length > 0) {
      throw new BadRequestException({
        code: ErrorCode.RECORD_REQUIRED_SECTIONS_MISSING,
        message: `Faltan ${missing.length} sección(es) requerida(s) antes de firmar`,
        details: { missing },
      })
    }
    const signed = await this.repo.sign(latest.id, tenantId, userId)
    if (!signed) {
      throw new ConflictException({
        code: ErrorCode.RECORD_ALREADY_SIGNED,
        message: 'La historia ya está firmada',
      })
    }
    this.audit(tenantId, latest.id, 'update')
    return signed
  }

  async getPdfData(consultationId: string, tenantId: string): Promise<HistoriaMedicaPdfData> {
    const record = await this.getLatest(consultationId, tenantId)
    const c = await this.prisma.consultation.findFirst({
      where: { id: consultationId, tenantId, deletedAt: null },
      include: { patient: true, doctor: true, location: true },
    })
    if (!c) {
      throw new NotFoundException({
        code: ErrorCode.CONSULTATION_NOT_FOUND,
        message: 'Consultation not found',
      })
    }
    return {
      record,
      doctor: {
        fullName: c.doctor.fullName,
        specialty: c.doctor.specialty,
        licenseNumber: c.doctor.licenseNumber,
      },
      patient: {
        firstName: c.patient.firstName,
        lastName: c.patient.lastName,
        dateOfBirth: c.patient.dateOfBirth ? c.patient.dateOfBirth.toISOString() : null,
        documentNumber: c.patient.documentNumber,
        documentType: c.patient.documentType,
      },
      location: c.location ? { name: c.location.name, address: c.location.address } : null,
      startedAt: c.startedAt.toISOString(),
    }
  }

  async getExpedienteData(patientId: string, tenantId: string): Promise<ExpedientePdfData> {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, tenantId, deletedAt: null },
      include: { owner: true },
    })
    if (!patient) {
      throw new NotFoundException({
        code: ErrorCode.PATIENT_NOT_FOUND,
        message: 'Patient not found',
      })
    }
    const rows = await this.prisma.consultationRecord.findMany({
      where: { tenantId, patientId, status: 'signed', deletedAt: null },
      orderBy: { signedAt: 'desc' },
      include: { consultation: { include: { location: true } } },
    })
    // Only the latest signed version per consultation (append-only versions).
    const latestByConsultation = new Map<string, (typeof rows)[number]>()
    for (const row of rows) {
      const existing = latestByConsultation.get(row.consultationId)
      if (!existing || row.versionNumber > existing.versionNumber) {
        latestByConsultation.set(row.consultationId, row)
      }
    }
    return {
      patient: {
        firstName: patient.firstName,
        lastName: patient.lastName,
        dateOfBirth: patient.dateOfBirth ? patient.dateOfBirth.toISOString() : null,
        documentNumber: patient.documentNumber,
        documentType: patient.documentType,
      },
      doctor: {
        fullName: patient.owner.fullName,
        specialty: patient.owner.specialty,
        licenseNumber: patient.owner.licenseNumber,
      },
      generatedAt: new Date().toISOString(),
      entries: [...latestByConsultation.values()].map((row) => ({
        record: {
          kind: row.kind as ConsultationRecordKind,
          status: 'signed' as const,
          versionNumber: row.versionNumber,
          generatedAt: row.generatedAt.toISOString(),
          signedAt: row.signedAt?.toISOString() ?? null,
          sections: row.sections as unknown as RecordSection[],
        },
        location: row.consultation.location
          ? { name: row.consultation.location.name, address: row.consultation.location.address }
          : null,
        startedAt: row.consultation.startedAt.toISOString(),
      })),
    }
  }

  /** Loads everything the mapper needs. Throws if the consultation is missing or unsigned. */
  private async buildGenerationInput(
    consultationId: string,
    tenantId: string,
  ): Promise<{ input: GenerateRecordSectionsInput; patientId: string }> {
    const c = await this.prisma.consultation.findFirst({
      where: { id: consultationId, tenantId, deletedAt: null },
      include: {
        patient: true,
        protocolUsages: { where: { deletedAt: null } },
        prescriptions: { where: { deletedAt: null }, include: { prescriptionItems: true } },
        labOrders: { where: { deletedAt: null }, include: { items: true } },
        imagingOrders: { where: { deletedAt: null }, include: { items: true } },
        amendments: true,
      },
    })
    if (!c) {
      throw new NotFoundException({
        code: ErrorCode.CONSULTATION_NOT_FOUND,
        message: 'Consultation not found',
      })
    }
    if (c.status !== 'signed' && c.status !== 'amended') {
      throw new ConflictException({
        code: ErrorCode.RECORD_CONSULTATION_NOT_SIGNED,
        message: 'La historia se genera al firmar la consulta',
      })
    }

    const priorSigned = await this.prisma.consultation.count({
      where: {
        tenantId,
        patientId: c.patientId,
        status: { in: ['signed', 'amended'] },
        signedAt: { lt: c.signedAt ?? new Date() },
        id: { not: c.id },
        deletedAt: null,
      },
    })
    const kind: ConsultationRecordKind = priorSigned === 0 ? 'first_visit' : 'evolution'

    const input: GenerateRecordSectionsInput = {
      kind,
      patient: {
        firstName: c.patient.firstName,
        lastName: c.patient.lastName,
        dateOfBirth: c.patient.dateOfBirth ? c.patient.dateOfBirth.toISOString() : null,
        sex: c.patient.sex,
        documentType: c.patient.documentType,
        documentNumber: c.patient.documentNumber,
        phone: c.patient.phone,
        address: c.patient.address,
        allergies: (c.patient.allergies as string[] | null) ?? [],
        chronicConditions: (c.patient.chronicConditions as string[] | null) ?? [],
      },
      usages: c.protocolUsages.map((u) => {
        const content = u.content as {
          blocks?: ProtocolBlock[]
          historia_mapping?: HistoriaMapping
        } | null
        return {
          blocks: content?.blocks ?? [],
          ...(content?.historia_mapping ? { historiaMapping: content.historia_mapping } : {}),
          modifications: (u.modifications ?? {}) as GenerateRecordSectionsInput['usages'][number]['modifications'],
        }
      }),
      orders: {
        prescriptionItems: c.prescriptions.flatMap((p) =>
          p.prescriptionItems.map((i) => ({
            drug: i.drug,
            dose: i.dose,
            route: i.route,
            frequency: i.frequency,
            duration: i.duration,
          })),
        ),
        labTests: c.labOrders.flatMap((o) => o.items.map((i) => i.testName)),
        imagingStudies: c.imagingOrders.flatMap((o) => o.items.map((i) => i.studyType)),
      },
      amendments: c.amendments.map((a) => ({
        reason: a.reason,
        amendedAt: a.amendedAt.toISOString(),
      })),
    }
    return { input, patientId: c.patientId }
  }

  /** Non-fatal audit write, mirrors the consultations-service pattern. */
  private audit(tenantId: string, entityId: string, action: 'create' | 'update'): void {
    const httpCtx = httpAuditContextStore.getStore()
    void this.auditLog.record({
      tenantId,
      ...(httpCtx?.actorUserId ? { actorUserId: httpCtx.actorUserId } : {}),
      actorType: httpCtx ? 'user' : 'system',
      category: 'entity',
      action,
      entityType: 'ConsultationRecord',
      entityId,
      status: 'success',
    })
  }
}
