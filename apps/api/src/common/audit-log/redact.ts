const FIELD_REDACT_RULES: Record<string, Set<string>> = {
  User: new Set(['passwordHash', 'password', 'externalUid']),
  // `documentNumber` is the actual Patient column holding the cédula / passport /
  // RNC (with `documentType` as the discriminator); the legacy per-type keys are
  // kept for defence in depth in case a payload uses them.
  Patient: new Set(['documentNumber', 'cedula', 'rnc', 'passport', 'ssn', 'nationalId']),
  Tenant: new Set(['stripeCustomerId', 'stripeSubscriptionId']),
}

// Document-ID fields are partially masked (last 4 shown) rather than fully
// redacted, per audit-log-spec §8.
const PARTIAL_MASK_FIELDS = new Set([
  'documentNumber',
  'cedula',
  'rnc',
  'passport',
  'nationalId',
])

const GLOBALLY_BLOCKED = new Set([
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'idToken',
  'apiKey',
  'secret',
  'privateKey',
  'creditCard',
  'cardNumber',
  'cvv',
  'cvv2',
])

function maskPartial(value: unknown): string {
  if (typeof value !== 'string') return '[REDACTED]'
  if (value.length <= 4) return '[REDACTED]'
  return `**** ${value.slice(-4)}`
}

export function redactForAudit(
  entityType: string,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const entityRules = FIELD_REDACT_RULES[entityType] ?? new Set<string>()
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(payload)) {
    const lowerKey = key.toLowerCase()
    if (GLOBALLY_BLOCKED.has(key) || GLOBALLY_BLOCKED.has(lowerKey)) {
      result[key] = '[REDACTED]'
      continue
    }
    if (entityRules.has(key)) {
      // Partial mask for document IDs (show last 4); full redaction otherwise.
      result[key] = PARTIAL_MASK_FIELDS.has(key) ? maskPartial(value) : '[REDACTED]'
      continue
    }
    result[key] = value
  }

  return result
}

export function redactChangesForAudit(
  entityType: string,
  changes: Record<string, { before: unknown; after: unknown }>,
): Record<string, { before: unknown; after: unknown }> {
  const entityRules = FIELD_REDACT_RULES[entityType] ?? new Set<string>()
  const result: Record<string, { before: unknown; after: unknown }> = {}

  for (const [field, { before, after }] of Object.entries(changes)) {
    const lowerField = field.toLowerCase()
    if (GLOBALLY_BLOCKED.has(field) || GLOBALLY_BLOCKED.has(lowerField) || entityRules.has(field)) {
      result[field] = { before: '[REDACTED]', after: '[REDACTED]' }
    } else {
      result[field] = { before, after }
    }
  }

  return result
}
