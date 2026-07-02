import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common'
import type {
  ConsultationWithDetails,
  ConsultationProtocolUsage,
  ResumableConsultation,
  ProtocolBlock,
  SignConsultationResponse,
} from '@rezeta/shared'
import type {
  CreateConsultationDto,
  AmendConsultationDto,
  AddProtocolUsageDto,
  UpdateProtocolUsageDto,
} from '@rezeta/shared'
import { ErrorCode, computeMissingRequiredFields, evaluateConditionalRule } from '@rezeta/shared'
import type { ConditionalStepActivated } from '@rezeta/shared'

// Stub types removed from shared in schema reset v2
type UpdateConsultationDto = Record<string, never>
type UpdateCheckedStateDto = {
  completedAt?: string | null | undefined
  notes?: string | null | undefined
}
import { ConsultationsRepository, type ConsultationListParams } from './consultations.repository.js'
import { PrismaService } from '../../lib/prisma.service.js'
import { InvoicesService } from '../invoices/invoices.service.js'
import { ProtocolRecommendationsService } from '../protocol-recommendations/protocol-recommendations.service.js'

@Injectable()
export class ConsultationsService {
  constructor(
    @Inject(ConsultationsRepository) private repo: ConsultationsRepository,
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(InvoicesService) private invoicesSvc: InvoicesService,
    @Inject(ProtocolRecommendationsService)
    private recommendationsSvc: ProtocolRecommendationsService,
  ) {}

  list(params: ConsultationListParams): Promise<ConsultationWithDetails[]> {
    return this.repo.findMany(params)
  }

