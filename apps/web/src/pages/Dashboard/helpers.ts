import type { BadgeProps } from '@/components/ui'
import type { AppointmentStatus, AuditLogItem } from '@rezeta/shared'

export const MONTHS_ES = [
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
]

export function formatDateKicker(date: Date): string {
  const dayNum = date.getDate()
  const month = MONTHS_ES[date.getMonth()]!.slice(0, 3)
  const year = date.getFullYear()
  const hours = date.getHours()
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  const h12 = hours % 12 || 12
  return `${dayNum} ${month} ${year} · ${h12}:${minutes} ${ampm}`
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-DO', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export function minutesUntil(iso: string): number {
  return Math.round((new Date(iso).getTime() - Date.now()) / 60000)
}

export function statusBadgeVariant(status: AppointmentStatus): BadgeProps['variant'] {
  switch (status) {
    case 'completed':
      return 'active'
    case 'in_progress':
      return 'signed'
    case 'cancelled':
      return 'archived'
    case 'no_show':
      return 'review'
    default:
      return 'draft'
  }
}

export function statusLabel(status: AppointmentStatus): string {
  switch (status) {
    case 'scheduled':
      return 'Confirmada'
    case 'in_progress':
      return 'En consulta'
    case 'completed':
      return 'Completada'
    case 'cancelled':
      return 'Cancelada'
    case 'no_show':
      return 'No asistió'
  }
}

export function initialsForActor(fullName: string | null): string {
  if (!fullName) return '?'
  return fullName
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
}

function friendlyEntity(t: string): string {
  const map: Record<string, string> = {
    Consultation: 'una consulta',
    Patient: 'un paciente',
    Protocol: 'un protocolo',
    ProtocolVersion: 'una versión de protocolo',
    Prescription: 'una prescripción',
    Appointment: 'una cita',
    Invoice: 'una factura',
    Location: 'una ubicación',
    ProtocolType: 'un tipo de protocolo',
    ProtocolTemplate: 'una plantilla',
  }
  return map[t] ?? `un registro (${t})`
}

export interface AuditEntryDescription {
  /** Actor display name — user-controlled, must be rendered as a text node. */
  actor: string
  /** Descriptive suffix (leading space included) built from safe enum values. */
  detail: string
}

/**
 * Splits an audit entry into an actor name and a descriptive suffix so the
 * consumer can render them as React text nodes. Returning an HTML string here
 * (and rendering via dangerouslySetInnerHTML) would be a stored-XSS sink,
 * because `actor` comes from the user-controlled `fullName`.
 */
export function describeAuditEntry(entry: AuditLogItem): AuditEntryDescription {
  const actor = entry.actor?.fullName ?? 'Sistema'
  const entityType = entry.entityType ?? 'registro'
  const action = entry.action.toLowerCase()
  if (action.includes('create')) return { actor, detail: ` creó ${friendlyEntity(entityType)}` }
  if (action.includes('update'))
    return { actor, detail: ` actualizó ${friendlyEntity(entityType)}` }
  if (action.includes('delete'))
    return { actor, detail: ` eliminó ${friendlyEntity(entityType)}` }
  if (action.includes('sign')) return { actor, detail: ` firmó ${friendlyEntity(entityType)}` }
  if (action.includes('login') || action.includes('signin'))
    return { actor, detail: ' inició sesión' }
  return { actor, detail: ` ${entry.action} (${entityType})` }
}

export function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'hace un momento'
  if (mins < 60) return `hace ${mins} minuto${mins !== 1 ? 's' : ''}`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `hace ${hrs} hora${hrs !== 1 ? 's' : ''}`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `hace ${days} día${days !== 1 ? 's' : ''}`
  return new Date(iso).toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })
}

export function statusToBadgeVariant(status: string): BadgeProps['variant'] {
  if (status === 'active') return 'active'
  if (status === 'archived') return 'archived'
  if (status === 'review') return 'review'
  return 'draft'
}

export function labelForProtocolStatus(status: string): string {
  const map: Record<string, string> = {
    active: 'Activo',
    draft: 'Borrador',
    archived: 'Archivado',
    review: 'En revisión',
  }
  return map[status] ?? status
}
