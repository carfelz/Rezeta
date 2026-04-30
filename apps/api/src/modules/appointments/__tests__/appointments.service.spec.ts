/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common'
import { AppointmentsService } from '../appointments.service.js'
import type { AppointmentsRepository } from '../appointments.repository.js'
import { ErrorCode } from '@rezeta/shared'
import type { AppointmentWithDetails } from '@rezeta/shared'

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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
    ...overrides,
  }
}

describe('AppointmentsService', () => {
  let repo: AppointmentsRepository
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
    } as unknown as AppointmentsRepository
    service = new AppointmentsService(repo)
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
  })

  // ── remove ───────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('soft-deletes when appointment exists', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockAppt())
      vi.mocked(repo.softDelete).mockResolvedValue(undefined)
      await service.remove('appt-1', 'tenant-1')
      expect(repo.softDelete).toHaveBeenCalledWith('appt-1', 'tenant-1')
    })

    it('throws NotFoundException when appointment not found', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null)
      await expect(service.remove('bad', 'tenant-1')).rejects.toThrow(NotFoundException)
    })
  })
})
