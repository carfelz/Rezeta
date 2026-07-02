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
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function toTimeInputValue(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function nextSlotAfter(reference: Date, intervalMin: number): string {
  const total = reference.getHours() * 60 + reference.getMinutes()
  const next = Math.ceil((total + 1) / intervalMin) * intervalMin
  const clamped = Math.min(next, 23 * 60 + 45)
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`
}

export function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map((n) => parseInt(n, 10))
  const total = (h ?? 0) * 60 + (m ?? 0) + minutes
  const clamped = Math.min(Math.max(total, 0), 24 * 60 - 1)
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`
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
    case 'in_progress':
      return 'signed'
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
