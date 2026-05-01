import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common'
import { createHash } from 'crypto'
import type { ConsultationWithDetails, ConsultationProtocolUsage } from '@rezeta/shared'
import type {
  CreateConsultationDto,
  UpdateConsultationDto,
  AmendConsultationDto,
  AddProtocolUsageDto,
  UpdateCheckedStateDto,
  UpdateProtocolUsageDto,
} from '@rezeta/shared'
import { ErrorCode } from '@rezeta/shared'
import { ConsultationsRepository, type ConsultationListParams } from './consultations.repository.js'
import { PrismaService } from '../../lib/prisma.service.js'

@Injectable()
export class ConsultationsService {
  constructor(
    @Inject(ConsultationsRepository) private repo: ConsultationsRepository,
    @Inject(PrismaService) private prisma: PrismaService,
  ) {}

  list(params: ConsultationListParams): Promise<ConsultationWithDetails[]> {
    return this.repo.findMany(params)
  }

  async getById(id: string, tenantId: string): Promise<ConsultationWithDetails> {
    const c = await this.repo.findById(id, tenantId)
    if (!c) {
      throw new NotFoundException({
        code: ErrorCode.CONSULTATION_NOT_FOUND,
        message: 'Consultation not found',
      })
    }
    return c
  }

  create(
    tenantId: string,
    userId: string,
    dto: CreateConsultationDto,
  ): Promise<ConsultationWithDetails> {
    return this.repo.create(tenantId, userId, dto)
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdateConsultationDto,
  ): Promise<ConsultationWithDetails> {
    const c = await this.getById(id, tenantId)
    if (c.status === 'signed') {
      throw new ConflictException({
        code: ErrorCode.CONSULTATION_ALREADY_SIGNED,
        message: 'Cannot edit a signed consultation — use amend instead',
      })
    }
    return this.repo.update(id, tenantId, dto)
  }

  async sign(id: string, tenantId: string, userId: string): Promise<ConsultationWithDetails> {
    const c = await this.getById(id, tenantId)
    if (c.status === 'signed') {
      throw new ConflictException({
        code: ErrorCode.CONSULTATION_ALREADY_SIGNED,
        message: 'Consultation is already signed',
      })
    }
    const contentHash = createHash('sha256')
      .update(
        JSON.stringify({
          chiefComplaint: c.chiefComplaint,
          subjective: c.subjective,
          objective: c.objective,
          assessment: c.assessment,
          plan: c.plan,
          vitals: c.vitals,
          diagnoses: c.diagnoses,
        }),
      )
      .digest('hex')
    return this.repo.sign(id, tenantId, userId, contentHash)
  }

  async amend(
    id: string,
    tenantId: string,
    userId: string,
    dto: AmendConsultationDto,
  ): Promise<ConsultationWithDetails> {
    const c = await this.getById(id, tenantId)
    if (c.status !== 'signed') {
      throw new BadRequestException({
        code: ErrorCode.CONSULTATION_NOT_SIGNED,
        message: 'Only signed consultations can be amended',
      })
    }
    return this.repo.createAmendment(id, tenantId, userId, dto)
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const c = await this.getById(id, tenantId)
    if (c.status === 'signed') {
      throw new ConflictException({
        code: ErrorCode.CONSULTATION_ALREADY_SIGNED,
        message: 'Signed consultations cannot be deleted',
      })
    }
    await this.repo.softDelete(id, tenantId)
  }

  // ── Protocol usages ──────────────────────────────────────────────────────

