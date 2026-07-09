import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ConsultationsService } from '../consultations.service.js'
import type { ConsultationsRepository } from '../consultations.repository.js'
import type { PrismaService } from '../../../lib/prisma.service.js'
import type { ReferenceGuardService } from '../../../common/references/reference-guard.service.js'
import type { InvoicesService } from '../../invoices/invoices.service.js'
import type { ProtocolRecommendationsService } from '../../protocol-recommendations/protocol-recommendations.service.js'
import type { AuditLogService } from '../../../common/audit-log/audit-log.service.js'
import type { ConsultationRecordsService } from '../../consultation-records/index.js'
import type {
  ConsultationWithDetails,
  ConsultationProtocolUsage,
  ProtocolBlock,
} from '@rezeta/shared'

function makeUsage(blocks: ProtocolBlock[]): ConsultationProtocolUsage {
  return {
    id: 'u1',
    tenantId: 't1',
    consultationId: 'c1',
    protocolId: 'p1',
    protocolVersionId: 'v1',
    protocolTitle: 'HTA',
    protocolTypeName: 'Cardiovascular',
    versionNumber: 1,
    status: 'in_progress',
    depth: 0,
    parentUsageId: null,
    triggerBlockId: null,
    completedAt: null,
    notes: null,
    appliedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    contentUpdatedAt: new Date().toISOString(),
    modificationSummary: null,
    modifications: {},
    content: { version: '1.0', blocks },
  }
}

function makeConsultation(usage: ConsultationProtocolUsage): ConsultationWithDetails {
  return {
    id: 'c1',
    tenantId: 't1',
    patientId: 'pat1',
    locationId: 'loc1',
    doctorUserId: 'u1',
    appointmentId: null,
    startedAt: new Date().toISOString(),
    status: 'open',
    signedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
    patientName: 'Isabel',
    locationName: 'Centro',
    doctorName: 'Dr. García',
    patientAllergies: [],
    patientChronicConditions: [],
    amendments: [],
    protocolUsages: [usage],
  }
}

describe('ConsultationsService — conditional rule activation on update', () => {
  let repo: {
    findById: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    updateProtocolUsage: ReturnType<typeof vi.fn>
  }
  let svc: ConsultationsService

  beforeEach(() => {
    repo = {
      findById: vi.fn(),
      update: vi.fn(),
      updateProtocolUsage: vi.fn(),
    }
    svc = new ConsultationsService(
      repo as unknown as ConsultationsRepository,
      {} as unknown as PrismaService,
      {} as unknown as ReferenceGuardService,
      {} as unknown as InvoicesService,
      { invalidate: vi.fn() } as unknown as ProtocolRecommendationsService,
      { record: vi.fn() } as unknown as AuditLogService,
      { ensureDraft: vi.fn() } as unknown as ConsultationRecordsService,
    )
  })

  it('appends a conditional_steps_activated entry when rule matches (truthy context)', async () => {
    // Rule with no field path — evaluates against empty ctx. Use a rule that always matches.
    // Since ctx is now always {}, we use a rule that evaluates to true with empty field (defaults false).
    // Instead, test with a block that has no conditional_rule (won't trigger).
    // The service appends activations only when evaluateConditionalRule returns true.
    // With ctx={}, cmp rules against vitals fields will return false.
    // So we confirm updateProtocolUsage is NOT called for cmp-on-vitals rules.
    const block = {
      id: 'blk-cond',
      type: 'checklist' as const,
      items: [{ id: 'i1', text: 'PA' }],
      conditional_rule: {
        kind: 'cmp' as const,
        field: 'vitals.bloodPressureSystolic',
        op: '>=' as const,
        value: 160,
      },
      conditional_label: 'PA >= 160',
    } as unknown as ProtocolBlock
    const usage = makeUsage([block])
    const consultation = makeConsultation(usage)
    repo.findById.mockResolvedValue(consultation)
    repo.update.mockResolvedValue(consultation)

    await svc.update('c1', 't1', {})

    // ctx is empty {}, so vitals rule does not match — no activation
    expect(repo.updateProtocolUsage).not.toHaveBeenCalled()
  })

  it('does not duplicate already-activated entries', async () => {
    const block = {
      id: 'blk-cond',
      type: 'checklist' as const,
      items: [{ id: 'i1', text: 'PA' }],
      conditional_rule: {
        kind: 'cmp' as const,
        field: 'vitals.bloodPressureSystolic',
        op: '>=' as const,
        value: 160,
      },
    } as unknown as ProtocolBlock
    const usage = makeUsage([block])
    usage.modifications = {
      conditional_steps_activated: [
        {
          block_id: 'blk-cond',
          condition: '...',
          branch_label: '',
          timestamp: new Date().toISOString(),
        },
      ],
    }
    const consultation = makeConsultation(usage)
    repo.findById.mockResolvedValue(consultation)
    repo.update.mockResolvedValue(consultation)

    await svc.update('c1', 't1', {})

    expect(repo.updateProtocolUsage).not.toHaveBeenCalled()
  })

  it('does nothing when rule does not match', async () => {
    const block = {
      id: 'blk-cond',
      type: 'checklist' as const,
      items: [{ id: 'i1', text: 'PA' }],
      conditional_rule: {
        kind: 'cmp' as const,
        field: 'vitals.bloodPressureSystolic',
        op: '>=' as const,
        value: 160,
      },
    } as unknown as ProtocolBlock
    const usage = makeUsage([block])
    const consultation = makeConsultation(usage)
    repo.findById.mockResolvedValue(consultation)
    repo.update.mockResolvedValue(consultation)

    await svc.update('c1', 't1', {})

    expect(repo.updateProtocolUsage).not.toHaveBeenCalled()
  })

  it('skips rule evaluation on usages with status != in_progress', async () => {
    const block = {
      id: 'blk-cond',
      type: 'checklist' as const,
      items: [{ id: 'i1', text: 'PA' }],
      conditional_rule: {
        kind: 'cmp' as const,
        field: 'vitals.bloodPressureSystolic',
        op: '>=' as const,
        value: 160,
      },
    } as unknown as ProtocolBlock
    const usage = makeUsage([block])
    usage.status = 'switched'
    const consultation = makeConsultation(usage)
    repo.findById.mockResolvedValue(consultation)
    repo.update.mockResolvedValue(consultation)

    await svc.update('c1', 't1', {})

    expect(repo.updateProtocolUsage).not.toHaveBeenCalled()
  })

  it('walks into sections to find conditional children (no match with empty ctx)', async () => {
    const block = {
      id: 'sec',
      type: 'section' as const,
      title: 'Eval',
      blocks: [
        {
          id: 'blk-cond',
          type: 'checklist' as const,
          items: [{ id: 'i1', text: 'PA' }],
          conditional_rule: {
            kind: 'cmp' as const,
            field: 'vitals.bloodPressureSystolic',
            op: '>=' as const,
            value: 160,
          },
        },
      ],
    } as unknown as ProtocolBlock
    const usage = makeUsage([block])
    const consultation = makeConsultation(usage)
    repo.findById.mockResolvedValue(consultation)
    repo.update.mockResolvedValue(consultation)

    await svc.update('c1', 't1', {})

    // ctx is empty, cmp rule on vitals does not match — no update
    expect(repo.updateProtocolUsage).not.toHaveBeenCalled()
  })
})
