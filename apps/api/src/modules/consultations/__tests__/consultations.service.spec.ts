/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common'
import { ConsultationsService } from '../consultations.service.js'
import type { ConsultationsRepository } from '../consultations.repository.js'
import type { PrismaService } from '../../../lib/prisma.service.js'
import type { ReferenceGuardService } from '../../../common/references/reference-guard.service.js'
import type { InvoicesService } from '../../invoices/invoices.service.js'
import type { ProtocolRecommendationsService } from '../../protocol-recommendations/protocol-recommendations.service.js'
import { ErrorCode } from '@rezeta/shared'
import type { ConsultationWithDetails, ConsultationProtocolUsage } from '@rezeta/shared'

const VALID_UUID = '00000000-0000-0000-0000-000000000001'

function makeReferencesMock(): ReferenceGuardService {
  return {
    assertPatient: vi.fn().mockResolvedValue(undefined),
    assertLocation: vi.fn().mockResolvedValue(undefined),
    assertAppointment: vi.fn().mockResolvedValue(undefined),
    assertConsultation: vi.fn().mockResolvedValue(undefined),
  } as unknown as ReferenceGuardService
}

function mockConsultation(
  overrides: Partial<ConsultationWithDetails> = {},
): ConsultationWithDetails {
  return {
    id: 'consult-1',
    tenantId: 'tenant-1',
    patientId: 'patient-1',
    locationId: 'location-1',
    doctorUserId: 'user-1',
    appointmentId: null,
    status: 'open',
    startedAt: new Date().toISOString(),
    signedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
    patientName: 'María García',
    locationName: 'Clínica Centro',
    doctorName: 'Dr. García',
    amendments: [],
    protocolUsages: [],
    ...overrides,
  }
}

function mockProtocolUsage(
  overrides: Partial<ConsultationProtocolUsage> = {},
): ConsultationProtocolUsage {
  return {
    id: 'usage-1',
    consultationId: 'consult-1',
    tenantId: 'tenant-1',
    protocolId: 'protocol-1',
    protocolVersionId: 'version-1',
    content: { version: '1.0', blocks: [] },
    parentUsageId: null,
    triggerBlockId: null,
    depth: 0,
    status: 'in_progress',
    completedAt: null,
    notes: null,
    modifications: {},
    modificationSummary: null,
    appliedAt: new Date().toISOString(),
    protocolTitle: 'Test Protocol',
    protocolTypeName: null,
    versionNumber: 1,
    childUsages: [],
    ...overrides,
  }
}

