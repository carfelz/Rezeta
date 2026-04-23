export const ErrorCode = {
  // ── Auth ────────────────────────────────────────────────────
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',

  // ── Tenant ──────────────────────────────────────────────────
  TENANT_NOT_FOUND: 'TENANT_NOT_FOUND',

  // ── User ────────────────────────────────────────────────────
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
  USER_NOT_PROVISIONED: 'USER_NOT_PROVISIONED', // valid Firebase token but no DB user yet

  // ── Location ────────────────────────────────────────────────
  LOCATION_NOT_FOUND: 'LOCATION_NOT_FOUND',

  // ── Patient ─────────────────────────────────────────────────
  PATIENT_NOT_FOUND: 'PATIENT_NOT_FOUND',

  // ── Appointment ─────────────────────────────────────────────
  APPOINTMENT_NOT_FOUND: 'APPOINTMENT_NOT_FOUND',
  APPOINTMENT_CONFLICT: 'APPOINTMENT_CONFLICT',
  APPOINTMENT_ALREADY_CANCELLED: 'APPOINTMENT_ALREADY_CANCELLED',

  // ── Consultation ────────────────────────────────────────────
  CONSULTATION_NOT_FOUND: 'CONSULTATION_NOT_FOUND',
  CONSULTATION_ALREADY_SIGNED: 'CONSULTATION_ALREADY_SIGNED',
  CONSULTATION_NOT_SIGNED: 'CONSULTATION_NOT_SIGNED',

  // ── Prescription ────────────────────────────────────────────
  PRESCRIPTION_NOT_FOUND: 'PRESCRIPTION_NOT_FOUND',
  PRESCRIPTION_ALREADY_SIGNED: 'PRESCRIPTION_ALREADY_SIGNED',

  // ── Invoice ─────────────────────────────────────────────────
  INVOICE_NOT_FOUND: 'INVOICE_NOT_FOUND',
  INVOICE_ALREADY_ISSUED: 'INVOICE_ALREADY_ISSUED',

  // ── Protocol Template ───────────────────────────────────────
  PROTOCOL_TEMPLATE_NOT_FOUND: 'PROTOCOL_TEMPLATE_NOT_FOUND',
  PROTOCOL_TEMPLATE_LOCKED: 'PROTOCOL_TEMPLATE_LOCKED',
  PROTOCOL_TEMPLATE_NAME_CONFLICT: 'PROTOCOL_TEMPLATE_NAME_CONFLICT',

  // ── Protocol Type ───────────────────────────────────────────
  PROTOCOL_TYPE_NOT_FOUND: 'PROTOCOL_TYPE_NOT_FOUND',
  PROTOCOL_TYPE_LOCKED: 'PROTOCOL_TYPE_LOCKED',
  PROTOCOL_TYPE_NAME_CONFLICT: 'PROTOCOL_TYPE_NAME_CONFLICT',
  PROTOCOL_TYPE_TEMPLATE_IMMUTABLE: 'PROTOCOL_TYPE_TEMPLATE_IMMUTABLE',

  // ── Protocol ────────────────────────────────────────────────
  PROTOCOL_NOT_FOUND: 'PROTOCOL_NOT_FOUND',
  PROTOCOL_REQUIRED_BLOCK_MISSING: 'PROTOCOL_REQUIRED_BLOCK_MISSING',
  PROTOCOL_LOCKED_BLOCK_MODIFIED: 'PROTOCOL_LOCKED_BLOCK_MODIFIED',

  // ── Onboarding ──────────────────────────────────────────────
  TENANT_ALREADY_SEEDED: 'TENANT_ALREADY_SEEDED',
  ONBOARDING_ALREADY_COMPLETE: 'ONBOARDING_ALREADY_COMPLETE',
  NO_TYPES_AVAILABLE: 'NO_TYPES_AVAILABLE',

  // ── Validation ──────────────────────────────────────────────
  VALIDATION_ERROR: 'VALIDATION_ERROR',

  // ── Generic ─────────────────────────────────────────────────
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode]

export interface ApiError {
  code: ErrorCode
  message: string
  details?: Record<string, unknown>
}