  async addProtocolUsage(
    consultationId: string,
    tenantId: string,
    userId: string,
    dto: AddProtocolUsageDto,
  ): Promise<ConsultationProtocolUsage> {
    await this.getById(consultationId, tenantId)

    const protocol = await this.prisma.protocol.findFirst({
      where: { id: dto.protocolId, tenantId, deletedAt: null },
      select: {
        currentVersionId: true,
        type: { select: { templateId: true } },
      },
    })
    if (!protocol) {
      throw new NotFoundException({
        code: ErrorCode.PROTOCOL_NOT_FOUND,
        message: 'Protocol not found',
      })
    }
    if (!protocol.currentVersionId) {
      throw new BadRequestException({
        code: ErrorCode.PROTOCOL_HAS_NO_ACTIVE_VERSION,
        message: 'Protocol has no published version',
      })
    }

    // Validate parent usage if provided
    if (dto.parentUsageId) {
      const parent = await this.repo.findProtocolUsageById(dto.parentUsageId, tenantId)
      if (!parent || parent.consultationId !== consultationId) {
        throw new NotFoundException({
          code: ErrorCode.PARENT_USAGE_NOT_FOUND,
          message: 'Parent protocol usage not found',
        })
      }
    }

    // Fetch the version content to use as the working copy
    const version = await this.prisma.protocolVersion.findFirst({
      where: { id: protocol.currentVersionId, tenantId },
    })
    if (!version) {
      throw new BadRequestException({
        code: ErrorCode.PROTOCOL_HAS_NO_ACTIVE_VERSION,
        message: 'Protocol version not found',
      })
    }

    // Compute chain depth
    const depth = dto.parentUsageId ? await this.repo.getUsageDepth(dto.parentUsageId, tenantId) : 0

    return this.repo.launchProtocolUsage({
      consultationId,
      tenantId,
      userId,
      protocolId: dto.protocolId,
      protocolVersionId: protocol.currentVersionId,
      content: version.content as Record<string, unknown>,
      ...(dto.parentUsageId !== undefined && { parentUsageId: dto.parentUsageId }),
      ...(dto.triggerBlockId !== undefined && { triggerBlockId: dto.triggerBlockId }),
      depth,
    })
  }

  async updateProtocolUsage(
    consultationId: string,
    usageId: string,
    tenantId: string,
    dto: UpdateProtocolUsageDto,
  ): Promise<ConsultationProtocolUsage> {
    await this.getById(consultationId, tenantId)
    const usage = await this.repo.findProtocolUsageById(usageId, tenantId)
    if (!usage || usage.consultationId !== consultationId) {
      throw new NotFoundException({
        code: ErrorCode.PROTOCOL_USAGE_NOT_FOUND,
        message: 'Protocol usage not found',
      })
    }
    return this.repo.updateProtocolUsage(usageId, tenantId, dto)
  }

  async updateCheckedState(
    consultationId: string,
    usageId: string,
    tenantId: string,
    dto: UpdateCheckedStateDto,
  ): Promise<ConsultationProtocolUsage> {
    await this.getById(consultationId, tenantId)
    const usage = await this.repo.findProtocolUsageById(usageId, tenantId)
    if (!usage || usage.consultationId !== consultationId) {
      throw new NotFoundException({
        code: ErrorCode.PROTOCOL_USAGE_NOT_FOUND,
        message: 'Protocol usage not found',
      })
    }
    const completedAt =
      dto.completedAt === undefined
        ? undefined
        : dto.completedAt === null
          ? null
          : new Date(dto.completedAt)
    return this.repo.updateCheckedState(usageId, tenantId, dto.checkedState, completedAt, dto.notes)
  }

  async getProtocolUsage(
    consultationId: string,
    usageId: string,
    tenantId: string,
  ): Promise<ConsultationProtocolUsage> {
    await this.getById(consultationId, tenantId)
    const usage = await this.repo.findProtocolUsageById(usageId, tenantId)
    if (!usage || usage.consultationId !== consultationId) {
      throw new NotFoundException({
        code: ErrorCode.PROTOCOL_USAGE_NOT_FOUND,
        message: 'Protocol usage not found',
      })
    }
    return usage
  }

  async removeProtocolUsage(
    consultationId: string,
    usageId: string,
    tenantId: string,
  ): Promise<void> {
    await this.getById(consultationId, tenantId)
    const usage = await this.repo.findProtocolUsageById(usageId, tenantId)
    if (!usage || usage.consultationId !== consultationId) {
      throw new NotFoundException({
        code: ErrorCode.PROTOCOL_USAGE_NOT_FOUND,
        message: 'Protocol usage not found',
      })
    }
    await this.repo.removeProtocolUsage(usageId, tenantId)
  }
}
