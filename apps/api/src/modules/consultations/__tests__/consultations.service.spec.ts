/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common'
import { ConsultationsService } from '../consultations.service.js'
import type { ConsultationsRepository } from '../consultations.repository.js'
import type { PrismaService } from '../../../lib/prisma.service.js'
import { ErrorCode } from '@rezeta/shared'
import type { ConsultationWithDetails, ConsultationProtocolUsage } from '@rezeta/shared'

const VALID_UUID = '00000000-0000-0000-0000-000000000001'

function mockConsultation(overrides: Partial<ConsultationWithDetails> = {}): ConsultationWithDetails {
  return {
    id: 'consult-1',
    tenantId: 'tenant-1',
    patientId: 'patient-1',
    locationId: 'location-1',
    doctorUserId: 'user-1',
    appointmentId: null,
    status: 'draft',
    chiefComplaint: null,
    subjective: null,
    objective: null,
    assessment: null,
    plan: null,
    vitals: null,
    diagnoses: [],
    contentHash: null,
    signedAt: null,
    signedBy: null,
    consultedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
    patientName: 'María García',
    locationName: 'Clínica Centro',
    amendments: [],
    protocolUsages: [],
    ...overrides,
  }
}

function mockProtocolUsage(overrides: Partial<ConsultationProtocolUsage> = {}): ConsultationProtocolUsage {
  return {
    id: 'usage-1',
    consultationId: 'consult-1',
    tenantId: 'tenant-1',
    userId: 'user-1',
    protocolId: 'protocol-1',
    protocolVersionId: 'version-1',
    content: {},
    parentUsageId: null,
    triggerBlockId: null,
    depth: 0,
    status: 'in_progress',
    checkedState: {},
    completedAt: null,
    notes: null,
    modifications: null,
    modificationSummary: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('ConsultationsService', () => {
  let repo: ConsultationsRepository
  let prisma: PrismaService
  let service: ConsultationsService

  beforeEach(() => {
    repo = {
      findMany: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      sign: vi.fn(),
      createAmendment: vi.fn(),
      softDelete: vi.fn(),
      findProtocolUsageById: vi.fn(),
      launchProtocolUsage: vi.fn(),
      updateProtocolUsage: vi.fn(),
      updateCheckedState: vi.fn(),
      removeProtocolUsage: vi.fn(),
      getUsageDepth: vi.fn(),
    } as unknown as ConsultationsRepository

    prisma = {
      protocol: { findFirst: vi.fn() },
      protocolVersion: { findFirst: vi.fn() },
      auditLog: { create: vi.fn() },
    } as unknown as PrismaService

    service = new ConsultationsService(repo, prisma)
  })

  // ── list / getById ─────────────────────────────────────────────────────────

  describe('list', () => {
    it('delegates to repository', async () => {
      vi.mocked(repo.findMany).mockResolvedValue([mockConsultation()])
      const result = await service.list({ tenantId: 'tenant-1', userId: 'user-1' })
      expect(result).toHaveLength(1)
    })
  })

  describe('getById', () => {
    it('returns consultation when found', async () => {
      const c = mockConsultation()
      vi.mocked(repo.findById).mockResolvedValue(c)
      expect(await service.getById('consult-1', 'tenant-1')).toEqual(c)
    })

    it('throws NotFoundException when not found', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null)
      await expect(service.getById('bad', 'tenant-1')).rejects.toThrow(NotFoundException)
    })

    it('error has CONSULTATION_NOT_FOUND code', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null)
      try {
        await service.getById('bad', 'tenant-1')
      } catch (err) {
        const body = (err as NotFoundException).getResponse() as { code: string }
        expect(body.code).toBe(ErrorCode.CONSULTATION_NOT_FOUND)
      }
    })
  })

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('delegates to repository', async () => {
      const c = mockConsultation()
      vi.mocked(repo.create).mockResolvedValue(c)
      const result = await service.create('tenant-1', 'user-1', {
        patientId: 'p-1',
        locationId: 'l-1',
        diagnoses: [],
      })
      expect(result).toEqual(c)
    })
  })

  // ── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates a draft consultation', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockConsultation())
      vi.mocked(repo.update).mockResolvedValue(mockConsultation({ plan: 'Nuevo plan' }))
      const result = await service.update('consult-1', 'tenant-1', { plan: 'Nuevo plan' })
      expect(result.plan).toBe('Nuevo plan')
    })

    it('throws ConflictException when consultation is already signed', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockConsultation({ status: 'signed' }))
      await expect(
        service.update('consult-1', 'tenant-1', { plan: 'X' }),
      ).rejects.toThrow(ConflictException)
    })

    it('thrown error has CONSULTATION_ALREADY_SIGNED code', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockConsultation({ status: 'signed' }))
      try {
        await service.update('consult-1', 'tenant-1', {})
      } catch (err) {
        const body = (err as ConflictException).getResponse() as { code: string }
        expect(body.code).toBe(ErrorCode.CONSULTATION_ALREADY_SIGNED)
      }
    })
  })

  // ── sign ───────────────────────────────────────────────────────────────────

  describe('sign', () => {
    it('signs a draft consultation and computes contentHash', async () => {
      const draft = mockConsultation({ status: 'draft', assessment: 'Migraña' })
      const signed = mockConsultation({ status: 'signed', contentHash: 'abc123' })
      vi.mocked(repo.findById).mockResolvedValue(draft)
      vi.mocked(repo.sign).mockResolvedValue(signed)
      const result = await service.sign('consult-1', 'tenant-1', 'user-1')
      expect(result.status).toBe('signed')
      // Verify that sign is called with a hex hash string
      const signCall = vi.mocked(repo.sign).mock.calls[0]
      expect(signCall?.[3]).toMatch(/^[a-f0-9]{64}$/)
    })

    it('throws ConflictException when already signed', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockConsultation({ status: 'signed' }))
      await expect(service.sign('consult-1', 'tenant-1', 'user-1')).rejects.toThrow(
        ConflictException,
      )
    })

    it('does not call repo.sign when already signed', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockConsultation({ status: 'signed' }))
      await service.sign('consult-1', 'tenant-1', 'user-1').catch(() => {})
      expect(repo.sign).not.toHaveBeenCalled()
    })
  })

  // ── amend ──────────────────────────────────────────────────────────────────

  describe('amend', () => {
    it('creates amendment on a signed consultation', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockConsultation({ status: 'signed' }))
      vi.mocked(repo.createAmendment).mockResolvedValue(mockConsultation({ status: 'signed' }))
      await service.amend('consult-1', 'tenant-1', 'user-1', {
        reason: 'Corrección del plan terapéutico.',
      })
      expect(repo.createAmendment).toHaveBeenCalledOnce()
    })

    it('throws BadRequestException when consultation is not signed', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockConsultation({ status: 'draft' }))
      await expect(
        service.amend('consult-1', 'tenant-1', 'user-1', { reason: 'Corrección necesaria.' }),
      ).rejects.toThrow(BadRequestException)
    })
  })

  // ── remove ─────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('soft-deletes a draft consultation', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockConsultation({ status: 'draft' }))
      vi.mocked(repo.softDelete).mockResolvedValue(undefined)
      await service.remove('consult-1', 'tenant-1')
      expect(repo.softDelete).toHaveBeenCalledOnce()
    })

    it('throws ConflictException when trying to delete signed consultation', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockConsultation({ status: 'signed' }))
      await expect(service.remove('consult-1', 'tenant-1')).rejects.toThrow(ConflictException)
    })
  })

  // ── addProtocolUsage ───────────────────────────────────────────────────────

  describe('addProtocolUsage', () => {
    it('throws NotFoundException when protocol not found', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockConsultation())
      vi.mocked(prisma.protocol.findFirst).mockResolvedValue(null)
      await expect(
        service.addProtocolUsage('consult-1', 'tenant-1', 'user-1', {
          protocolId: VALID_UUID,
        }),
      ).rejects.toThrow(NotFoundException)
    })

    it('throws BadRequestException when protocol has no active version', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockConsultation())
      vi.mocked(prisma.protocol.findFirst).mockResolvedValue({
        currentVersionId: null,
        type: { templateId: 'tmpl-1' },
      } as never)
      await expect(
        service.addProtocolUsage('consult-1', 'tenant-1', 'user-1', {
          protocolId: VALID_UUID,
        }),
      ).rejects.toThrow(BadRequestException)
    })

    it('throws BadRequestException when version content not found', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockConsultation())
      vi.mocked(prisma.protocol.findFirst).mockResolvedValue({
        currentVersionId: 'ver-1',
        type: { templateId: 'tmpl-1' },
      } as never)
      vi.mocked(prisma.protocolVersion.findFirst).mockResolvedValue(null)
      await expect(
        service.addProtocolUsage('consult-1', 'tenant-1', 'user-1', {
          protocolId: VALID_UUID,
        }),
      ).rejects.toThrow(BadRequestException)
    })

    it('throws NotFoundException when parent usage not found', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockConsultation())
      vi.mocked(prisma.protocol.findFirst).mockResolvedValue({
        currentVersionId: 'ver-1',
        type: { templateId: 'tmpl-1' },
      } as never)
      vi.mocked(repo.findProtocolUsageById).mockResolvedValue(null)
      await expect(
        service.addProtocolUsage('consult-1', 'tenant-1', 'user-1', {
          protocolId: VALID_UUID,
          parentUsageId: 'parent-usage-1',
        }),
      ).rejects.toThrow(NotFoundException)
    })

    it('throws NotFoundException when parent usage belongs to different consultation', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockConsultation())
      vi.mocked(prisma.protocol.findFirst).mockResolvedValue({
        currentVersionId: 'ver-1',
        type: { templateId: 'tmpl-1' },
      } as never)
      vi.mocked(repo.findProtocolUsageById).mockResolvedValue(
        mockProtocolUsage({ consultationId: 'other-consult' }),
      )
      await expect(
        service.addProtocolUsage('consult-1', 'tenant-1', 'user-1', {
          protocolId: VALID_UUID,
          parentUsageId: 'parent-usage-1',
        }),
      ).rejects.toThrow(NotFoundException)
    })

    it('launches protocol usage when everything is valid', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockConsultation())
      vi.mocked(prisma.protocol.findFirst).mockResolvedValue({
        currentVersionId: 'ver-1',
        type: { templateId: 'tmpl-1' },
      } as never)
      vi.mocked(prisma.protocolVersion.findFirst).mockResolvedValue({
        id: 'ver-1',
        content: { version: '1.0', blocks: [] },
      } as never)
      vi.mocked(repo.getUsageDepth).mockResolvedValue(0)
      vi.mocked(repo.launchProtocolUsage).mockResolvedValue(mockProtocolUsage())
      const result = await service.addProtocolUsage('consult-1', 'tenant-1', 'user-1', {
        protocolId: VALID_UUID,
      })
      expect(result.protocolId).toBe('protocol-1')
    })

    it('computes depth from parent usage when parentUsageId is provided', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockConsultation())
      vi.mocked(prisma.protocol.findFirst).mockResolvedValue({
        currentVersionId: 'ver-1',
        type: { templateId: 'tmpl-1' },
      } as never)
      vi.mocked(repo.findProtocolUsageById).mockResolvedValue(
        mockProtocolUsage({ consultationId: 'consult-1' }),
      )
      vi.mocked(prisma.protocolVersion.findFirst).mockResolvedValue({
        id: 'ver-1',
        content: { version: '1.0', blocks: [] },
      } as never)
      vi.mocked(repo.getUsageDepth).mockResolvedValue(1)
      vi.mocked(repo.launchProtocolUsage).mockResolvedValue(mockProtocolUsage({ depth: 2 }))
      const result = await service.addProtocolUsage('consult-1', 'tenant-1', 'user-1', {
        protocolId: VALID_UUID,
        parentUsageId: 'parent-usage-1',
      })
      expect(result.depth).toBe(2)
      expect(repo.getUsageDepth).toHaveBeenCalledWith('parent-usage-1', 'tenant-1')
    })
  })

  // ── updateProtocolUsage ───────────────────────────────────────────────────

  describe('updateProtocolUsage', () => {
    it('updates usage when found', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockConsultation())
      vi.mocked(repo.findProtocolUsageById).mockResolvedValue(mockProtocolUsage())
      vi.mocked(repo.updateProtocolUsage).mockResolvedValue(
        mockProtocolUsage({ modificationSummary: 'Updated' }),
      )
      const result = await service.updateProtocolUsage('consult-1', 'usage-1', 'tenant-1', {
        content: {},
        modifications: {},
        modificationSummary: 'Updated',
      })
      expect(result.modificationSummary).toBe('Updated')
    })

    it('throws NotFoundException when usage not found', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockConsultation())
      vi.mocked(repo.findProtocolUsageById).mockResolvedValue(null)
      await expect(
        service.updateProtocolUsage('consult-1', 'usage-1', 'tenant-1', { content: {}, modifications: {} }),
      ).rejects.toThrow(NotFoundException)
    })

    it('throws NotFoundException when usage belongs to different consultation', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockConsultation())
      vi.mocked(repo.findProtocolUsageById).mockResolvedValue(
        mockProtocolUsage({ consultationId: 'other-consult' }),
      )
      await expect(
        service.updateProtocolUsage('consult-1', 'usage-1', 'tenant-1', { content: {}, modifications: {} }),
      ).rejects.toThrow(NotFoundException)
    })
  })

  // ── getProtocolUsage ──────────────────────────────────────────────────────

  describe('getProtocolUsage', () => {
    it('returns usage when found', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockConsultation())
      vi.mocked(repo.findProtocolUsageById).mockResolvedValue(mockProtocolUsage())
      const result = await service.getProtocolUsage('consult-1', 'usage-1', 'tenant-1')
      expect(result.id).toBe('usage-1')
    })

    it('throws NotFoundException when usage not found', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockConsultation())
      vi.mocked(repo.findProtocolUsageById).mockResolvedValue(null)
      await expect(
        service.getProtocolUsage('consult-1', 'usage-1', 'tenant-1'),
      ).rejects.toThrow(NotFoundException)
    })

    it('throws NotFoundException when usage belongs to different consultation', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockConsultation())
      vi.mocked(repo.findProtocolUsageById).mockResolvedValue(
        mockProtocolUsage({ consultationId: 'other-consult' }),
      )
      await expect(
        service.getProtocolUsage('consult-1', 'usage-1', 'tenant-1'),
      ).rejects.toThrow(NotFoundException)
    })
  })

  // ── removeProtocolUsage ───────────────────────────────────────────────────

  describe('removeProtocolUsage', () => {
    it('removes usage when found', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockConsultation())
      vi.mocked(repo.findProtocolUsageById).mockResolvedValue(mockProtocolUsage())
      vi.mocked(repo.removeProtocolUsage).mockResolvedValue(undefined)
      await expect(
        service.removeProtocolUsage('consult-1', 'usage-1', 'tenant-1'),
      ).resolves.toBeUndefined()
      expect(repo.removeProtocolUsage).toHaveBeenCalledWith('usage-1', 'tenant-1')
    })

    it('throws NotFoundException when usage not found', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockConsultation())
      vi.mocked(repo.findProtocolUsageById).mockResolvedValue(null)
      await expect(
        service.removeProtocolUsage('consult-1', 'usage-1', 'tenant-1'),
      ).rejects.toThrow(NotFoundException)
    })

    it('throws NotFoundException when usage belongs to different consultation', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockConsultation())
      vi.mocked(repo.findProtocolUsageById).mockResolvedValue(
        mockProtocolUsage({ consultationId: 'other-consult' }),
      )
      await expect(
        service.removeProtocolUsage('consult-1', 'usage-1', 'tenant-1'),
      ).rejects.toThrow(NotFoundException)
    })
  })

  // ── updateCheckedState ─────────────────────────────────────────────────────

  describe('updateCheckedState', () => {
    it('throws NotFoundException when usage not found', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockConsultation())
      vi.mocked(repo.findProtocolUsageById).mockResolvedValue(null)
      await expect(
        service.updateCheckedState('consult-1', 'usage-1', 'tenant-1', { checkedState: {} }),
      ).rejects.toThrow(NotFoundException)
    })

    it('coerces null completedAt correctly', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockConsultation())
      vi.mocked(repo.findProtocolUsageById).mockResolvedValue(mockProtocolUsage())
      vi.mocked(repo.updateCheckedState).mockResolvedValue(mockProtocolUsage())
      await service.updateCheckedState('consult-1', 'usage-1', 'tenant-1', {
        checkedState: {},
        completedAt: null,
      })
      const call = vi.mocked(repo.updateCheckedState).mock.calls[0]
      expect(call?.[3]).toBeNull()
    })

    it('coerces ISO string completedAt to Date', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockConsultation())
      vi.mocked(repo.findProtocolUsageById).mockResolvedValue(mockProtocolUsage())
      vi.mocked(repo.updateCheckedState).mockResolvedValue(mockProtocolUsage())
      await service.updateCheckedState('consult-1', 'usage-1', 'tenant-1', {
        checkedState: {},
        completedAt: '2026-05-01T10:00:00.000Z',
      })
      const call = vi.mocked(repo.updateCheckedState).mock.calls[0]
      expect(call?.[3]).toBeInstanceOf(Date)
    })
  })
})
