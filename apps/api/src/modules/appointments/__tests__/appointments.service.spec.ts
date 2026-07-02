/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common'
import { AppointmentsService } from '../appointments.service.js'
import type { AppointmentsRepository } from '../appointments.repository.js'
import type { ReferenceGuardService } from '../../../common/references/reference-guard.service.js'
import { ErrorCode } from '@rezeta/shared'
import type { AppointmentWithDetails } from '@rezeta/shared'

function makeReferencesMock(): ReferenceGuardService {
  return {
    assertPatient: vi.fn().mockResolvedValue(undefined),
    assertLocation: vi.fn().mockResolvedValue(undefined),
    assertAppointment: vi.fn().mockResolvedValue(undefined),
    assertConsultation: vi.fn().mockResolvedValue(undefined),
  } as unknown as ReferenceGuardService
}

const STARTS = '2026-05-01T09:00:00.000Z'
const ENDS = '2026-05-01T10:00:00.000Z'
const ENDS_BEFORE = '2026-05-01T08:00:00.000Z' // before starts

function mockAppt(overrides: Partial<AppointmentWithDetails> = {}): AppointmentWithDetails {
  return {
    id: 'appt-1',
    tenantId: 'tenant-1',
    doctorUserId: 'user-1',
    patientId: 'patient-1',
    locationId: 'location-1',
    startsAt: STARTS,
    endsAt: ENDS,
    status: 'scheduled',
    reason: null,
    notes: null,
    patientName: 'María García',
    patientDocumentNumber: null,
    locationName: 'Clínica Centro',
    consultationId: null,
    consultationStatus: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
    ...overrides,
  }
}