describe('ConsultationsService', () => {
  let repo: ConsultationsRepository
  let prisma: PrismaService
  let references: ReferenceGuardService
  let invoicesSvc: InvoicesService
  let service: ConsultationsService
  let recommendationsSvc: { invalidate: ReturnType<typeof vi.fn> }

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
      $transaction: vi.fn(),
    } as unknown as PrismaService

    invoicesSvc = {
      createFromConsultation: vi.fn().mockResolvedValue(undefined),
    } as unknown as InvoicesService

    references = makeReferencesMock()
    recommendationsSvc = { invalidate: vi.fn() }
    service = new ConsultationsService(
      repo,
      prisma,
      references,
      invoicesSvc,
      recommendationsSvc as unknown as ProtocolRecommendationsService,
    )
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
    it('delegates to repository when no protocolId', async () => {
      const c = mockConsultation()
      vi.mocked(repo.create).mockResolvedValue(c)
      const result = await service.create('tenant-1', 'user-1', {
        patientId: 'p-1',
        locationId: 'l-1',
      })
      expect(result).toEqual(c)
      expect(repo.create).toHaveBeenCalledTimes(1)
    })

    it('verifies patient and location belong to the tenant before creating', async () => {
      vi.mocked(repo.create).mockResolvedValue(mockConsultation())
      await service.create('tenant-1', 'user-1', { patientId: 'p-1', locationId: 'l-1' })
      expect(references.assertPatient).toHaveBeenCalledWith('p-1', 'tenant-1')
      expect(references.assertLocation).toHaveBeenCalledWith('l-1', 'tenant-1')
      expect(references.assertAppointment).not.toHaveBeenCalled()
    })

    it('verifies the appointment when appointmentId is supplied', async () => {
      vi.mocked(repo.create).mockResolvedValue(mockConsultation())
      await service.create('tenant-1', 'user-1', {
        patientId: 'p-1',
        locationId: 'l-1',
        appointmentId: 'a-1',
      } as never)
      expect(references.assertAppointment).toHaveBeenCalledWith('a-1', 'tenant-1')
    })

    it('rejects a cross-tenant patient and never creates the row', async () => {
      vi.mocked(references.assertPatient).mockRejectedValue(
        new NotFoundException({ code: ErrorCode.PATIENT_NOT_FOUND, message: 'Patient not found' }),
      )
      await expect(
        service.create('tenant-1', 'user-1', { patientId: 'other-tenant-patient', locationId: 'l-1' }),
      ).rejects.toThrow(NotFoundException)
      expect(repo.create).not.toHaveBeenCalled()
    })

    describe('with protocolId (schema reset v2 — create delegates to repo, protocol launched separately)', () => {
      it('delegates to repo.create even when protocolId provided (protocol launch via addProtocolUsage)', async () => {
        const c = mockConsultation()
        vi.mocked(repo.create).mockResolvedValue(c)

        const result = await service.create('tenant-1', 'user-1', {
          patientId: 'p-1',
          locationId: 'l-1',
          protocolId: '00000000-0000-0000-0000-000000000001',
        } as never)

        expect(repo.create).toHaveBeenCalledTimes(1)
        expect(result).toEqual(c)
        expect(recommendationsSvc.invalidate).toHaveBeenCalledWith('tenant-1', 'user-1', 'p-1')
      })

      it('invalidates recommendations cache after create', async () => {
        const c = mockConsultation()
        vi.mocked(repo.create).mockResolvedValue(c)
        await service.create('tenant-1', 'user-1', { patientId: 'p-1', locationId: 'l-1' })
        expect(recommendationsSvc.invalidate).toHaveBeenCalledWith('tenant-1', 'user-1', 'p-1')
      })
    })
  })

  // ── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates an open consultation', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockConsultation())
      vi.mocked(repo.update).mockResolvedValue(mockConsultation())
      const result = await service.update('consult-1', 'tenant-1', {})
      expect(result.id).toBe('consult-1')
    })

    it('throws ConflictException when consultation is already signed', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockConsultation({ status: 'signed' }))
      await expect(service.update('consult-1', 'tenant-1', {})).rejects.toThrow(
        ConflictException,
      )
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
    it('rejects signing when the consultation has zero protocol usages', async () => {
      // Arrange: getById returns an OPEN consultation with protocolUsages: []
      vi.mocked(repo.findById).mockResolvedValue(mockConsultation({ status: 'open', protocolUsages: [] }))
      await expect(service.sign('consult-1', 'tenant-1', 'user-1')).rejects.toMatchObject({
        response: { code: ErrorCode.CONSULTATION_REQUIRES_PROTOCOL },
      })
    })

    it('signs an open consultation', async () => {
      const draft = mockConsultation({ status: 'open', protocolUsages: [mockProtocolUsage()] })
      const signed = mockConsultation({ status: 'signed', protocolUsages: [mockProtocolUsage()] })
      vi.mocked(repo.findById).mockResolvedValue(draft)
      vi.mocked(repo.sign).mockResolvedValue(signed)
      const result = await service.sign('consult-1', 'tenant-1', 'user-1')
      expect(result.status).toBe('signed')
      const signCall = vi.mocked(repo.sign).mock.calls[0]
      expect(signCall?.[0]).toBe('consult-1')
      expect(signCall?.[1]).toBe('tenant-1')
      expect(signCall?.[2]).toBe('user-1')
    })

    it('throws when required protocol blocks are missing', async () => {
      // A required checklist block with unchecked items triggers the error
      const usage = mockProtocolUsage({
        content: {
          version: '1.0',
          blocks: [
            {
              id: 'chk1',
              type: 'checklist' as const,
              items: [{ id: 'i1', text: 'PA' }],
              required: true,
            } as never,
          ],
        },
        modifications: {},
      })
      const draft = mockConsultation({ status: 'open', protocolUsages: [usage] })
      vi.mocked(repo.findById).mockResolvedValue(draft)
      await expect(service.sign('consult-1', 'tenant-1', 'user-1')).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'CONSULTATION_MISSING_REQUIRED_FIELDS',
        }),
      })
      expect(repo.sign).not.toHaveBeenCalled()
    })

    it('error response includes missing fields list', async () => {
      const usage = mockProtocolUsage({
        content: {
          version: '1.0',
          blocks: [
            {
              id: 'chk1',
              type: 'checklist' as const,
              title: 'Vitales',
              items: [{ id: 'i1', text: 'PA' }],
              required: true,
            } as never,
          ],
        },
        modifications: {},
      })
      const draft = mockConsultation({ status: 'open', protocolUsages: [usage] })
      vi.mocked(repo.findById).mockResolvedValue(draft)
      try {
        await service.sign('consult-1', 'tenant-1', 'user-1')
        throw new Error('expected to throw')
      } catch (e) {
        const resp = (e as { response: { details: { missing: { id: string }[] } } }).response
        const ids = resp.details.missing.map((m) => m.id)
        expect(ids).toContain('protocol:usage-1:chk1')
      }
    })

    it('throws ConflictException when already signed', async () => {
      vi.mocked(repo.findById).mockResolvedValue(
        mockConsultation({ status: 'signed', protocolUsages: [mockProtocolUsage()] }),
      )
      await expect(service.sign('consult-1', 'tenant-1', 'user-1')).rejects.toThrow(
        ConflictException,
      )
    })

    it('throws ConflictException if consultation is amended', async () => {
      vi.mocked(repo.findById).mockResolvedValue(
        mockConsultation({ id: 'c-1', status: 'amended', protocolUsages: [mockProtocolUsage()] }),
      )
      await expect(service.sign('c-1', 'tenant-1', 'doc-1')).rejects.toThrow('already')
    })

    it('does not call repo.sign when already signed', async () => {
      vi.mocked(repo.findById).mockResolvedValue(
        mockConsultation({ status: 'signed', protocolUsages: [mockProtocolUsage()] }),
      )
      await service.sign('consult-1', 'tenant-1', 'user-1').catch(() => {})
      expect(repo.sign).not.toHaveBeenCalled()
    })

    it('triggers auto-invoice creation after signing', async () => {
      const draft = mockConsultation({ status: 'open', protocolUsages: [mockProtocolUsage()] })
      const signed = mockConsultation({ status: 'signed', protocolUsages: [mockProtocolUsage()] })
      vi.mocked(repo.findById).mockResolvedValue(draft)
      vi.mocked(repo.sign).mockResolvedValue(signed)
      await service.sign('consult-1', 'tenant-1', 'user-1')
      // Allow fire-and-forget to settle
      await Promise.resolve()
      expect(invoicesSvc.createFromConsultation).toHaveBeenCalledWith({
        consultationId: 'consult-1',
        patientId: draft.patientId,
        locationId: draft.locationId,
        userId: 'user-1',
        tenantId: 'tenant-1',
      })
    })

    it('sign succeeds even when auto-invoice creation fails', async () => {
      const draft = mockConsultation({ status: 'open', protocolUsages: [mockProtocolUsage()] })
      const signed = mockConsultation({ status: 'signed', protocolUsages: [mockProtocolUsage()] })
      vi.mocked(repo.findById).mockResolvedValue(draft)
      vi.mocked(repo.sign).mockResolvedValue(signed)
      vi.mocked(invoicesSvc.createFromConsultation).mockRejectedValue(new Error('DB error'))
      const result = await service.sign('consult-1', 'tenant-1', 'user-1')
      expect(result.status).toBe('signed')
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
      vi.mocked(repo.findById).mockResolvedValue(mockConsultation({ status: 'open' }))
      await expect(
        service.amend('consult-1', 'tenant-1', 'user-1', { reason: 'Corrección necesaria.' }),
      ).rejects.toThrow(BadRequestException)
    })
  })

  // ── remove ─────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('soft-deletes an open consultation', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockConsultation({ status: 'open' }))
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
        service.updateProtocolUsage('consult-1', 'usage-1', 'tenant-1', {
          content: {},
          modifications: {},
        }),
      ).rejects.toThrow(NotFoundException)
    })

    it('throws NotFoundException when usage belongs to different consultation', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockConsultation())
      vi.mocked(repo.findProtocolUsageById).mockResolvedValue(
        mockProtocolUsage({ consultationId: 'other-consult' }),
      )
      await expect(
        service.updateProtocolUsage('consult-1', 'usage-1', 'tenant-1', {
          content: {},
          modifications: {},
        }),
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
      await expect(service.getProtocolUsage('consult-1', 'usage-1', 'tenant-1')).rejects.toThrow(
        NotFoundException,
      )
    })

    it('throws NotFoundException when usage belongs to different consultation', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockConsultation())
      vi.mocked(repo.findProtocolUsageById).mockResolvedValue(
        mockProtocolUsage({ consultationId: 'other-consult' }),
      )
      await expect(service.getProtocolUsage('consult-1', 'usage-1', 'tenant-1')).rejects.toThrow(
        NotFoundException,
      )
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
      await expect(service.removeProtocolUsage('consult-1', 'usage-1', 'tenant-1')).rejects.toThrow(
        NotFoundException,
      )
    })

    it('throws NotFoundException when usage belongs to different consultation', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockConsultation())
      vi.mocked(repo.findProtocolUsageById).mockResolvedValue(
        mockProtocolUsage({ consultationId: 'other-consult' }),
      )
      await expect(service.removeProtocolUsage('consult-1', 'usage-1', 'tenant-1')).rejects.toThrow(
        NotFoundException,
      )
    })
  })

  // ── updateCheckedState ─────────────────────────────────────────────────────

  describe('updateCheckedState', () => {
    it('throws NotFoundException when usage not found', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockConsultation())
      vi.mocked(repo.findProtocolUsageById).mockResolvedValue(null)
      await expect(
        service.updateCheckedState('consult-1', 'usage-1', 'tenant-1', {}),
      ).rejects.toThrow(NotFoundException)
    })

    it('coerces null completedAt correctly', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockConsultation())
      vi.mocked(repo.findProtocolUsageById).mockResolvedValue(mockProtocolUsage())
      vi.mocked(repo.updateCheckedState).mockResolvedValue(mockProtocolUsage())
      await service.updateCheckedState('consult-1', 'usage-1', 'tenant-1', {
        completedAt: null,
      })
      const call = vi.mocked(repo.updateCheckedState).mock.calls[0]
      // call: [usageId, tenantId, completedAt, notes]
      expect(call?.[2]).toBeNull()
    })

    it('coerces ISO string completedAt to Date', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockConsultation())
      vi.mocked(repo.findProtocolUsageById).mockResolvedValue(mockProtocolUsage())
      vi.mocked(repo.updateCheckedState).mockResolvedValue(mockProtocolUsage())
      await service.updateCheckedState('consult-1', 'usage-1', 'tenant-1', {
        completedAt: '2026-05-01T10:00:00.000Z',
      })
      const call = vi.mocked(repo.updateCheckedState).mock.calls[0]
      // call: [usageId, tenantId, completedAt, notes]
      expect(call?.[2]).toBeInstanceOf(Date)
    })
  })
})
