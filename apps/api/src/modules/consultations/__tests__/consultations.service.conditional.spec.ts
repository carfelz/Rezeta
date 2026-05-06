import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ConsultationsService } from '../consultations.service.js'
import type { ConsultationsRepository } from '../consultations.repository.js'
import type { PrismaService } from '../../../lib/prisma.service.js'
import type { InvoicesService } from '../../invoices/invoices.service.js'
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
    modificationSummary: null,
    checkedState: {},
    modifications: {},
    content: { version: '1.0', blocks },
  }
}

function makeConsultation(
  usage: ConsultationProtocolUsage,
  vitals: ConsultationWithDetails['vitals'] = null,
): ConsultationWithDetails {
  return {
    id: 'c1',
    tenantId: 't1',
    patientId: 'pat1',
    locationId: 'loc1',
    userId: 'u1',
    appointmentId: null,
    consultedAt: new Date().toISOString(),
    chiefComplaint: 'Cefaleas',
    subjective: '',
    objective: '',
    assessment: 'Migraña',
    plan: '',
    vitals,
    diagnoses: ['Migraña'],
    status: 'draft',
    signedAt: null,
    signedBy: null,
    contentHash: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
    patientName: 'Isabel',
    locationName: 'Centro',
    doctorName: 'Dr. García',
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
      {} as unknown as InvoicesService,
    )
  })

  it('appends a conditional_steps_activated entry when rule matches new vitals', async () => {
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
    const before = makeConsultation(usage, null)
    const after = makeConsultation(usage, {
      bloodPressureSystolic: 168,
      bloodPressureDiastolic: 102,
    } as ConsultationWithDetails['vitals'])
    repo.findById.mockResolvedValue(before)
    repo.update.mockResolvedValue(after)
    repo.updateProtocolUsage.mockImplementation(async (_uid, _tid, dto) => ({
      ...usage,
      modifications: dto.modifications,
    }))

    const result = await svc.update('c1', 't1', { vitals: { bloodPressureSystolic: 168 } })

    expect(repo.updateProtocolUsage).toHaveBeenCalledTimes(1)
    const written = repo.updateProtocolUsage.mock.calls[0][2]
    const activations = written.modifications.conditional_steps_activated
    expect(activations).toHaveLength(1)
    expect(activations[0].block_id).toBe('blk-cond')
    expect(activations[0].branch_label).toBe('PA >= 160')
    expect(result.protocolUsages[0]?.modifications.conditional_steps_activated).toHaveLength(1)
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
    const after = makeConsultation(usage, {
      bloodPressureSystolic: 168,
    } as ConsultationWithDetails['vitals'])
    repo.findById.mockResolvedValue(after)
    repo.update.mockResolvedValue(after)

    await svc.update('c1', 't1', { vitals: { bloodPressureSystolic: 168 } })

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
    const after = makeConsultation(usage, {
      bloodPressureSystolic: 130,
    } as ConsultationWithDetails['vitals'])
    repo.findById.mockResolvedValue(after)
    repo.update.mockResolvedValue(after)

    await svc.update('c1', 't1', { vitals: { bloodPressureSystolic: 130 } })

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
    const after = makeConsultation(usage, {
      bloodPressureSystolic: 168,
    } as ConsultationWithDetails['vitals'])
    repo.findById.mockResolvedValue(after)
    repo.update.mockResolvedValue(after)

    await svc.update('c1', 't1', { vitals: { bloodPressureSystolic: 168 } })

    expect(repo.updateProtocolUsage).not.toHaveBeenCalled()
  })

  it('walks into sections to find conditional children', async () => {
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
    const after = makeConsultation(usage, {
      bloodPressureSystolic: 170,
    } as ConsultationWithDetails['vitals'])
    repo.findById.mockResolvedValue(after)
    repo.update.mockResolvedValue(after)
    repo.updateProtocolUsage.mockImplementation(async (_uid, _tid, dto) => ({
      ...usage,
      modifications: dto.modifications,
    }))

    await svc.update('c1', 't1', { vitals: { bloodPressureSystolic: 170 } })

    expect(repo.updateProtocolUsage).toHaveBeenCalledTimes(1)
  })
})