describe('AppointmentsService', () => {
  let repo: AppointmentsRepository
  let references: ReferenceGuardService
  let service: AppointmentsService

  beforeEach(() => {
    repo = {
      findMany: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateStatus: vi.fn(),
      softDelete: vi.fn(),
      hasConflict: vi.fn(),
      findLiveConsultation: vi.fn(),
    } as unknown as AppointmentsRepository
    references = makeReferencesMock()
    service = new AppointmentsService(repo, references)
  })

  // ── list ─────────────────────────────────────────────────────────────────────

  describe('list', () => {
    it('delegates to repository and returns results', async () => {
      const appointments = [mockAppt()]
      vi.mocked(repo.findMany).mockResolvedValue(appointments)
      const result = await service.list({ tenantId: 'tenant-1', userId: 'user-1' })
      expect(result).toEqual(appointments)
    })
  })

  // ── getById ──────────────────────────────────────────────────────────────────

  describe('getById', () => {
    it('returns appointment when found', async () => {
      const appt = mockAppt()
      vi.mocked(repo.findById).mockResolvedValue(appt)
      expect(await service.getById('appt-1', 'tenant-1')).toEqual(appt)
    })

    it('throws NotFoundException when not found', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null)
      await expect(service.getById('bad', 'tenant-1')).rejects.toThrow(NotFoundException)
    })

    it('error has APPOINTMENT_NOT_FOUND code', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null)
      try {
        await service.getById('bad', 'tenant-1')
      } catch (err) {
        const body = (err as NotFoundException).getResponse() as { code: string }
        expect(body.code).toBe(ErrorCode.APPOINTMENT_NOT_FOUND)
      }
    })
  })

  // ── create ───────────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto = { patientId: 'p-1', locationId: 'l-1', startsAt: STARTS, endsAt: ENDS }

    it('creates appointment when no conflict', async () => {
      vi.mocked(repo.hasConflict).mockResolvedValue(false)
      vi.mocked(repo.create).mockResolvedValue(mockAppt())
      const result = await service.create('tenant-1', 'user-1', dto)
      expect(repo.create).toHaveBeenCalledOnce()
      expect(result.status).toBe('scheduled')
    })

    it('throws BadRequestException when endsAt is before startsAt', async () => {
      await expect(
        service.create('tenant-1', 'user-1', { ...dto, endsAt: ENDS_BEFORE }),
      ).rejects.toThrow(BadRequestException)
    })

    it('throws ConflictException when time slot conflicts', async () => {
      vi.mocked(repo.hasConflict).mockResolvedValue(true)
      await expect(service.create('tenant-1', 'user-1', dto)).rejects.toThrow(ConflictException)
    })

    it('thrown conflict has APPOINTMENT_CONFLICT code', async () => {
      vi.mocked(repo.hasConflict).mockResolvedValue(true)
      try {
        await service.create('tenant-1', 'user-1', dto)
      } catch (err) {
        const body = (err as ConflictException).getResponse() as { code: string }
        expect(body.code).toBe(ErrorCode.APPOINTMENT_CONFLICT)
      }
    })

    it('does not call repo.create on conflict', async () => {
      vi.mocked(repo.hasConflict).mockResolvedValue(true)
      await service.create('tenant-1', 'user-1', dto).catch(() => {})
      expect(repo.create).not.toHaveBeenCalled()
    })

    it('verifies patient and location belong to the tenant', async () => {
      vi.mocked(repo.hasConflict).mockResolvedValue(false)
      vi.mocked(repo.create).mockResolvedValue(mockAppt())
      await service.create('tenant-1', 'user-1', dto)
      expect(references.assertPatient).toHaveBeenCalledWith('p-1', 'tenant-1')
      expect(references.assertLocation).toHaveBeenCalledWith('l-1', 'tenant-1')
    })

    it('rejects a cross-tenant patient before checking conflicts or creating', async () => {
      vi.mocked(references.assertPatient).mockRejectedValue(
        new NotFoundException({ code: ErrorCode.PATIENT_NOT_FOUND, message: 'Patient not found' }),
      )
      await expect(service.create('tenant-1', 'user-1', dto)).rejects.toThrow(NotFoundException)
      expect(repo.hasConflict).not.toHaveBeenCalled()
      expect(repo.create).not.toHaveBeenCalled()
    })
  })

  // ── update ───────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates appointment when no time change in dto', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockAppt())
      vi.mocked(repo.update).mockResolvedValue(mockAppt({ reason: 'Follow-up' }))
      const result = await service.update('appt-1', 'tenant-1', 'user-1', { reason: 'Follow-up' })
      expect(result.reason).toBe('Follow-up')
      expect(repo.hasConflict).not.toHaveBeenCalled()
    })

    it('throws NotFoundException when appointment not found', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null)
      await expect(
        service.update('bad', 'tenant-1', 'user-1', { startsAt: STARTS }),
      ).rejects.toThrow(NotFoundException)
    })

    it('verifies a reassigned patient/location belong to the tenant', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockAppt())
      vi.mocked(repo.update).mockResolvedValue(mockAppt())
      await service.update('appt-1', 'tenant-1', 'user-1', {
        patientId: 'p-2',
        locationId: 'l-2',
      })
      expect(references.assertPatient).toHaveBeenCalledWith('p-2', 'tenant-1')
      expect(references.assertLocation).toHaveBeenCalledWith('l-2', 'tenant-1')
    })

    it('rejects a cross-tenant patient on update before writing', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockAppt())
      vi.mocked(references.assertPatient).mockRejectedValue(
        new NotFoundException({ code: ErrorCode.PATIENT_NOT_FOUND, message: 'Patient not found' }),
      )
      await expect(
        service.update('appt-1', 'tenant-1', 'user-1', { patientId: 'other-tenant' }),
      ).rejects.toThrow(NotFoundException)
      expect(repo.update).not.toHaveBeenCalled()
    })

    it('throws BadRequestException when endsAt is before startsAt in update', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockAppt())
      await expect(
        service.update('appt-1', 'tenant-1', 'user-1', {
          startsAt: STARTS,
          endsAt: ENDS_BEFORE,
        }),
      ).rejects.toThrow(BadRequestException)
    })

    it('throws ConflictException when updated time conflicts', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockAppt())
      vi.mocked(repo.hasConflict).mockResolvedValue(true)
      await expect(
        service.update('appt-1', 'tenant-1', 'user-1', { startsAt: STARTS, endsAt: ENDS }),
      ).rejects.toThrow(ConflictException)
    })

    it('updates when time change is valid and no conflict', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockAppt())
      vi.mocked(repo.hasConflict).mockResolvedValue(false)
      vi.mocked(repo.update).mockResolvedValue(mockAppt())
      const result = await service.update('appt-1', 'tenant-1', 'user-1', {
        startsAt: STARTS,
        endsAt: ENDS,
      })
      expect(repo.update).toHaveBeenCalledOnce()
      expect(result).toBeDefined()
    })

    it('uses existing endsAt when only startsAt provided in update', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockAppt())
      vi.mocked(repo.hasConflict).mockResolvedValue(false)
      vi.mocked(repo.update).mockResolvedValue(mockAppt())
      const result = await service.update('appt-1', 'tenant-1', 'user-1', {
        startsAt: STARTS,
      })
      expect(repo.update).toHaveBeenCalledOnce()
      expect(result).toBeDefined()
    })

    it('uses existing startsAt when only endsAt provided in update', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockAppt())
      vi.mocked(repo.hasConflict).mockResolvedValue(false)
      vi.mocked(repo.update).mockResolvedValue(mockAppt())
      const result = await service.update('appt-1', 'tenant-1', 'user-1', {
        endsAt: ENDS,
      })
      expect(repo.update).toHaveBeenCalledOnce()
      expect(result).toBeDefined()
    })
  })

  // ── updateStatus ─────────────────────────────────────────────────────────────

  describe('updateStatus', () => {
    it('updates status from scheduled to completed', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockAppt({ status: 'scheduled' }))
      vi.mocked(repo.updateStatus).mockResolvedValue(mockAppt({ status: 'completed' }))
      const result = await service.updateStatus('appt-1', 'tenant-1', { status: 'completed' })
      expect(result.status).toBe('completed')
    })

    it('throws ConflictException when appointment is cancelled and status is not "scheduled"', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockAppt({ status: 'cancelled' }))
      await expect(
        service.updateStatus('appt-1', 'tenant-1', { status: 'completed' }),
      ).rejects.toThrow(ConflictException)
    })

    it('allows re-scheduling a cancelled appointment', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockAppt({ status: 'cancelled' }))
      vi.mocked(repo.updateStatus).mockResolvedValue(mockAppt({ status: 'scheduled' }))
      const result = await service.updateStatus('appt-1', 'tenant-1', { status: 'scheduled' })
      expect(result.status).toBe('scheduled')
    })

    it('blocks manual completed when a live consultation is linked', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockAppt({ status: 'in_progress' }))
      vi.mocked(repo.findLiveConsultation).mockResolvedValue({ id: 'c-1', status: 'open' })
      await expect(
        service.updateStatus('appt-1', 'tenant-1', { status: 'completed' }),
      ).rejects.toMatchObject({ response: { code: ErrorCode.APPOINTMENT_HAS_CONSULTATION } })
    })

    it('blocks manual completed even when the linked consultation is signed', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockAppt({ status: 'in_progress' }))
      vi.mocked(repo.findLiveConsultation).mockResolvedValue({ id: 'c-1', status: 'signed' })
      await expect(
        service.updateStatus('appt-1', 'tenant-1', { status: 'completed' }),
      ).rejects.toMatchObject({ response: { code: ErrorCode.APPOINTMENT_HAS_CONSULTATION } })
    })

    it('blocks cancelled and no_show while an open consultation exists', async () => {
      for (const status of ['cancelled', 'no_show'] as const) {
        vi.mocked(repo.findById).mockResolvedValue(mockAppt({ status: 'in_progress' }))
        vi.mocked(repo.findLiveConsultation).mockResolvedValue({ id: 'c-1', status: 'open' })
        await expect(
          service.updateStatus('appt-1', 'tenant-1', { status }),
        ).rejects.toMatchObject({ response: { code: ErrorCode.APPOINTMENT_HAS_OPEN_CONSULTATION } })
      }
    })

    it('allows cancelled when the linked consultation is not open (signed)', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockAppt({ status: 'scheduled' }))
      vi.mocked(repo.findLiveConsultation).mockResolvedValue({ id: 'c-1', status: 'signed' })
      vi.mocked(repo.updateStatus).mockResolvedValue(mockAppt({ status: 'cancelled' }))
      const result = await service.updateStatus('appt-1', 'tenant-1', { status: 'cancelled' })
      expect(result.status).toBe('cancelled')
    })

    it('still allows manual completed when no consultation is linked', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockAppt({ status: 'scheduled' }))
      vi.mocked(repo.findLiveConsultation).mockResolvedValue(null)
      vi.mocked(repo.updateStatus).mockResolvedValue(mockAppt({ status: 'completed' }))
      const result = await service.updateStatus('appt-1', 'tenant-1', { status: 'completed' })
      expect(result.status).toBe('completed')
    })

    it('rejects manual in_progress on an unlinked appointment (machine-owned)', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockAppt({ status: 'scheduled' }))
      vi.mocked(repo.findLiveConsultation).mockResolvedValue(null)
      await expect(
        service.updateStatus('appt-1', 'tenant-1', { status: 'in_progress' }),
      ).rejects.toMatchObject({ response: { code: ErrorCode.APPOINTMENT_STATUS_MACHINE_OWNED } })
      expect(repo.updateStatus).not.toHaveBeenCalled()
    })

    it('rejects manual in_progress even when a consultation is linked', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockAppt({ status: 'in_progress' }))
      vi.mocked(repo.findLiveConsultation).mockResolvedValue({ id: 'c-1', status: 'open' })
      await expect(
        service.updateStatus('appt-1', 'tenant-1', { status: 'in_progress' }),
      ).rejects.toMatchObject({ response: { code: ErrorCode.APPOINTMENT_STATUS_MACHINE_OWNED } })
      expect(repo.updateStatus).not.toHaveBeenCalled()
    })

    it('blocks manual scheduled when a live consultation is linked', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockAppt({ status: 'in_progress' }))
      vi.mocked(repo.findLiveConsultation).mockResolvedValue({ id: 'c-1', status: 'open' })
      await expect(
        service.updateStatus('appt-1', 'tenant-1', { status: 'scheduled' }),
      ).rejects.toMatchObject({ response: { code: ErrorCode.APPOINTMENT_HAS_CONSULTATION } })
      expect(repo.updateStatus).not.toHaveBeenCalled()
    })

    it('allows manual scheduled on an unlinked appointment (un-cancel path preserved)', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockAppt({ status: 'cancelled' }))
      vi.mocked(repo.findLiveConsultation).mockResolvedValue(null)
      vi.mocked(repo.updateStatus).mockResolvedValue(mockAppt({ status: 'scheduled' }))
      const result = await service.updateStatus('appt-1', 'tenant-1', { status: 'scheduled' })
      expect(result.status).toBe('scheduled')
    })
  })

  // ── remove ───────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('soft-deletes when appointment exists and no consultation is linked', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockAppt())
      vi.mocked(repo.findLiveConsultation).mockResolvedValue(null)
      vi.mocked(repo.softDelete).mockResolvedValue(undefined)
      await service.remove('appt-1', 'tenant-1')
      expect(repo.softDelete).toHaveBeenCalledWith('appt-1', 'tenant-1')
    })

    it('throws NotFoundException when appointment not found', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null)
      await expect(service.remove('bad', 'tenant-1')).rejects.toThrow(NotFoundException)
    })

    it('blocks deletion while an open consultation is linked', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockAppt({ status: 'in_progress' }))
      vi.mocked(repo.findLiveConsultation).mockResolvedValue({ id: 'c-1', status: 'open' })
      await expect(service.remove('appt-1', 'tenant-1')).rejects.toMatchObject({
        response: { code: ErrorCode.APPOINTMENT_HAS_OPEN_CONSULTATION },
      })
      expect(repo.softDelete).not.toHaveBeenCalled()
    })

    it('allows deletion when the linked consultation is signed', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockAppt({ status: 'completed' }))
      vi.mocked(repo.findLiveConsultation).mockResolvedValue({ id: 'c-1', status: 'signed' })
      vi.mocked(repo.softDelete).mockResolvedValue(undefined)
      await service.remove('appt-1', 'tenant-1')
      expect(repo.softDelete).toHaveBeenCalledWith('appt-1', 'tenant-1')
    })
  })
})
