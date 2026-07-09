/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotFoundException, ConflictException, BadRequestException, Logger } from '@nestjs/common'
import { ConsultationsService } from '../consultations.service.js'
import type { ConsultationsRepository } from '../consultations.repository.js'
import type { PrismaService } from '../../../lib/prisma.service.js'
import type { ReferenceGuardService } from '../../../common/references/reference-guard.service.js'
import type { InvoicesService } from '../../invoices/invoices.service.js'
import type { ProtocolRecommendationsService } from '../../protocol-recommendations/protocol-recommendations.service.js'
import type { AuditLogService } from '../../../common/audit-log/audit-log.service.js'
import type { ConsultationRecordsService } from '../../consultation-records/index.js'
import { AppointmentNotStartableError } from '../consultations.repository.js'
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
    updatedAt: new Date().toISOString(),
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
  let auditLog: { record: ReturnType<typeof vi.fn> }
  let mockRecordsSvc: { ensureDraft: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    repo = {
      findMany: vi.fn(),
      findById: vi.fn(),
      findOpenByAppointment: vi.fn(),
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
      listPatientPrescriptions: vi.fn(),
    } as unknown as ConsultationsRepository

    prisma = {
      protocol: { findFirst: vi.fn() },
      protocolVersion: { findFirst: vi.fn() },
      appointment: { findFirst: vi.fn() },
      auditLog: { create: vi.fn() },
      $transaction: vi.fn(),
    } as unknown as PrismaService

    invoicesSvc = {
      createFromConsultation: vi.fn().mockResolvedValue({ status: 'skipped_no_fee' }),
    } as unknown as InvoicesService

    references = makeReferencesMock()
    recommendationsSvc = { invalidate: vi.fn() }
    auditLog = { record: vi.fn().mockResolvedValue(undefined) }
    mockRecordsSvc = { ensureDraft: vi.fn().mockResolvedValue({ id: 'rec1' }) }
    service = new ConsultationsService(
      repo,
      prisma,
      references,
      invoicesSvc,
      recommendationsSvc as unknown as ProtocolRecommendationsService,
      auditLog as unknown as AuditLogService,
      mockRecordsSvc as unknown as ConsultationRecordsService,
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

  describe('listPatientPrescriptions', () => {
    it('delegates to repository with patientId and tenantId', async () => {
      vi.mocked(repo.listPatientPrescriptions).mockResolvedValue([])
      const result = await service.listPatientPrescriptions('patient-1', 'tenant-1')
      expect(repo.listPatientPrescriptions).toHaveBeenCalledWith('patient-1', 'tenant-1')
      expect(result).toEqual([])
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

    it('verifies the appointment via the tenant-scoped status lookup when appointmentId is supplied', async () => {
      // assertAppointment is deliberately skipped here: the status lookup below
      // performs the same tenant-scoped existence check in a single query.
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue({ status: 'scheduled' } as never)
      vi.mocked(repo.findOpenByAppointment).mockResolvedValue(null)
      vi.mocked(repo.create).mockResolvedValue(mockConsultation())
      await service.create('tenant-1', 'user-1', {
        patientId: 'p-1',
        locationId: 'l-1',
        appointmentId: 'a-1',
      } as never)
      expect(prisma.appointment.findFirst).toHaveBeenCalledWith({
        where: { id: 'a-1', tenantId: 'tenant-1', deletedAt: null },
        select: { status: true },
      })
      expect(references.assertAppointment).not.toHaveBeenCalled()
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

  // ── create from appointment ──────────────────────────────────────────────────

  describe('create consultation from appointment', () => {
    const appointmentId = 'appt-1'

    it('delegates to repo.create for a scheduled appointment (repo moves it to in_progress)', async () => {
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue({ status: 'scheduled' } as never)
      vi.mocked(repo.findOpenByAppointment).mockResolvedValue(null)
      const created = mockConsultation({ appointmentId })
      vi.mocked(repo.create).mockResolvedValue(created)

      const result = await service.create('tenant-1', 'user-1', {
        patientId: 'p-1',
        locationId: 'l-1',
        appointmentId,
      })

      expect(result.appointmentId).toBe(appointmentId)
      expect(repo.create).toHaveBeenCalledTimes(1)
      expect(repo.create).toHaveBeenCalledWith('tenant-1', 'user-1', {
        patientId: 'p-1',
        locationId: 'l-1',
        appointmentId,
      })
    })

    it('starts on an already in_progress appointment (scheduled or in_progress allowed)', async () => {
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue({ status: 'in_progress' } as never)
      vi.mocked(repo.findOpenByAppointment).mockResolvedValue(null)
      const created = mockConsultation({ appointmentId })
      vi.mocked(repo.create).mockResolvedValue(created)

      const result = await service.create('tenant-1', 'user-1', {
        patientId: 'p-1',
        locationId: 'l-1',
        appointmentId,
      })

      expect(result.appointmentId).toBe(appointmentId)
      expect(repo.create).toHaveBeenCalledTimes(1)
    })

    it('is idempotent: returns the existing open consultation instead of creating a second', async () => {
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue({ status: 'in_progress' } as never)
      const existing = mockConsultation({ id: 'consult-existing', appointmentId })
      vi.mocked(repo.findOpenByAppointment).mockResolvedValue(existing)

      const result = await service.create('tenant-1', 'user-1', {
        patientId: 'p-1',
        locationId: 'l-1',
        appointmentId,
      })

      expect(result.id).toBe('consult-existing')
      expect(repo.create).not.toHaveBeenCalled()
    })

    it('rejects starting on a cancelled appointment with APPOINTMENT_NOT_STARTABLE', async () => {
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue({ status: 'cancelled' } as never)
      await expect(
        service.create('tenant-1', 'user-1', {
          patientId: 'p-1',
          locationId: 'l-1',
          appointmentId,
        }),
      ).rejects.toMatchObject({ response: { code: ErrorCode.APPOINTMENT_NOT_STARTABLE } })
      expect(repo.create).not.toHaveBeenCalled()
    })

    it('rejects starting on a completed appointment with APPOINTMENT_NOT_STARTABLE', async () => {
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue({ status: 'completed' } as never)
      await expect(
        service.create('tenant-1', 'user-1', {
          patientId: 'p-1',
          locationId: 'l-1',
          appointmentId,
        }),
      ).rejects.toMatchObject({ response: { code: ErrorCode.APPOINTMENT_NOT_STARTABLE } })
      expect(repo.create).not.toHaveBeenCalled()
    })

    it('rejects starting on a no_show appointment with APPOINTMENT_NOT_STARTABLE', async () => {
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue({ status: 'no_show' } as never)
      await expect(
        service.create('tenant-1', 'user-1', {
          patientId: 'p-1',
          locationId: 'l-1',
          appointmentId,
        }),
      ).rejects.toMatchObject({ response: { code: ErrorCode.APPOINTMENT_NOT_STARTABLE } })
      expect(repo.create).not.toHaveBeenCalled()
    })

    it('rejects an appointment from another tenant with APPOINTMENT_NOT_FOUND', async () => {
      // tenant-scoped lookup misses → treated as not found
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null)
      await expect(
        service.create('tenant-1', 'user-1', {
          patientId: 'p-1',
          locationId: 'l-1',
          appointmentId: 'other-tenant-appt',
        }),
      ).rejects.toMatchObject({ response: { code: ErrorCode.APPOINTMENT_NOT_FOUND } })
      expect(repo.create).not.toHaveBeenCalled()
    })

    it('walk-in (no appointmentId) is unchanged — no appointment lookup', async () => {
      const created = mockConsultation({ appointmentId: null })
      vi.mocked(repo.create).mockResolvedValue(created)

      const result = await service.create('tenant-1', 'user-1', {
        patientId: 'p-1',
        locationId: 'l-1',
      })

      expect(result.appointmentId).toBeNull()
      expect(prisma.appointment.findFirst).not.toHaveBeenCalled()
      expect(repo.findOpenByAppointment).not.toHaveBeenCalled()
      expect(repo.create).toHaveBeenCalledTimes(1)
    })

    it('audits the scheduled→in_progress transition when starting from a scheduled appointment', async () => {
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue({ status: 'scheduled' } as never)
      vi.mocked(repo.findOpenByAppointment).mockResolvedValue(null)
      vi.mocked(repo.create).mockResolvedValue(mockConsultation({ appointmentId }))

      await service.create('tenant-1', 'user-1', {
        patientId: 'p-1',
        locationId: 'l-1',
        appointmentId,
      })

      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'Appointment',
          entityId: appointmentId,
          category: 'entity',
          action: 'update',
          changes: { status: { before: 'scheduled', after: 'in_progress' } },
        }),
      )
    })

    it('does NOT audit for a walk-in (no appointment)', async () => {
      vi.mocked(repo.create).mockResolvedValue(mockConsultation({ appointmentId: null }))
      await service.create('tenant-1', 'user-1', { patientId: 'p-1', locationId: 'l-1' })
      expect(auditLog.record).not.toHaveBeenCalled()
    })

    it('does NOT audit when the appointment was already in_progress (idempotent restart)', async () => {
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue({ status: 'in_progress' } as never)
      vi.mocked(repo.findOpenByAppointment).mockResolvedValue(null)
      vi.mocked(repo.create).mockResolvedValue(mockConsultation({ appointmentId }))
      await service.create('tenant-1', 'user-1', {
        patientId: 'p-1',
        locationId: 'l-1',
        appointmentId,
      })
      expect(auditLog.record).not.toHaveBeenCalled()
    })

    it('maps AppointmentNotStartableError (TOCTOU race) to APPOINTMENT_NOT_STARTABLE', async () => {
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue({ status: 'scheduled' } as never)
      vi.mocked(repo.findOpenByAppointment).mockResolvedValue(null)
      vi.mocked(repo.create).mockRejectedValue(new AppointmentNotStartableError())
      await expect(
        service.create('tenant-1', 'user-1', {
          patientId: 'p-1',
          locationId: 'l-1',
          appointmentId,
        }),
      ).rejects.toMatchObject({ response: { code: ErrorCode.APPOINTMENT_NOT_STARTABLE } })
      expect(auditLog.record).not.toHaveBeenCalled()
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
      vi.mocked(repo.sign).mockResolvedValue({ consultation: signed, appointmentCompleted: false })
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
      vi.mocked(repo.sign).mockResolvedValue({ consultation: signed, appointmentCompleted: false })
      await service.sign('consult-1', 'tenant-1', 'user-1')
      expect(invoicesSvc.createFromConsultation).toHaveBeenCalledWith({
        consultationId: 'consult-1',
        patientId: draft.patientId,
        locationId: draft.locationId,
        userId: 'user-1',
        tenantId: 'tenant-1',
      })
    })

    it('passes the linked appointmentId to repo.sign so it completes the appointment', async () => {
      const draft = mockConsultation({
        status: 'open',
        appointmentId: 'appt-1',
        protocolUsages: [mockProtocolUsage()],
      })
      const signed = mockConsultation({ status: 'signed', protocolUsages: [mockProtocolUsage()] })
      vi.mocked(repo.findById).mockResolvedValue(draft)
      vi.mocked(repo.sign).mockResolvedValue({ consultation: signed, appointmentCompleted: false })
      await service.sign('consult-1', 'tenant-1', 'user-1')
      expect(repo.sign).toHaveBeenCalledWith('consult-1', 'tenant-1', 'user-1', 'appt-1')
    })

    it('passes null appointmentId for a walk-in consultation', async () => {
      const draft = mockConsultation({
        status: 'open',
        appointmentId: null,
        protocolUsages: [mockProtocolUsage()],
      })
      const signed = mockConsultation({ status: 'signed', protocolUsages: [mockProtocolUsage()] })
      vi.mocked(repo.findById).mockResolvedValue(draft)
      vi.mocked(repo.sign).mockResolvedValue({ consultation: signed, appointmentCompleted: false })
      const result = await service.sign('consult-1', 'tenant-1', 'user-1')
      expect(result.status).toBe('signed')
      expect(repo.sign).toHaveBeenCalledWith('consult-1', 'tenant-1', 'user-1', null)
    })

    it('audits the in_progress→completed transition when the appointment was completed', async () => {
      const draft = mockConsultation({
        status: 'open',
        appointmentId: 'appt-1',
        protocolUsages: [mockProtocolUsage()],
      })
      const signed = mockConsultation({ status: 'signed', protocolUsages: [mockProtocolUsage()] })
      vi.mocked(repo.findById).mockResolvedValue(draft)
      vi.mocked(repo.sign).mockResolvedValue({ consultation: signed, appointmentCompleted: true })
      await service.sign('consult-1', 'tenant-1', 'user-1')
      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'Appointment',
          entityId: 'appt-1',
          changes: { status: { before: 'in_progress', after: 'completed' } },
        }),
      )
    })

    it('does NOT audit the appointment when the status-filtered update no-op\'d', async () => {
      const draft = mockConsultation({
        status: 'open',
        appointmentId: 'appt-1',
        protocolUsages: [mockProtocolUsage()],
      })
      const signed = mockConsultation({ status: 'signed', protocolUsages: [mockProtocolUsage()] })
      vi.mocked(repo.findById).mockResolvedValue(draft)
      vi.mocked(repo.sign).mockResolvedValue({ consultation: signed, appointmentCompleted: false })
      await service.sign('consult-1', 'tenant-1', 'user-1')
      expect(auditLog.record).not.toHaveBeenCalled()
    })

    it('does NOT audit the appointment for a walk-in sign', async () => {
      const draft = mockConsultation({
        status: 'open',
        appointmentId: null,
        protocolUsages: [mockProtocolUsage()],
      })
      const signed = mockConsultation({ status: 'signed', protocolUsages: [mockProtocolUsage()] })
      vi.mocked(repo.findById).mockResolvedValue(draft)
      vi.mocked(repo.sign).mockResolvedValue({ consultation: signed, appointmentCompleted: false })
      await service.sign('consult-1', 'tenant-1', 'user-1')
      expect(auditLog.record).not.toHaveBeenCalled()
    })

    it('returns the invoice outcome when an invoice is created', async () => {
      const draft = mockConsultation({ status: 'open', protocolUsages: [mockProtocolUsage()] })
      const signed = mockConsultation({ status: 'signed', protocolUsages: [mockProtocolUsage()] })
      vi.mocked(repo.findById).mockResolvedValue(draft)
      vi.mocked(repo.sign).mockResolvedValue({ consultation: signed, appointmentCompleted: false })
      vi.mocked(invoicesSvc.createFromConsultation).mockResolvedValue({
        status: 'created',
        invoiceId: 'inv-1',
        total: 2000,
        currency: 'DOP',
      })
      const result = await service.sign('consult-1', 'tenant-1', 'user-1')
      expect(result.invoiceOutcome).toEqual({
        status: 'created',
        invoiceId: 'inv-1',
        total: 2000,
        currency: 'DOP',
      })
    })

    it('returns skipped_no_fee outcome when no fee is configured', async () => {
      const draft = mockConsultation({ status: 'open', protocolUsages: [mockProtocolUsage()] })
      const signed = mockConsultation({ status: 'signed', protocolUsages: [mockProtocolUsage()] })
      vi.mocked(repo.findById).mockResolvedValue(draft)
      vi.mocked(repo.sign).mockResolvedValue({ consultation: signed, appointmentCompleted: false })
      vi.mocked(invoicesSvc.createFromConsultation).mockResolvedValue({ status: 'skipped_no_fee' })
      const result = await service.sign('consult-1', 'tenant-1', 'user-1')
      expect(result.invoiceOutcome).toEqual({ status: 'skipped_no_fee' })
    })

    it('returns failed outcome (and still signs) when invoice creation reports failure', async () => {
      const draft = mockConsultation({ status: 'open', protocolUsages: [mockProtocolUsage()] })
      const signed = mockConsultation({ status: 'signed', protocolUsages: [mockProtocolUsage()] })
      vi.mocked(repo.findById).mockResolvedValue(draft)
      vi.mocked(repo.sign).mockResolvedValue({ consultation: signed, appointmentCompleted: false })
      vi.mocked(invoicesSvc.createFromConsultation).mockResolvedValue({ status: 'failed' })
      const result = await service.sign('consult-1', 'tenant-1', 'user-1')
      expect(result.status).toBe('signed')
      expect(result.invoiceOutcome).toEqual({ status: 'failed' })
    })

    it('sign reports recordOutcome=created when the draft is generated', async () => {
      const draft = mockConsultation({ status: 'open', protocolUsages: [mockProtocolUsage()] })
      const signed = mockConsultation({ status: 'signed', protocolUsages: [mockProtocolUsage()] })
      vi.mocked(repo.findById).mockResolvedValue(draft)
      vi.mocked(repo.sign).mockResolvedValue({ consultation: signed, appointmentCompleted: false })
      mockRecordsSvc.ensureDraft.mockResolvedValue({ id: 'rec1' })
      const result = await service.sign('consult-1', 'tenant-1', 'user-1')
      expect(result.recordOutcome).toEqual({ status: 'created', recordId: 'rec1' })
    })

    it('sign reports recordOutcome=failed without failing the sign', async () => {
      const draft = mockConsultation({ status: 'open', protocolUsages: [mockProtocolUsage()] })
      const signed = mockConsultation({ status: 'signed', protocolUsages: [mockProtocolUsage()] })
      vi.mocked(repo.findById).mockResolvedValue(draft)
      vi.mocked(repo.sign).mockResolvedValue({ consultation: signed, appointmentCompleted: false })
      mockRecordsSvc.ensureDraft.mockRejectedValue(new Error('boom'))
      const result = await service.sign('consult-1', 'tenant-1', 'user-1')
      expect(result.recordOutcome).toEqual({ status: 'failed' })
      expect(result.status).toBe('signed')
    })

    it('logs the swallowed ensureDraft error before reporting recordOutcome=failed', async () => {
      const errorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
      const draft = mockConsultation({ status: 'open', protocolUsages: [mockProtocolUsage()] })
      const signed = mockConsultation({ status: 'signed', protocolUsages: [mockProtocolUsage()] })
      vi.mocked(repo.findById).mockResolvedValue(draft)
      vi.mocked(repo.sign).mockResolvedValue({ consultation: signed, appointmentCompleted: false })
      mockRecordsSvc.ensureDraft.mockRejectedValue(new Error('boom'))
      await service.sign('consult-1', 'tenant-1', 'user-1')
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('consult-1'),
        expect.any(String),
      )
      errorSpy.mockRestore()
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
      vi.mocked(repo.softDelete).mockResolvedValue({ appointmentReverted: false })
      await service.remove('consult-1', 'tenant-1')
      expect(repo.softDelete).toHaveBeenCalledOnce()
    })

    it('passes the linked appointmentId so the appointment can be reverted', async () => {
      vi.mocked(repo.findById).mockResolvedValue(
        mockConsultation({ status: 'open', appointmentId: 'appt-1' }),
      )
      vi.mocked(repo.softDelete).mockResolvedValue({ appointmentReverted: false })
      await service.remove('consult-1', 'tenant-1')
      expect(repo.softDelete).toHaveBeenCalledWith('consult-1', 'tenant-1', 'appt-1')
    })

    it('audits the in_progress→scheduled revert when the appointment was reverted', async () => {
      vi.mocked(repo.findById).mockResolvedValue(
        mockConsultation({ status: 'open', appointmentId: 'appt-1' }),
      )
      vi.mocked(repo.softDelete).mockResolvedValue({ appointmentReverted: true })
      await service.remove('consult-1', 'tenant-1')
      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'Appointment',
          entityId: 'appt-1',
          changes: { status: { before: 'in_progress', after: 'scheduled' } },
        }),
      )
    })

    it('does NOT audit the appointment revert when the update no-op\'d', async () => {
      vi.mocked(repo.findById).mockResolvedValue(
        mockConsultation({ status: 'open', appointmentId: 'appt-1' }),
      )
      vi.mocked(repo.softDelete).mockResolvedValue({ appointmentReverted: false })
      await service.remove('consult-1', 'tenant-1')
      expect(auditLog.record).not.toHaveBeenCalled()
    })

    it('does NOT audit for a walk-in delete (null appointmentId)', async () => {
      vi.mocked(repo.findById).mockResolvedValue(
        mockConsultation({ status: 'open', appointmentId: null }),
      )
      vi.mocked(repo.softDelete).mockResolvedValue({ appointmentReverted: false })
      await service.remove('consult-1', 'tenant-1')
      expect(auditLog.record).not.toHaveBeenCalled()
    })

    it('passes null appointmentId for a walk-in consultation', async () => {
      vi.mocked(repo.findById).mockResolvedValue(
        mockConsultation({ status: 'open', appointmentId: null }),
      )
      vi.mocked(repo.softDelete).mockResolvedValue({ appointmentReverted: false })
      await service.remove('consult-1', 'tenant-1')
      expect(repo.softDelete).toHaveBeenCalledWith('consult-1', 'tenant-1', null)
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

    it('rejects with CONSULTATION_ALREADY_SIGNED when the consultation is signed', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockConsultation({ status: 'signed' }))
      await expect(
        service.updateProtocolUsage('consult-1', 'usage-1', 'tenant-1', {
          content: {},
          modifications: {},
        }),
      ).rejects.toMatchObject({
        response: { code: ErrorCode.CONSULTATION_ALREADY_SIGNED },
      })
      expect(repo.findProtocolUsageById).not.toHaveBeenCalled()
      expect(repo.updateProtocolUsage).not.toHaveBeenCalled()
    })

    it('still updates the usage when the consultation is open', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockConsultation({ status: 'open' }))
      vi.mocked(repo.findProtocolUsageById).mockResolvedValue(mockProtocolUsage())
      vi.mocked(repo.updateProtocolUsage).mockResolvedValue(
        mockProtocolUsage({ modificationSummary: 'Updated' }),
      )
      const result = await service.updateProtocolUsage('consult-1', 'usage-1', 'tenant-1', {
        content: {},
        modifications: {},
      })
      expect(result.modificationSummary).toBe('Updated')
    })

    it('rejects with PROTOCOL_USAGE_STALE when content is sent with a stale expectedUpdatedAt', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockConsultation())
      vi.mocked(repo.findProtocolUsageById).mockResolvedValue(
        mockProtocolUsage({ updatedAt: '2026-01-01T10:00:00.000Z' }),
      )
      await expect(
        service.updateProtocolUsage('consult-1', 'usage-1', 'tenant-1', {
          content: {},
          expectedUpdatedAt: '2025-12-31T00:00:00.000Z',
        }),
      ).rejects.toMatchObject({
        response: {
          code: ErrorCode.PROTOCOL_USAGE_STALE,
          details: { currentUpdatedAt: '2026-01-01T10:00:00.000Z' },
        },
      })
      expect(repo.updateProtocolUsage).not.toHaveBeenCalled()
    })

    it('updates the usage without forwarding expectedUpdatedAt when it matches the current updatedAt', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockConsultation())
      vi.mocked(repo.findProtocolUsageById).mockResolvedValue(
        mockProtocolUsage({ updatedAt: '2026-01-01T10:00:00.000Z' }),
      )
      vi.mocked(repo.updateProtocolUsage).mockResolvedValue(mockProtocolUsage())
      await service.updateProtocolUsage('consult-1', 'usage-1', 'tenant-1', {
        content: { version: '1.0', blocks: [] },
        expectedUpdatedAt: '2026-01-01T10:00:00.000Z',
      })
      expect(repo.updateProtocolUsage).toHaveBeenCalledWith('usage-1', 'tenant-1', {
        content: { version: '1.0', blocks: [] },
      })
    })

    it('passes through modifications-only updates with no expectedUpdatedAt check', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockConsultation())
      vi.mocked(repo.findProtocolUsageById).mockResolvedValue(
        mockProtocolUsage({ updatedAt: '2026-01-01T10:00:00.000Z' }),
      )
      vi.mocked(repo.updateProtocolUsage).mockResolvedValue(mockProtocolUsage())
      await expect(
        service.updateProtocolUsage('consult-1', 'usage-1', 'tenant-1', {
          modifications: { steps_completed: [{ step_id: 'stp1', timestamp: 't1' }] },
        }),
      ).resolves.toBeDefined()
      expect(repo.updateProtocolUsage).toHaveBeenCalledWith('usage-1', 'tenant-1', {
        modifications: { steps_completed: [{ step_id: 'stp1', timestamp: 't1' }] },
      })
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
