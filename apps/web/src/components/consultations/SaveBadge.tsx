import { cn } from '@/lib/utils'

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

function formatElapsed(savedAt: Date): string {
  const secs = Math.floor((Date.now() - savedAt.getTime()) / 1000)
  if (secs < 60) return `hace ${secs}s`
  const mins = Math.floor(secs / 60)
  return `hace ${mins} min`
}

export function SaveBadge({
  status,
  savedAt,
  onRetry,
}: {
  status: SaveStatus
  savedAt?: Date
  onRetry?: () => void
}): JSX.Element | null {
  if (status === 'idle') return null
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 text-[11.5px] font-mono px-3 py-1 rounded border',
        (status === 'dirty' || status === 'saving') && 'bg-n-50 border-n-200 text-n-500',
        status === 'saved' && 'bg-success-bg border-success-border text-success-text',
        status === 'error' && 'bg-danger-bg border-danger-border text-danger-text',
      )}
    >
      {status === 'dirty' && (
        <>
          <span className="w-2 h-2 rounded-full bg-n-400 inline-block" />
          Sin guardar
        </>
      )}
      {status === 'saving' && (
        <>
          <i className="ph ph-spinner animate-spin text-[11px]" />
          Guardando…
        </>
      )}
      {status === 'saved' && (
        <>
          <i className="ph ph-check text-[11px]" />
          Guardado{savedAt ? ` · ${formatElapsed(savedAt)}` : ''}
        </>
      )}
      {status === 'error' && (
        <>
          <i className="ph ph-warning text-[11px]" />
          Error al guardar
          {onRetry && (
            <button
              onClick={onRetry}
              className="underline underline-offset-2 hover:no-underline ml-1"
            >
              · Reintentar
            </button>
          )}
        </>
      )}
    </span>
  )
}
