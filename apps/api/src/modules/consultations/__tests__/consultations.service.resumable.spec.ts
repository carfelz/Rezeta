import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ConsultationsService } from '../consultations.service.js'
import type { ConsultationsRepository } from '../consultations.repository.js'
import type { PrismaService } from '../../../lib/prisma.service.js'
import type { InvoicesService } from '../../invoices/invoices.service.js'
import type { ProtocolRecommendationsService } from '../../protocol-recommendations/protocol-recommendations.service.js'
import type { AuditLogService } from '../../../common/audit-log/audit-log.service.js'
import type { ConsultationWithDetails } from '@rezeta/shared'

function makeConsultation(
  overrides: Partial<ConsultationWithDetails> = {},
): ConsultationWithDetails {
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
    updatedAt: new Date(Date.now() - 30 * 60_000).toISOString(),
    deletedAt: null,
    patientName: 'Isabel Cristina',
    locationName: 'Centro',
    doctorName: 'Dr. García',
    amendments: [],
    protocolUsages: [],
    ...overrides,
  }
}

describe('ConsultationsService.getResumableForPatient', () => {
  let repo: { findResumableForPatient: ReturnType<typeof vi.fn> }
  let svc: ConsultationsService

  beforeEach(() => {
    repo = { findResumableForPatient: vi.fn() }
    svc = new ConsultationsService(
      repo as unknown as ConsultationsRepository,
      {} as unknown as PrismaService,
      {} as unknown as InvoicesService,
      { invalidate: vi.fn() } as unknown as ProtocolRecommendationsService,
      { record: vi.fn() } as unknown as AuditLogService,
    )
  })

  it('returns null when no draft consultation exists', async () => {
    repo.findResumableForPatient.mockResolvedValue(null)
    expect(await svc.getResumableForPatient('t1', 'u1', 'pat1')).toBeNull()
  })

  it('returns null when elapsed minutes < 10 (under threshold)', async () => {
    const c = makeConsultation({
      updatedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    })
    repo.findResumableForPatient.mockResolvedValue(c)
    expect(await svc.getResumableForPatient('t1', 'u1', 'pat1')).toBeNull()
  })

  it('returns ResumableConsultation when elapsed ≥ 10 minutes', async () => {
    const c = makeConsultation({
      updatedAt: new Date(Date.now() - 47 * 60_000).toISOString(),
    })
    repo.findResumableForPatient.mockResolvedValue(c)
    const result = await svc.getResumableForPatient('t1', 'u1', 'pat1')
    expect(result).not.toBeNull()
    expect(result?.consultationId).toBe('c1')
    expect(result?.patientName).toBe('Isabel Cristina')
    expect(result?.elapsedMinutes).toBe(47)
  })

  it('returns null lastEditField (SOAP fields removed in schema reset v2)', async () => {
    const c = makeConsultation({
      updatedAt: new Date(Date.now() - 30 * 60_000).toISOString(),
    })
    repo.findResumableForPatient.mockResolvedValue(c)
    const result = await svc.getResumableForPatient('t1', 'u1', 'pat1')
    expect(result?.lastEditField).toBeNull()
  })

  it('passes 7-day window to repository', async () => {
    repo.findResumableForPatient.mockResolvedValue(null)
    await svc.getResumableForPatient('t1', 'u1', 'pat1')
    expect(repo.findResumableForPatient).toHaveBeenCalledWith('t1', 'u1', 'pat1', 7)
  })
})
