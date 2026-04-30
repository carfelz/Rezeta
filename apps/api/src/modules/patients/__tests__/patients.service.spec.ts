/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotFoundException } from '@nestjs/common'
import { PatientsService } from '../patients.service.js'
import type { PatientsRepository } from '../patients.repository.js'
import { ErrorCode } from '@rezeta/shared'
import type { Patient } from '@rezeta/db'

const mockPatient = (overrides: Partial<Patient> = {}): Patient =>
  ({
    id: 'patient-id-1',
    tenantId: 'tenant-1',
    ownerUserId: 'user-1',
    fullName: 'María García',
    dateOfBirth: null,
    sex: null,
    documentType: null,
    documentNumber: null,
    phone: null,
    email: null,
    address: null,
    bloodType: null,
    allergies: [],
    chronicConditions: [],
    notes: null,
    isActive: true,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Patient)

describe('PatientsService', () => {
  let repo: PatientsRepository
  let service: PatientsService

  beforeEach(() => {
    repo = {
      findMany: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
    } as unknown as PatientsRepository
    service = new PatientsService(repo)
  })

  // ── list ────────────────────────────────────────────────────────────────────

  describe('list', () => {
    it('returns items and hasMore: false when results fit within limit', async () => {
      const patients = [mockPatient(), mockPatient({ id: 'patient-id-2' })]
      vi.mocked(repo.findMany).mockResolvedValue(patients)
      const result = await service.list({ tenantId: 'tenant-1', limit: 50 })
      expect(result.items).toHaveLength(2)
      expect(result.hasMore).toBe(false)
      expect(result.nextCursor).toBeUndefined()
    })

    it('returns hasMore: true and nextCursor when results exceed limit', async () => {
      // Service requests limit+1 rows and checks if there are more
      const patients = Array.from({ length: 3 }, (_, i) => mockPatient({ id: `p-${i}` }))
      vi.mocked(repo.findMany).mockResolvedValue(patients)
      const result = await service.list({ tenantId: 'tenant-1', limit: 2 })
      expect(result.hasMore).toBe(true)
      expect(result.items).toHaveLength(2)
      expect(result.nextCursor).toBe('p-1')
    })

    it('applies default limit of 50 when not specified', async () => {
      vi.mocked(repo.findMany).mockResolvedValue([])
      await service.list({ tenantId: 'tenant-1' })
      expect(repo.findMany).toHaveBeenCalledWith(expect.objectContaining({ limit: 50 }))
    })

    it('returns empty list', async () => {
      vi.mocked(repo.findMany).mockResolvedValue([])
      const result = await service.list({ tenantId: 'tenant-1' })
      expect(result.items).toHaveLength(0)
      expect(result.hasMore).toBe(false)
    })
  })

  // ── getById ─────────────────────────────────────────────────────────────────

  describe('getById', () => {
    it('returns patient when found', async () => {
      const patient = mockPatient()
      vi.mocked(repo.findById).mockResolvedValue(patient)
      const result = await service.getById('patient-id-1', 'tenant-1')
      expect(result).toEqual(patient)
    })

    it('throws NotFoundException when patient not found', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null)
      await expect(service.getById('bad-id', 'tenant-1')).rejects.toThrow(NotFoundException)
    })

    it('thrown NotFoundException has PATIENT_NOT_FOUND code', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null)
      try {
        await service.getById('bad-id', 'tenant-1')
        expect.fail('should have thrown')
      } catch (err) {
        const body = (err as NotFoundException).getResponse() as { code: string }
        expect(body.code).toBe(ErrorCode.PATIENT_NOT_FOUND)
      }
    })
  })

  // ── create ──────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('delegates to repository and returns created patient', async () => {
      const patient = mockPatient()
      vi.mocked(repo.create).mockResolvedValue(patient)
      const dto = { fullName: 'María García', allergies: [], chronicConditions: [] }
      const result = await service.create('tenant-1', 'user-1', dto)
      expect(repo.create).toHaveBeenCalledWith('tenant-1', 'user-1', dto)
      expect(result).toEqual(patient)
    })
  })

  // ── update ──────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates and returns updated patient', async () => {
      const patient = mockPatient({ fullName: 'María Actualizada' })
      vi.mocked(repo.findById).mockResolvedValue(mockPatient())
      vi.mocked(repo.update).mockResolvedValue(patient)
      const result = await service.update('patient-id-1', 'tenant-1', { fullName: 'María Actualizada' })
      expect(result.fullName).toBe('María Actualizada')
    })

    it('throws NotFoundException when patient does not exist', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null)
      await expect(service.update('bad-id', 'tenant-1', { fullName: 'X' })).rejects.toThrow(
        NotFoundException,
      )
    })

    it('does not call repo.update if patient not found', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null)
      await service.update('bad-id', 'tenant-1', {}).catch(() => {})
      expect(repo.update).not.toHaveBeenCalled()
    })
  })

  // ── remove ──────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('soft-deletes patient when found', async () => {
      vi.mocked(repo.findById).mockResolvedValue(mockPatient())
      vi.mocked(repo.softDelete).mockResolvedValue(undefined)
      await service.remove('patient-id-1', 'tenant-1')
      expect(repo.softDelete).toHaveBeenCalledWith('patient-id-1', 'tenant-1')
    })

    it('throws NotFoundException when patient not found', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null)
      await expect(service.remove('bad-id', 'tenant-1')).rejects.toThrow(NotFoundException)
    })

    it('does not call softDelete when patient not found', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null)
      await service.remove('bad-id', 'tenant-1').catch(() => {})
      expect(repo.softDelete).not.toHaveBeenCalled()
    })
  })
})
