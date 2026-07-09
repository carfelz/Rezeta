/**
 * Canonical set of audit-log `entityType` values, shared by the audit log
 * table/drawer (`pages/settings/AuditLog.tsx`) and the dashboard activity
 * feed (`pages/Dashboard/helpers.ts`). Each surface renders its own Spanish
 * phrasing — formal noun labels here vs. lowercase "un/una X" article
 * phrasing in the feed sentences — but both must cover exactly the same
 * keys. Typing both label maps as `Record<AuditEntityKey, string>` makes a
 * missing/extra key a compile error instead of silent drift.
 */
export const AUDIT_ENTITY_KEYS = [
  'Consultation',
  'Patient',
  'Protocol',
  'ProtocolVersion',
  'ProtocolTemplate',
  'ProtocolType',
  'ProtocolCategory',
  'Prescription',
  'Appointment',
  'Invoice',
  'Location',
  'Schedule',
  'User',
  'Onboarding',
  'Log',
  'ConsultationRecord',
  // Kebab-case leftovers produced by the interceptor before the entity-type
  // fix landed — historical audit rows already contain these values.
  'Protocol-template',
  'Protocol-categorie',
  'Onboardin',
] as const

export type AuditEntityKey = (typeof AUDIT_ENTITY_KEYS)[number]

/** Formal Spanish noun labels — used in the audit log table and detail drawer. */
export const AUDIT_ENTITY_LABELS_FORMAL: Record<AuditEntityKey, string> = {
  Consultation: 'Consulta',
  Patient: 'Paciente',
  Protocol: 'Protocolo',
  ProtocolVersion: 'Versión de protocolo',
  ProtocolTemplate: 'Plantilla',
  ProtocolType: 'Tipo de protocolo',
  ProtocolCategory: 'Categoría de protocolo',
  Prescription: 'Prescripción',
  Appointment: 'Cita',
  Invoice: 'Factura',
  Location: 'Ubicación',
  Schedule: 'Horario',
  User: 'Usuario',
  Onboarding: 'Configuración inicial',
  Log: 'Registro técnico',
  ConsultationRecord: 'Historia médica',
  'Protocol-template': 'Plantilla',
  'Protocol-categorie': 'Categoría de protocolo',
  Onboardin: 'Configuración inicial',
}

/** Lowercase "un/una X" article phrasing — used in dashboard activity feed sentences. */
export const AUDIT_ENTITY_LABELS_ARTICLE: Record<AuditEntityKey, string> = {
  Consultation: 'una consulta',
  Patient: 'un paciente',
  Protocol: 'un protocolo',
  ProtocolVersion: 'una versión de protocolo',
  ProtocolTemplate: 'una plantilla',
  ProtocolType: 'un tipo de protocolo',
  ProtocolCategory: 'una categoría de protocolo',
  Prescription: 'una prescripción',
  Appointment: 'una cita',
  Invoice: 'una factura',
  Location: 'una ubicación',
  Schedule: 'un horario',
  User: 'un usuario',
  Onboarding: 'la configuración inicial',
  Log: 'un registro técnico',
  ConsultationRecord: 'una historia médica',
  'Protocol-template': 'una plantilla',
  'Protocol-categorie': 'una categoría de protocolo',
  Onboardin: 'la configuración inicial',
}
