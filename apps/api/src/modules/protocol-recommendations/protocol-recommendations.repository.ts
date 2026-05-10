import { Injectable, Inject } from '@nestjs/common'
import type { ProtocolRecommendation } from '@rezeta/shared'
import { PrismaService } from '../../lib/prisma.service.js'

interface RankedCandidate {
  protocolId: string
  title: string
  typeId: string
  typeName: string
  currentVersionNumber: number | null
  lastUsedAt: Date | null
  usageCount: number
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
   * The returned array is at most `limit` entries. The first entry is marked
   * `isMostProbable=true` only if it has prior usage with this patient
   * (`usageCount > 0`); otherwise no entry gets the badge.
   *
   * Note: physical tables/columns are snake_case (Prisma `@@map` / `@map`);
   * column aliases stay double-quoted so Postgres preserves the camelCase JS
   * keys in the result rows.
   */
  async findRecommendations(
    tenantId: string,
    doctorUserId: string,
    patientId: string,
    limit: number,
  ): Promise<ProtocolRecommendation[]> {
    // ── Step 1: per-patient history ──
    const perPatient = await this.prisma.$queryRawUnsafe<RankedCandidate[]>(
      `
      SELECT
        p.id AS "protocolId",
        p.title AS "title",
        p.type_id AS "typeId",
        pt.name AS "typeName",
        pv.version_number AS "currentVersionNumber",
        MAX(pu.applied_at) AS "lastUsedAt",
        COUNT(*)::int AS "usageCount"
      FROM protocol_usages pu
      JOIN consultations c ON c.id = pu.consultation_id
      JOIN protocols p ON p.id = pu.protocol_id
      JOIN protocol_types pt ON pt.id = p.type_id
      LEFT JOIN protocol_versions pv ON pv.id = p.current_version_id
      WHERE pu.tenant_id = $1::uuid
        AND c.patient_id = $2::uuid
        AND c.user_id = $3::uuid
        AND p.deleted_at IS NULL
        AND p.status = 'active'
      GROUP BY p.id, p.title, p.type_id, pt.name, pv.version_number
      ORDER BY MAX(pu.applied_at) DESC, COUNT(*) DESC
      LIMIT $4
      `,
      tenantId,
      patientId,
      doctorUserId,
      limit,
    )

    const taken = new Set(perPatient.map((r) => r.protocolId))
    const remaining = Math.max(0, limit - perPatient.length)

    // ── Step 2: doctor's most-used active protocols overall ──
    let doctorTop: RankedCandidate[] = []
    if (remaining > 0) {
      doctorTop = await this.prisma.$queryRawUnsafe<RankedCandidate[]>(
        `
        SELECT
          p.id AS "protocolId",
          p.title AS "title",
          p.type_id AS "typeId",
          pt.name AS "typeName",
          pv.version_number AS "currentVersionNumber",
          MAX(pu.applied_at) AS "lastUsedAt",
          COUNT(*)::int AS "usageCount"
        FROM protocol_usages pu
        JOIN consultations c ON c.id = pu.consultation_id
        JOIN protocols p ON p.id = pu.protocol_id
        JOIN protocol_types pt ON pt.id = p.type_id
        LEFT JOIN protocol_versions pv ON pv.id = p.current_version_id
        WHERE pu.tenant_id = $1::uuid
          AND c.user_id = $2::uuid
          AND p.deleted_at IS NULL
          AND p.status = 'active'
          AND p.id <> ALL($3::uuid[])
        GROUP BY p.id, p.title, p.type_id, pt.name, pv.version_number
        ORDER BY COUNT(*) DESC, MAX(pu.applied_at) DESC
        LIMIT $4
        `,
        tenantId,
        doctorUserId,
        Array.from(taken),
        remaining,
      )
      doctorTop.forEach((r) => taken.add(r.protocolId))
    }

    // ── Step 3: tenant fallback ──
    const stillRemaining = Math.max(0, limit - perPatient.length - doctorTop.length)
    let fallback: RankedCandidate[] = []
    if (stillRemaining > 0) {
      fallback = await this.prisma.$queryRawUnsafe<RankedCandidate[]>(
        `
        SELECT
          p.id AS "protocolId",
          p.title AS "title",
          p.type_id AS "typeId",
          pt.name AS "typeName",
          pv.version_number AS "currentVersionNumber",
          NULL::timestamp AS "lastUsedAt",
          0::int AS "usageCount"
        FROM protocols p
        JOIN protocol_types pt ON pt.id = p.type_id
        LEFT JOIN protocol_versions pv ON pv.id = p.current_version_id
        WHERE p.tenant_id = $1::uuid
          AND p.deleted_at IS NULL
          AND p.status = 'active'
          AND p.id <> ALL($2::uuid[])
        ORDER BY p.updated_at DESC
        LIMIT $3
        `,
        tenantId,
        Array.from(taken),
        stillRemaining,
      )
    }

    const all = [...perPatient, ...doctorTop, ...fallback]
    return all.map((r, idx) => ({
      protocolId: r.protocolId,
      title: r.title,
      typeId: r.typeId,
      typeName: r.typeName,
      currentVersionNumber: r.currentVersionNumber,
      lastUsedAt: r.lastUsedAt ? new Date(r.lastUsedAt).toISOString() : null,
      usageCount: r.usageCount,
      isMostProbable: idx === 0 && r.usageCount > 0,
    }))
  }
}
