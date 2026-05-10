import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ProtocolRecommendationsService } from '../protocol-recommendations.service.js'
import type { ProtocolRecommendationsRepository } from '../protocol-recommendations.repository.js'
import type { ProtocolRecommendation } from '@rezeta/shared'

const sample: ProtocolRecommendation[] = [
  {
    protocolId: 'p1',
    title: 'HTA',
    typeId: 't1',
    typeName: 'Cardiovascular',
    currentVersionNumber: 2,
    lastUsedAt: '2026-04-01T10:00:00.000Z',
    usageCount: 3,
    isMostProbable: true,
    source: 'patient-history',
  },
]

describe('ProtocolRecommendationsService', () => {
  let repo: { findRecommendations: ReturnType<typeof vi.fn> }
  let svc: ProtocolRecommendationsService

  beforeEach(() => {
    repo = { findRecommendations: vi.fn().mockResolvedValue(sample) }
    svc = new ProtocolRecommendationsService(repo as unknown as ProtocolRecommendationsRepository)
  })

  it('returns recommendations from the repository', async () => {
    const result = await svc.getForPatient('t1', 'd1', 'pat1', 6)
    expect(result).toEqual(sample)
    expect(repo.findRecommendations).toHaveBeenCalledWith('t1', 'd1', 'pat1', 6)
  })

  it('caches results within TTL window (single repo call)', async () => {
    await svc.getForPatient('t1', 'd1', 'pat1', 6)
    await svc.getForPatient('t1', 'd1', 'pat1', 6)
    expect(repo.findRecommendations).toHaveBeenCalledTimes(1)
  })

  it('cache key includes limit (different limits hit repo separately)', async () => {
    await svc.getForPatient('t1', 'd1', 'pat1', 6)
    await svc.getForPatient('t1', 'd1', 'pat1', 3)
    expect(repo.findRecommendations).toHaveBeenCalledTimes(2)
  })

  it('cache key separates different patients', async () => {
    await svc.getForPatient('t1', 'd1', 'pat1', 6)
    await svc.getForPatient('t1', 'd1', 'pat2', 6)
    expect(repo.findRecommendations).toHaveBeenCalledTimes(2)
  })

  it('invalidate clears entries for matching tuple', async () => {
    await svc.getForPatient('t1', 'd1', 'pat1', 6)
    svc.invalidate('t1', 'd1', 'pat1')
    await svc.getForPatient('t1', 'd1', 'pat1', 6)
    expect(repo.findRecommendations).toHaveBeenCalledTimes(2)
  })

  it('invalidate keeps unrelated entries cached', async () => {
    await svc.getForPatient('t1', 'd1', 'pat1', 6)
    await svc.getForPatient('t1', 'd1', 'pat2', 6)
    svc.invalidate('t1', 'd1', 'pat1')
    await svc.getForPatient('t1', 'd1', 'pat2', 6)
    expect(repo.findRecommendations).toHaveBeenCalledTimes(2)
  })

  it('clearCache empties the cache', async () => {
    await svc.getForPatient('t1', 'd1', 'pat1', 6)
    svc.clearCache()
    await svc.getForPatient('t1', 'd1', 'pat1', 6)
    expect(repo.findRecommendations).toHaveBeenCalledTimes(2)
  })

  it('clamps limit between 1 and 20 at the controller level (passes limit through)', async () => {
    await svc.getForPatient('t1', 'd1', 'pat1', 5)
    expect(repo.findRecommendations).toHaveBeenLastCalledWith('t1', 'd1', 'pat1', 5)
  })
})