  /**
   * Resume-banner data for a patient. Returns null when no in-progress
   * consultation exists or the latest one is younger than minElapsedMinutes
   * (avoids nagging the doctor right after they save).
   *
   * Window: status='draft', age ≤ 7 days. Eligibility: elapsed ≥ 10 minutes.
   */
  async getResumableForPatient(
    tenantId: string,
    userId: string,
    patientId: string,
  ): Promise<ResumableConsultation | null> {
    const c = await this.repo.findResumableForPatient(tenantId, userId, patientId, 7)
    if (!c) return null
    const elapsedMs = Date.now() - new Date(c.updatedAt).getTime()
    const elapsedMinutes = Math.floor(elapsedMs / 60_000)
    if (elapsedMinutes < 10) return null

    const usage = c.protocolUsages[0] ?? null
    const ages = computeStepProgress(usage)
    const ageYears = c.patientName ? null : null // placeholder — patient age not on this DTO; client can compute
    return {
      consultationId: c.id,
      patientId: c.patientId,
      patientName: c.patientName,
      patientAge: ageYears,
      protocolUsage: usage,
      currentStepNumber: ages.currentStepNumber,
      currentStepTitle: ages.currentStepTitle,
      totalSteps: ages.totalSteps,
      completedSteps: ages.completedSteps,
      lastEditField: inferLastEditField(c),
      lastEditTime: c.updatedAt,
      elapsedMinutes,
    }
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

  async create(
    tenantId: string,
    userId: string,
    dto: CreateConsultationDto,
  ): Promise<ConsultationWithDetails> {
    if (dto.appointmentId != null) {
      const appt = await this.prisma.appointment.findFirst({
        where: { id: dto.appointmentId, tenantId, deletedAt: null },
        select: { status: true },
      })
      if (!appt) {
        throw new NotFoundException({
          code: ErrorCode.APPOINTMENT_NOT_FOUND,
          message: 'Appointment not found',
        })
      }
      if (appt.status !== 'scheduled' && appt.status !== 'in_progress') {
        throw new ConflictException({
          code: ErrorCode.APPOINTMENT_NOT_STARTABLE,
          message: `Cannot start a consultation on a ${appt.status} appointment`,
        })
      }
      const existing = await this.repo.findOpenByAppointment(dto.appointmentId, tenantId)
      if (existing) return existing
    }
    const result = await this.repo.create(tenantId, userId, dto)
    this.recommendationsSvc.invalidate(tenantId, userId, dto.patientId)
    return result
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
    const updated = await this.repo.update(id, tenantId, dto)
    return this.applyConditionalRules(updated, tenantId)
  }

  /**
   * Walks every in-progress protocol usage on this consultation, evaluates the
   * `conditional_rule` on each block against current vitals/SOAP, and appends
   * any newly-matched rules to `modifications.conditional_steps_activated[]`.
   *
   * Activations stay in the audit trail forever (per product decision); we
   * only ever append, never remove. If a block is already activated we don't
   * re-add it.
   */
  private async applyConditionalRules(
    c: ConsultationWithDetails,
    tenantId: string,
  ): Promise<ConsultationWithDetails> {
    const ctx = {}
    const updatedUsages: ConsultationProtocolUsage[] = []
    let anyChanged = false
    for (const usage of c.protocolUsages) {
      if (usage.status !== 'in_progress') {
        updatedUsages.push(usage)
        continue
      }
      const blocks = usage.content?.blocks ?? []
      const existing = usage.modifications?.conditional_steps_activated ?? []
      const seen = new Set(existing.map((e) => e.block_id))
      const newActivations: ConditionalStepActivated[] = []
      walkConditionalBlocks(blocks, (block) => {
        if (seen.has(block.id)) return
        if (!block.conditional_rule) return
        if (!evaluateConditionalRule(block.conditional_rule, ctx)) return
        newActivations.push({
          block_id: block.id,
          condition: JSON.stringify(block.conditional_rule),
          branch_label: block.conditional_label ?? '',
          timestamp: new Date().toISOString(),
        })
        seen.add(block.id)
      })
      if (newActivations.length === 0) {
        updatedUsages.push(usage)
        continue
      }
      const nextMods = {
        ...usage.modifications,
        conditional_steps_activated: [...existing, ...newActivations],
      }
      const written = await this.repo.updateProtocolUsage(usage.id, tenantId, {
        modifications: nextMods as unknown as UpdateProtocolUsageDto['modifications'],
      })
      updatedUsages.push(written)
      anyChanged = true
    }
    if (!anyChanged) return c
    return { ...c, protocolUsages: updatedUsages }
  }

  async sign(id: string, tenantId: string, userId: string): Promise<SignConsultationResponse> {
    const c = await this.getById(id, tenantId)
    if (c.status !== 'open') {
      throw new ConflictException({
        code: ErrorCode.CONSULTATION_ALREADY_SIGNED,
        message: `Consultation is already ${c.status}`,
      })
    }

    // Protocol-first: a consultation with no clinical content cannot be signed.
    if (c.protocolUsages.length === 0) {
      throw new BadRequestException({
        code: ErrorCode.CONSULTATION_REQUIRES_PROTOCOL,
        message: 'Agrega al menos un protocolo antes de firmar la consulta',
      })
    }

    // ── Required-fields validation (protocol-required blocks) ──────────────
    const missing = computeMissingRequiredFields(c.protocolUsages)
    if (missing.length > 0) {
      throw new BadRequestException({
        code: ErrorCode.CONSULTATION_MISSING_REQUIRED_FIELDS,
        message: `Faltan ${missing.length} campo(s) requerido(s) antes de firmar`,
        details: { missing },
      })
    }

    // Signs the consultation and completes the linked appointment atomically.
    const result = await this.repo.sign(id, tenantId, userId, c.appointmentId ?? null)

    // Auto-create draft invoice from DoctorLocation fee. Invoice failure never
    // fails the sign — the outcome is reported back instead.
    const invoiceOutcome = await this.invoicesSvc.createFromConsultation({
      consultationId: id,
      patientId: c.patientId,
      locationId: c.locationId,
      userId,
      tenantId,
    })

    return { ...result, invoiceOutcome }
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
    const consultation = await this.getById(consultationId, tenantId)

    const protocol = await this.prisma.protocol.findFirst({
      where: { id: dto.protocolId, tenantId, deletedAt: null },
      select: { currentVersionId: true },
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

    const usage = await this.repo.launchProtocolUsage({
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
    this.recommendationsSvc.invalidate(tenantId, userId, consultation.patientId)
    return usage
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
    return this.repo.updateCheckedState(usageId, tenantId, completedAt, dto.notes)
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface StepProgress {
  currentStepNumber: number | null
  currentStepTitle: string | null
  totalSteps: number | null
  completedSteps: number | null
}

function computeStepProgress(usage: ConsultationProtocolUsage | null): StepProgress {
  if (!usage) {
    return {
      currentStepNumber: null,
      currentStepTitle: null,
      totalSteps: null,
      completedSteps: null,
    }
  }
  const steps = collectStepsFromBlocks(usage.content?.blocks ?? [])
  const checkedState: Record<string, boolean> = {}
  for (const ev of usage.modifications?.checklist_items ?? []) {
    checkedState[ev.item_id] = ev.checked
  }
  const totalSteps = steps.length
  const completedSteps = steps.filter((s) => checkedState[s.id]).length
  const currentIndex = steps.findIndex((s) => !checkedState[s.id])
  if (currentIndex === -1) {
    return { currentStepNumber: totalSteps, currentStepTitle: null, totalSteps, completedSteps }
  }
  const current = steps[currentIndex]
  return {
    currentStepNumber: currentIndex + 1,
    currentStepTitle: current?.title ?? null,
    totalSteps,
    completedSteps,
  }
}

function collectStepsFromBlocks(blocks: ProtocolBlock[]): { id: string; title: string }[] {
  const out: { id: string; title: string }[] = []
  function walk(arr: ProtocolBlock[]): void {
    for (const block of arr) {
      if (block.type === 'section') walk(block.blocks)
      else if (block.type === 'checklist')
        for (const it of block.items) out.push({ id: it.id, title: it.text })
      else if (block.type === 'steps')
        for (const st of block.steps) out.push({ id: st.id, title: st.title })
    }
  }
  walk(blocks)
  return out
}

/**
 * Depth-first walk of a block tree. Calls `visit` on each non-section block
 * (sections themselves are containers and are not directly conditional).
 */
function walkConditionalBlocks(
  blocks: ProtocolBlock[],
  visit: (block: ProtocolBlock) => void,
): void {
  for (const block of blocks) {
    if (block.type === 'section') {
      walkConditionalBlocks(block.blocks, visit)
      continue
    }
    visit(block)
  }
}

function inferLastEditField(_c: ConsultationWithDetails): string | null {
  // SOAP fields removed in schema reset v2; last-edit field inference retired.
  return null
}
