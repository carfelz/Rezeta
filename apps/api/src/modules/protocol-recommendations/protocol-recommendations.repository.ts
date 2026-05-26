import { Injectable, Inject } from '@nestjs/common'
import type { ProtocolRecommendation, ProtocolRecommendationSource } from '@rezeta/shared'
import { PrismaService } from '../../lib/prisma.service.js'

interface RankedCandidate {
  protocolId: string
  title: string
  categoryId: string | null
  categoryName: string | null
  currentVersionNumber: number | null
  lastUsedAt: Date | null
  usageCount: number
  source: ProtocolRecommendationSource
}

@Injectable()
export class ProtocolRecommendationsRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  /**
   * Returns ranked protocol candidates for a given (tenant, doctor, patient)
   * combo. Strategy:
   *   1. Prior usages with THIS patient (sorted by lastUsedAt DESC, usageCount DESC)
   *   2. Doctor's most-used active protocols (excludes already-listed in step 1)
   *   3. Other tenant active protocols ordered by updatedAt DESC (fallback)
   *
   * `source` distinguishes step 1 from steps 2/3. Per-patient signals
   * (`isMostProbable`, `lastUsedAt`, `usageCount`) are surfaced only when
   * `source === 'patient-history'` — otherwise they'd carry doctor-wide data
   * but be displayed as patient-specific.
   */
  async getRecommendations(
    tenantId: string,
    patientId: string,
    doctorUserId: string,
    limit: number,
  ): Promise<ProtocolRecommendation[]> {
    // ── Step 1: per-patient history ──
    const perPatientRaw = await this.prisma.$queryRawUnsafe<Omit<RankedCandidate, 'source'>[]>(
      `
      SELECT
        p.id AS "protocolId",
        p.title AS "title",
        p.category_id AS "categoryId",
        pc.name AS "categoryName",
        pv.version_number AS "currentVersionNumber",
        MAX(pu.applied_at) AS "lastUsedAt",
        COUNT(*)::int AS "usageCount"
      FROM protocol_usages pu
      JOIN consultations c ON c.id = pu.consultation_id
      JOIN protocols p ON p.id = pu.protocol_id
      LEFT JOIN protocol_categories pc ON pc.id = p.category_id
      LEFT JOIN protocol_versions pv ON pv.id = p.current_version_id
      WHERE pu.tenant_id = $1::uuid
        AND c.patient_id = $2::uuid
        AND c.doctor_id = $3::uuid
        AND p.deleted_at IS NULL
        AND p.status = 'active'
        AND pv.id IS NOT NULL
        AND jsonb_array_length(COALESCE(pv.content -> 'blocks', '[]'::jsonb)) > 0
      GROUP BY p.id, p.title, p.category_id, pc.name, pv.version_number
      ORDER BY MAX(pu.applied_at) DESC, COUNT(*) DESC
      LIMIT $4
      `,
      tenantId,
      patientId,
      doctorUserId,
      limit,
    )
    const perPatient: RankedCandidate[] = perPatientRaw.map((r) => ({
      ...r,
      source: 'patient-history' as const,
    }))

    const taken = new Set(perPatient.map((r) => r.protocolId))
    const remaining = Math.max(0, limit - perPatient.length)

    // ── Step 2: doctor's most-used active protocols overall ──
    let doctorTop: RankedCandidate[] = []
    if (remaining > 0) {
      const doctorTopRaw = await this.prisma.$queryRawUnsafe<Omit<RankedCandidate, 'source'>[]>(
        `
        SELECT
          p.id AS "protocolId",
          p.title AS "title",
          p.category_id AS "categoryId",
          pc.name AS "categoryName",
          pv.version_number AS "currentVersionNumber",
          MAX(pu.applied_at) AS "lastUsedAt",
          COUNT(*)::int AS "usageCount"
        FROM protocol_usages pu
        JOIN consultations c ON c.id = pu.consultation_id
        JOIN protocols p ON p.id = pu.protocol_id
        LEFT JOIN protocol_categories pc ON pc.id = p.category_id
        LEFT JOIN protocol_versions pv ON pv.id = p.current_version_id
        WHERE pu.tenant_id = $1::uuid
          AND c.doctor_id = $2::uuid
          AND p.deleted_at IS NULL
          AND p.status = 'active'
          AND p.id <> ALL($3::uuid[])
          AND pv.id IS NOT NULL
          AND jsonb_array_length(COALESCE(pv.content -> 'blocks', '[]'::jsonb)) > 0
        GROUP BY p.id, p.title, p.category_id, pc.name, pv.version_number
        ORDER BY COUNT(*) DESC, MAX(pu.applied_at) DESC
        LIMIT $4
        `,
        tenantId,
        doctorUserId,
        Array.from(taken),
        remaining,
      )
      doctorTop = doctorTopRaw.map((r) => ({ ...r, source: 'doctor-history' as const }))
      doctorTop.forEach((r) => taken.add(r.protocolId))
    }

    // ── Step 3: tenant fallback ──
    const stillRemaining = Math.max(0, limit - perPatient.length - doctorTop.length)
    let fallback: RankedCandidate[] = []
    if (stillRemaining > 0) {
      const fallbackRaw = await this.prisma.$queryRawUnsafe<Omit<RankedCandidate, 'source'>[]>(
        `
        SELECT
          p.id AS "protocolId",
          p.title AS "title",
          p.category_id AS "categoryId",
          pc.name AS "categoryName",
          pv.version_number AS "currentVersionNumber",
          NULL::timestamp AS "lastUsedAt",
          0::int AS "usageCount"
        FROM protocols p
        LEFT JOIN protocol_categories pc ON pc.id = p.category_id
        LEFT JOIN protocol_versions pv ON pv.id = p.current_version_id
        WHERE p.tenant_id = $1::uuid
          AND p.deleted_at IS NULL
          AND p.status = 'active'
          AND p.id <> ALL($2::uuid[])
          AND pv.id IS NOT NULL
          AND jsonb_array_length(COALESCE(pv.content -> 'blocks', '[]'::jsonb)) > 0
        ORDER BY p.updated_at DESC
        LIMIT $3
        `,
        tenantId,
        Array.from(taken),
        stillRemaining,
      )
      fallback = fallbackRaw.map((r) => ({ ...r, source: 'fallback' as const }))
    }

    const all = [...perPatient, ...doctorTop, ...fallback]
    return all.map((r, idx) => {
      const isPatientHistory = r.source === 'patient-history'
      return {
        protocolId: r.protocolId,
        title: r.title,
        categoryId: r.categoryId,
        categoryName: r.categoryName,
        currentVersionNumber: r.currentVersionNumber,
        lastUsedAt: isPatientHistory && r.lastUsedAt ? new Date(r.lastUsedAt).toISOString() : null,
        usageCount: isPatientHistory ? r.usageCount : 0,
        isMostProbable: idx === 0 && isPatientHistory && r.usageCount > 0,
        source: r.source,
      }
    })
  }
}
