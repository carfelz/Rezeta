/**
 * Protocol status labels and helpers.
 *
 * Single source of truth for every surface that renders a protocol status string.
 */

export const PROTOCOL_STATUS_LABELS: Record<'active' | 'draft' | 'archived', string> = {
  active: 'activo',
  draft: 'borrador',
  archived: 'archivado',
}

export function protocolStatusLabel(status: string): string {
  if (status === 'active' || status === 'draft' || status === 'archived') {
    return PROTOCOL_STATUS_LABELS[status]
  }
  return status
}
