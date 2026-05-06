import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

export interface BreadcrumbItem {
  label: string
  to?: string
}

export interface ConsultHeaderProps {
  breadcrumbs: BreadcrumbItem[]
  datetimeOverline: string
  title: string
  subtitle?: string
  rightSlot?: ReactNode
}

export function ConsultHeader({
  breadcrumbs,
  datetimeOverline,
  title,
  subtitle,
  rightSlot,
}: ConsultHeaderProps): JSX.Element {
  return (
    <div className="flex items-end justify-between gap-6 pb-6 border-b border-n-100">
      <div className="min-w-0 flex-1">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-[12px] text-n-500 mb-2">
          {breadcrumbs.map((b, i) => {
            const isLast = i === breadcrumbs.length - 1
            return (
              <span key={`${b.label}-${i}`} className="flex items-center gap-2">
                {b.to && !isLast ? (
                  <Link to={b.to} className="hover:text-n-800 transition-colors">
                    {b.label}
                  </Link>
                ) : (
                  <span className={isLast ? 'text-n-800 font-medium' : ''}>{b.label}</span>
                )}
                {!isLast && <i className="ph ph-caret-right text-[10px] text-n-300" />}
              </span>
            )
          })}
        </div>

        {/* Datetime overline */}
        <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-n-400 mb-2">
          {datetimeOverline}
        </div>

        {/* Serif H1 */}
        <h1 className="font-serif font-medium text-[34px] text-n-900 leading-tight tracking-[-0.015em] mb-1">
          {title}
        </h1>

        {/* Subtitle */}
        {subtitle && <p className="text-[13.5px] text-n-500">{subtitle}</p>}
      </div>

      {rightSlot && <div className="shrink-0 flex items-center gap-2">{rightSlot}</div>}
    </div>
  )
}
