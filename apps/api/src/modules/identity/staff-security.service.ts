import { Inject, Injectable } from '@nestjs/common'
import type { StaffSecurityInstitutionDto, StaffSecurityOverviewDto } from '@rezeta/shared'
import {
  IdentityRepository,
  type StaffSecurityLoginRow,
  type StaffSecurityUserRow,
} from './identity.repository.js'

const DAY_MS = 24 * 60 * 60 * 1000
const LOGIN_WINDOW_DAYS = 30
const SPARKLINE_DAYS = 14
const RECENT_WINDOW_DAYS = 7
const TENANT_DORMANT_DAYS = 30
const GLOBAL_DORMANT_DAYS = 60

interface LoginAggregates {
  activeInstitutions: number
  activeUsers30d: number
  logins7d: number
  perTenant: Map<string, { mau30d: number; logins14d: number[] }>
}

interface DormancyAggregates {
  dormantAccounts60d: number
  perTenant: Map<string, { dormant30d: number; pendingInvites: number }>
}

/**
 * Staff cross-institution security dashboard (identity design §6 screen 4,
 * §8 slice 5). Reads only counts, dates, and institution names — never
 * clinical data (control-plane isolation invariant, identity design §2
 * decision 5). Every aggregate is built from exactly one repository query
 * per data source (tenants / login events / users), joined in memory here —
 * no N+1 across tenants.
 */
@Injectable()
export class StaffSecurityService {
  constructor(@Inject(IdentityRepository) private repository: IdentityRepository) {}

  async overview(): Promise<StaffSecurityOverviewDto> {
    const now = new Date()
    const since30d = new Date(now.getTime() - LOGIN_WINDOW_DAYS * DAY_MS)

    const [tenants, loginRows, userRows] = await Promise.all([
      this.repository.listAllTenants(),
      this.repository.listSuccessfulLoginsSince(since30d),
      this.repository.listActiveUsersForDormancy(),
    ])

    const loginAgg = aggregateLogins(loginRows, now)
    const dormancyAgg = aggregateDormancy(userRows, now)

    const institutions: StaffSecurityInstitutionDto[] = tenants.map((tenant) => {
      const login = loginAgg.perTenant.get(tenant.id)
      const dormancy = dormancyAgg.perTenant.get(tenant.id)
      return {
        tenantId: tenant.id,
        name: tenant.name,
        plan: tenant.plan as StaffSecurityInstitutionDto['plan'],
        mau30d: login?.mau30d ?? 0,
        logins14d: login?.logins14d ?? new Array<number>(SPARKLINE_DAYS).fill(0),
        dormant30d: dormancy?.dormant30d ?? 0,
        pendingInvites: dormancy?.pendingInvites ?? 0,
      }
    })

    return {
      tiles: {
        activeInstitutions: loginAgg.activeInstitutions,
        activeUsers30d: loginAgg.activeUsers30d,
        logins7d: loginAgg.logins7d,
        dormantAccounts60d: dormancyAgg.dormantAccounts60d,
      },
      institutions,
    }
  }
}

/**
 * `rows` are every successful login in the last 30 days across the
 * platform. The 7-day and 14-day windows are subsets of that same
 * in-memory dataset, so this is the only pass over LoginEvent data the
 * dashboard needs.
 */
function aggregateLogins(rows: StaffSecurityLoginRow[], now: Date): LoginAggregates {
  const since7d = new Date(now.getTime() - RECENT_WINDOW_DAYS * DAY_MS)
  const perTenantRows = new Map<string, StaffSecurityLoginRow[]>()
  const perTenantUsers = new Map<string, Set<string>>()
  const allUsers = new Set<string>()
  let logins7d = 0

  for (const row of rows) {
    if (row.createdAt >= since7d) logins7d += 1
    if (row.userId) allUsers.add(row.userId)
    if (!row.tenantId) continue

    const tenantRows = perTenantRows.get(row.tenantId) ?? []
    tenantRows.push(row)
    perTenantRows.set(row.tenantId, tenantRows)

    if (row.userId) {
      const tenantUsers = perTenantUsers.get(row.tenantId) ?? new Set<string>()
      tenantUsers.add(row.userId)
      perTenantUsers.set(row.tenantId, tenantUsers)
    }
  }

  const perTenant = new Map<string, { mau30d: number; logins14d: number[] }>()
  for (const [tenantId, tenantRows] of perTenantRows) {
    perTenant.set(tenantId, {
      mau30d: perTenantUsers.get(tenantId)?.size ?? 0,
      logins14d: bucketLogins14d(tenantRows, now),
    })
  }

  return { activeInstitutions: perTenantRows.size, activeUsers30d: allUsers.size, logins7d, perTenant }
}

/**
 * Buckets `rows` into 14 daily counts, oldest first, newest (today) last —
 * the mockup's sparkline highlights the last bar as today (identity design
 * §6 screen 4 note 1). Age is measured in whole days back from `now`;
 * anything 14 days old or older (or, defensively, in the future) is
 * dropped — `rows` is already the last-30-days dataset, so in practice
 * only the most recent 14 days ever populate a bucket.
 */
function bucketLogins14d(rows: { createdAt: Date }[], now: Date): number[] {
  const buckets = new Array<number>(SPARKLINE_DAYS).fill(0)
  for (const row of rows) {
    const ageDays = Math.floor((now.getTime() - row.createdAt.getTime()) / DAY_MS)
    if (ageDays < 0 || ageDays >= SPARKLINE_DAYS) continue
    const index = SPARKLINE_DAYS - 1 - ageDays
    buckets[index] = (buckets[index] ?? 0) + 1
  }
  return buckets
}

/**
 * `rows` are every active, non-deleted institution user across the
 * platform. A user is "dormant" at a given window when they have never
 * logged in, or their last login predates the window's cutoff — but only
 * once the account itself is older than that cutoff, so a user invited
 * yesterday is never miscounted as dormant. "Pending invite" has no
 * freshness exclusion: an active user who has never logged in is pending
 * from the moment they're created.
 */
function aggregateDormancy(rows: StaffSecurityUserRow[], now: Date): DormancyAggregates {
  const cutoffTenant = new Date(now.getTime() - TENANT_DORMANT_DAYS * DAY_MS)
  const cutoffGlobal = new Date(now.getTime() - GLOBAL_DORMANT_DAYS * DAY_MS)
  const perTenant = new Map<string, { dormant30d: number; pendingInvites: number }>()
  let dormantAccounts60d = 0

  for (const row of rows) {
    if (isDormantAt(row, cutoffGlobal)) dormantAccounts60d += 1

    const entry = perTenant.get(row.tenantId) ?? { dormant30d: 0, pendingInvites: 0 }
    if (isDormantAt(row, cutoffTenant)) entry.dormant30d += 1
    if (row.lastLoginAt === null) entry.pendingInvites += 1
    perTenant.set(row.tenantId, entry)
  }

  return { dormantAccounts60d, perTenant }
}

/**
 * A row is dormant against `cutoff` when the account itself predates the
 * cutoff (so a freshly invited user is never flagged) AND the user has
 * either never logged in or their last login predates the cutoff too.
 */
function isDormantAt(row: StaffSecurityUserRow, cutoff: Date): boolean {
  if (row.createdAt >= cutoff) return false
  return row.lastLoginAt === null || row.lastLoginAt < cutoff
}
