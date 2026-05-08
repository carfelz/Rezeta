import { cn } from '@/lib/utils'

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved'

export function SaveBadge({ status }: { status: SaveStatus }): JSX.Element | null {
  if (status === 'idle') return null
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 text-[11.5px] font-mono px-3 py-1 rounded border',
        status === 'dirty' && 'bg-n-50 border-n-200 text-n-500',
        status === 'saving' && 'bg-n-50 border-n-200 text-n-500',
        status === 'saved' && 'bg-success-bg border-success-border text-success-text',
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
          Guardado
        </>
      )}
    </span>
  )
}
