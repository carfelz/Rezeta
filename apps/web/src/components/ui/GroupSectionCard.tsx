import { forwardRef } from 'react'
import { Overline } from './Overline'
import { cn } from '@/lib/utils'

export interface GroupSectionCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** The mono uppercase overline label rendered above the bordered surface. */
  label?: string
  /** Optional title rendered inside a bordered header strip (above the body). */
  title?: React.ReactNode
  /** Optional content rendered to the right of the title in the header strip. */
  headerActions?: React.ReactNode
  /** Optional footer row (e.g. action buttons). */
  footer?: React.ReactNode
  /** Use compact vertical padding inside the card body. */
  compact?: boolean
  /** Outline tone — use `danger` for the FALTANTES panel etc. */
  tone?: 'neutral' | 'danger' | 'warning'
}

const toneBorder: Record<NonNullable<GroupSectionCardProps['tone']>, string> = {
  neutral: 'border-n-200',
  danger: 'border-danger-border',
  warning: 'border-warning-border',
}

const toneLabelTone: Record<
  NonNullable<GroupSectionCardProps['tone']>,
  'neutral' | 'danger' | 'warning'
> = {
  neutral: 'neutral',
  danger: 'danger',
  warning: 'warning',
}

/**
 * Outer container used by right-rail sections (Alertas, Pasos, Órdenes) and by
 * order-queue groups (Receta, Imagen, Lab). Renders:
 *   - an optional mono overline label
 *   - a bordered card surface
 *   - an optional header row with title + actions
 *   - the body (children)
 *   - an optional footer row
 *
 * Encapsulates the "bg-n-0 border border-n-200 rounded-md overflow-hidden"
 * surface contract so callers don't repeat it.
 */
export const GroupSectionCard = forwardRef<HTMLDivElement, GroupSectionCardProps>(
  (
    {
      className,
      label,
      title,
      headerActions,
      footer,
      compact = false,
      tone = 'neutral',
      children,
      ...props
    },
    ref,
  ) => {
    const hasHeader = title !== undefined || headerActions !== undefined
    return (
      <div ref={ref} className={cn(className)} {...props}>
        {label && (
          <Overline tone={toneLabelTone[tone]} className="mb-2">
            {label}
          </Overline>
        )}
        <div className={cn('bg-n-0 border rounded-md overflow-hidden', toneBorder[tone])}>
          {hasHeader && (
            <div className="flex items-center justify-between px-4 py-3 bg-n-25 border-b border-n-100">
              <div className="flex items-center gap-2 min-w-0">
                {typeof title === 'string' ? (
                  <span className="text-xs font-semibold text-n-800">{title}</span>
                ) : (
                  title
                )}
              </div>
              {headerActions && (
                <div className="flex items-center gap-2 shrink-0">{headerActions}</div>
              )}
            </div>
          )}
          <div className={compact ? 'px-3 py-2' : ''}>{children}</div>
          {footer && (
            <div className="px-4 py-3 border-t border-n-100 flex justify-end items-center gap-2">
              {footer}
            </div>
          )}
        </div>
      </div>
    )
  },
)

GroupSectionCard.displayName = 'GroupSectionCard'
