import { cn } from '@/lib/utils'
import { Spinner, TextLink } from '@/components/ui'
import { saveBadgeStrings } from './strings'

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

function formatElapsed(savedAt: Date): string {
  const secs = Math.floor((Date.now() - savedAt.getTime()) / 1000)
  if (secs < 60) return saveBadgeStrings.savedElapsedSecs(secs)
  const mins = Math.floor(secs / 60)
  return saveBadgeStrings.savedElapsedMins(mins)
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
        'inline-flex items-center gap-2 text-overline font-mono px-3 py-1 rounded border',
        (status === 'dirty' || status === 'saving') && 'bg-n-50 border-n-200 text-n-500',
        status === 'saved' && 'bg-success-bg border-success-border text-success-text',
        status === 'error' && 'bg-danger-bg border-danger-border text-danger-text',
      )}
    >
      {status === 'dirty' && (
        <>
          <span className="w-2 h-2 rounded-full bg-n-400 inline-block" />
          {saveBadgeStrings.unsaved}
        </>
      )}
      {status === 'saving' && (
        <>
          <Spinner size="sm" decorative />
          {saveBadgeStrings.saving}
        </>
      )}
      {status === 'saved' && (
        <>
          <i className="ph ph-check text-overline" />
          {saveBadgeStrings.saved}
          {savedAt ? ` · ${formatElapsed(savedAt)}` : ''}
        </>
      )}
      {status === 'error' && (
        <>
          <i className="ph ph-warning text-overline" />
          {saveBadgeStrings.error}
          {onRetry && (
            <TextLink
              tone="neutral"
              size="sm"
              underline="always"
              onClick={onRetry}
              className="ml-1"
            >
              · {saveBadgeStrings.retry}
            </TextLink>
          )}
        </>
      )}
    </span>
  )
}
