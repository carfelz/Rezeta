export interface ParseLimitOptions {
  /** Value used when the input is absent or unparseable. */
  fallback?: number
  /** Hard upper bound — protects list endpoints from unbounded `take`. */
  max?: number
  /** Lower bound (at least 1 by default). */
  min?: number
}

const DEFAULT_FALLBACK = 50
const DEFAULT_MAX = 100
const DEFAULT_MIN = 1

/**
 * Parse and clamp a client-supplied `limit` query param.
 *
 * List endpoints translate `limit` into a Prisma `take`. An unbounded or NaN
 * limit is a cheap denial-of-service (fetch/serialize the entire table), so
 * every list endpoint must route its raw `limit` through this helper rather
 * than a bare `parseInt`.
 */
export function parseLimit(raw: string | number | undefined, options: ParseLimitOptions = {}): number {
  const fallback = options.fallback ?? DEFAULT_FALLBACK
  const max = options.max ?? DEFAULT_MAX
  const min = options.min ?? DEFAULT_MIN

  const parsed = typeof raw === 'number' ? raw : raw != null ? parseInt(raw, 10) : NaN
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(parsed)))
}
