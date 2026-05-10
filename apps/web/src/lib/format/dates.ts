/**
 * Centralized Spanish (es-DO) date formatting.
 *
 * All user-facing date strings should come from one of the helpers here.
 * Replaces inline ad-hoc formatters scattered across pages.
 */

const DAYS_LOWER = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
] as const

const MONTHS_LONG = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const

const MONTHS_SHORT = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
] as const

function ampm(hours: number, minutes: number): string {
  const isPm = hours >= 12
  const h = hours % 12 || 12
  return `${h}:${minutes.toString().padStart(2, '0')} ${isPm ? 'P.M.' : 'A.M.'}`
}

/**
 * Lowercase long form, used in modals and titles. Example:
 *   "jueves, 7 de mayo de 2026"
 */
export function formatDateLong(date: Date): string {
  // Date.getDay() ∈ [0..6] and Date.getMonth() ∈ [0..11], so the lookups are
  // always defined — the non-null assertion documents that invariant.
  const day = DAYS_LOWER[date.getDay()]!
  const month = MONTHS_LONG[date.getMonth()]!
  return `${day}, ${date.getDate()} de ${month} de ${date.getFullYear()}`
}

/**
 * Short form for breadcrumbs and table rows. Example:
 *   "7 may de 2026"
 */
export function formatBreadcrumbDate(date: Date): string {
  const month = MONTHS_SHORT[date.getMonth()]!
  return `${date.getDate()} ${month} de ${date.getFullYear()}`
}

/**
 * Uppercase mono-style overline for the consultation header. Example:
 *   "JUEVES, 7 DE MAYO DE 2026 · 02:40 A.M. · CONSULTORIO PRIVADO"
 */
export function formatConsultationOverline(date: Date, locationName: string): string {
  const day = DAYS_LOWER[date.getDay()]!.toUpperCase()
  const month = MONTHS_LONG[date.getMonth()]!.toUpperCase()
  const time = ampm(date.getHours(), date.getMinutes())
  const base = `${day}, ${date.getDate()} DE ${month} DE ${date.getFullYear()} · ${time}`
  return locationName ? `${base} · ${locationName.toUpperCase()}` : base
}

/**
 * Time only, AM/PM. Example: "9:30 AM"
 */
export function formatTimeShort(date: Date): string {
  return ampm(date.getHours(), date.getMinutes())
}

/**
 * Numeric-only form for exports and prescription printouts. Example:
 *   "07/05/2026"
 */
export function formatDateNumeric(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  return `${day}/${month}/${date.getFullYear()}`
}
