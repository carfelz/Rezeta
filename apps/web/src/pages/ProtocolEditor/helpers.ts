import type { BadgeProps } from '@/components/ui'
import type { ProtocolBlock } from '@/components/protocols/BlockRenderer'

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

export function formatRelativeTime(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  if (diffMins < 2) return 'hace un momento'
  if (diffMins < 60) return `hace ${diffMins} min`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `hace ${diffHours} h`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'ayer'
  return `hace ${diffDays} días`
}

export function countBlockStats(blocks: ProtocolBlock[]): { total: number; sections: number } {
  let total = 0
  let sections = 0
  for (const block of blocks) {
    if (block.type === 'section') {
      sections++
      const inner = countBlockStats(block.blocks)
      total += inner.total
    } else {
      total++
    }
  }
  return { total, sections }
}
