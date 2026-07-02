import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotFoundException } from '@nestjs/common'
import { ErrorCode } from '@rezeta/shared'
import { ReferenceGuardService } from '../reference-guard.service.js'
import type { PrismaService } from '../../../lib/prisma.service.js'

const TENANT = 'tenant-1'
const ID = '00000000-0000-0000-0000-000000000001'

interface DelegateMock {
  findFirst: ReturnType<typeof vi.fn>
}

describe('ReferenceGuardService', () => {
  let prisma: PrismaService
  let patient: DelegateMock
  let location: DelegateMock
  let appointment: DelegateMock
  let consultation: DelegateMock
  let service: ReferenceGuardService

  beforeEach(() => {
    patient = { findFirst: vi.fn() }
    location = { findFirst: vi.fn() }
    appointment = { findFirst: vi.fn() }
    consultation = { findFirst: vi.fn() }
    prisma = { patient, location, appointment, consultation } as unknown as PrismaService
    service = new ReferenceGuardService(prisma)
  })

  const cases = [
    { method: 'assertPatient' as const, delegate: () => patient, code: ErrorCode.PATIENT_NOT_FOUND },
    {
      method: 'assertLocation' as const,
      delegate: () => location,
      code: ErrorCode.LOCATION_NOT_FOUND,
    },
    {
      method: 'assertAppointment' as const,
      delegate: () => appointment,
      code: ErrorCode.APPOINTMENT_NOT_FOUND,
    },
    {
      method: 'assertConsultation' as const,
      delegate: () => consultation,
      code: ErrorCode.CONSULTATION_NOT_FOUND,
    },
  ]

  for (const { method, delegate, code } of cases) {
    describe(method, () => {
      it('resolves when the row exists in the tenant', async () => {
        delegate().findFirst.mockResolvedValue({ id: ID })
        await expect(service[method](ID, TENANT)).resolves.toBeUndefined()
      })

      it('queries scoped by id + tenantId + not-deleted', async () => {
        delegate().findFirst.mockResolvedValue({ id: ID })
        await service[method](ID, TENANT)
        expect(delegate().findFirst).toHaveBeenCalledWith({
          where: { id: ID, tenantId: TENANT, deletedAt: null },
          select: { id: true },
        })
      })

      it('throws NotFoundException when the row is missing / in another tenant', async () => {
        delegate().findFirst.mockResolvedValue(null)
        await expect(service[method](ID, TENANT)).rejects.toThrow(NotFoundException)
      })

      it(`throws with ${code} code`, async () => {
        delegate().findFirst.mockResolvedValue(null)
        try {
          await service[method](ID, TENANT)
          expect.unreachable('should have thrown')
        } catch (err) {
          const body = (err as NotFoundException).getResponse() as { code: string }
          expect(body.code).toBe(code)
        }
      })
    })
  }
})
