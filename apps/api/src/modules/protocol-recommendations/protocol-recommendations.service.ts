import { Injectable, Inject } from '@nestjs/common'
import type { ProtocolRecommendation } from '@rezeta/shared'
import { ProtocolRecommendationsRepository } from './protocol-recommendations.repository.js'

interface CacheEntry {
  expiresAt: number
  data: ProtocolRecommendation[]
}

const CACHE_TTL_MS = 60_000 // 1 minute — short enough that protocol creates/edits show up quickly

@Injectable()
export class ProtocolRecommendationsService {
  // Tiny in-memory cache keyed by (tenant, doctor, patient, limit). Single-process
  // Cloud Run instances make this safe enough; multi-instance miss-rate cost is
  // bounded by TTL. Trade simplicity for correctness here — we'd swap to Redis
  // if metrics show frequent misses.
  private cache = new Map<string, CacheEntry>()

  constructor(
    @Inject(ProtocolRecommendationsRepository)
    private readonly repo: ProtocolRecommendationsRepository,
  ) {}

  async getForPatient(
    tenantId: string,
    doctorUserId: string,
    patientId: string,
    limit = 6,
  ): Promise<ProtocolRecommendation[]> {
    const key = `${tenantId}:${doctorUserId}:${patientId}:${limit}`
    const now = Date.now()
    const hit = this.cache.get(key)
    if (hit && hit.expiresAt > now) return hit.data
    const data = await this.repo.findRecommendations(tenantId, doctorUserId, patientId, limit)
    this.cache.set(key, { data, expiresAt: now + CACHE_TTL_MS })
    return data
  }

  /** Invalidates the cache for a given (tenant, doctor, patient) tuple. */
  invalidate(tenantId: string, doctorUserId: string, patientId: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${tenantId}:${doctorUserId}:${patientId}:`)) {
        this.cache.delete(key)
      }
    }
  }

  /** Clears the entire cache. Test-only escape hatch. */
  clearCache(): void {
    this.cache.clear()
  }
}
