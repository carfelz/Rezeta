import type { BadgeProps } from '@/components/ui'
import type { AppointmentStatus } from '@rezeta/shared'
import { formatDateLong } from '@/lib/format/dates'

export function formatDate(date: Date): string {
  // Capitalize the first letter only (proper Spanish convention: lowercase
  // weekday + month + 'de'). Tailwind's `capitalize` is wrong here because
  // it would capitalize each word, including the prepositions.
  const long = formatDateLong(date)
  return long.charAt(0).toUpperCase() + long.slice(1)
}

export function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('es-DO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

export function statusBadgeVariant(status: AppointmentStatus): BadgeProps['variant'] {
  switch (status) {
    case 'completed':
      return 'active'
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
      return 'Programada'
    case 'completed':
      return 'Completada'
    case 'cancelled':
      return 'Cancelada'
    case 'no_show':
      return 'No asistió'
  }
}
