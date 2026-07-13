import { forwardRef } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

export interface BreadcrumbItem {
  label: string
  to?: string
}

export interface BreadcrumbsProps extends React.HTMLAttributes<HTMLElement> {
  items: BreadcrumbItem[]
}

/**
 * Generic breadcrumb trail. Renders intermediate items as `<Link>` and the last
 * one as plain bold text. Used by every detail/page header (ConsultHeader,
 * PatientDetail, ProtocolEditor, etc.).
 */
export const Breadcrumbs = forwardRef<HTMLElement, BreadcrumbsProps>(
  ({ className, items, ...props }, ref) => {
    return (
      <nav
        ref={ref}
        aria-label="Breadcrumb"
        className={cn('flex items-center gap-2 text-xs text-n-500', className)}
        {...props}
      >
        {items.map((b, i) => {
          const isLast = i === items.length - 1
          return (
            <span key={`${b.label}-${i}`} className="flex items-center gap-2">
              {b.to && !isLast ? (
                <Link to={b.to} className="hover:text-n-800 transition-colors">
                  {b.label}
                </Link>
              ) : (
                <span className={isLast ? 'text-n-800 font-medium' : ''}>{b.label}</span>
              )}
              {!isLast && <i className="ph ph-caret-right text-2xs text-n-300" />}
            </span>
          )
        })}
      </nav>
    )
  },
)

Breadcrumbs.displayName = 'Breadcrumbs'
