import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ProtocolRecommendationsRepository } from '../protocol-recommendations.repository.js'
import type { PrismaService } from '../../../lib/prisma.service.js'

/**
 * Verifies that the repository tags every result with its `source` and that
 * per-patient signals (lastUsedAt, usageCount, isMostProbable) are zeroed for
 * rows sourced from the doctor's overall history or fallback.
 *
 * The repository issues three sequential `$queryRawUnsafe` calls (steps 1–3).
 * We mock the Prisma service's queryRawUnsafe to return canned rows for each
 * call in order, then assert the mapping output.
 */
describe('ProtocolRecommendationsRepository — source tagging', () => {
  let prisma: { $queryRawUnsafe: ReturnType<typeof vi.fn> }
  let repo: ProtocolRecommendationsRepository

  const tenantId = '00000000-0000-0000-0000-000000000001'
  const doctorUserId = '00000000-0000-0000-0000-000000000002'
  const patientId = '00000000-0000-0000-0000-000000000003'

  beforeEach(() => {
    prisma = { $queryRawUnsafe: vi.fn() }
    repo = new ProtocolRecommendationsRepository(prisma as unknown as PrismaService)
  })

  it('marks step-1 rows as patient-history with full per-patient signals', async () => {
    prisma.$queryRawUnsafe
      .mockResolvedValueOnce([
        {
          protocolId: 'p1',
          title: 'HTA',
          typeId: 't1',
          typeName: 'Cardiovascular',
          currentVersionNumber: 2,
          lastUsedAt: new Date('2026-04-01T10:00:00Z'),
          usageCount: 3,
        },
      ])
      // No remaining slots → step 2/3 never called, but mock anyway
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    const result = await repo.findRecommendations(tenantId, doctorUserId, patientId, 1)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      protocolId: 'p1',
      source: 'patient-history',
      usageCount: 3,
      isMostProbable: true,
    })
    expect(result[0].lastUsedAt).toBe('2026-04-01T10:00:00.000Z')
  })

  it('zeros per-patient signals for step-2 doctor-history rows', async () => {
    prisma.$queryRawUnsafe
      // Step 1: empty
      .mockResolvedValueOnce([])
      // Step 2: doctor-wide history (note non-zero usageCount + non-null lastUsedAt
      // — these are doctor-wide, MUST NOT bleed into the per-patient response)
      .mockResolvedValueOnce([
        {
          protocolId: 'p2',
          title: 'Asma',
          typeId: 't2',
          typeName: 'Respiratorio',
          currentVersionNumber: 1,
          lastUsedAt: new Date('2026-04-15T10:00:00Z'),
          usageCount: 7,
        },
      ])
      .mockResolvedValueOnce([])

    const result = await repo.findRecommendations(tenantId, doctorUserId, patientId, 5)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      protocolId: 'p2',
      source: 'doctor-history',
      usageCount: 0,
      lastUsedAt: null,
      isMostProbable: false,
    })
  })

  it('isMostProbable is false when the top entry is doctor-history', async () => {
    prisma.$queryRawUnsafe
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          protocolId: 'p2',
          title: 'Asma',
          typeId: 't2',
          typeName: 'Respiratorio',
          currentVersionNumber: 1,
          lastUsedAt: new Date('2026-04-15T10:00:00Z'),
          usageCount: 7,
        },
      ])
      .mockResolvedValueOnce([])

    const result = await repo.findRecommendations(tenantId, doctorUserId, patientId, 5)
    expect(result[0].isMostProbable).toBe(false)
  })

  it('marks step-3 rows as fallback with null lastUsedAt and zero usageCount', async () => {
    prisma.$queryRawUnsafe
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          protocolId: 'p3',
          title: 'Tos crónica',
          typeId: 't3',
          typeName: 'Respiratorio',
          currentVersionNumber: 1,
          lastUsedAt: null,
          usageCount: 0,
        },
      ])

    const result = await repo.findRecommendations(tenantId, doctorUserId, patientId, 5)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      protocolId: 'p3',
      source: 'fallback',
      usageCount: 0,
      lastUsedAt: null,
      isMostProbable: false,
    })
  })

  it('mixes patient-history + doctor-history rows correctly', async () => {
    prisma.$queryRawUnsafe
      .mockResolvedValueOnce([
        {
          protocolId: 'p1',
          title: 'HTA',
          typeId: 't1',
          typeName: 'Cardiovascular',
          currentVersionNumber: 2,
          lastUsedAt: new Date('2026-04-01T10:00:00Z'),
          usageCount: 3,
        },
      ])
      .mockResolvedValueOnce([
        {
          protocolId: 'p2',
          title: 'Asma',
          typeId: 't2',
          typeName: 'Respiratorio',
          currentVersionNumber: 1,
          lastUsedAt: new Date('2026-04-15T10:00:00Z'),
          usageCount: 7,
        },
      ])
      .mockResolvedValueOnce([])

    const result = await repo.findRecommendations(tenantId, doctorUserId, patientId, 5)
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      source: 'patient-history',
      isMostProbable: true,
      usageCount: 3,
    })
    expect(result[1]).toMatchObject({
      source: 'doctor-history',
      isMostProbable: false,
      usageCount: 0,
      lastUsedAt: null,
    })
  })
})
