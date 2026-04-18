import { clsx } from 'clsx'
import type { ReactNode } from 'react'

export interface EmptyStateProps {
  icon: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={clsx(
        'flex flex-col items-center text-center',
        'bg-n-0 border border-dashed border-n-200 rounded',
        'px-8 py-12',
        className,
      )}
    >
      <div className="flex items-center justify-center w-14 h-14 rounded-full bg-n-50 text-n-500 text-[24px] mb-5">
        {icon}
      </div>
      <h3 className="text-[20px] font-serif font-medium text-n-800 leading-snug mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-[13px] font-sans text-n-500 max-w-[42ch] leading-relaxed mb-6">
          {description}
        </p>
      )}
      {action && !description && <div className="mt-5">{action}</div>}
      {action && description && action}
    </div>
  )
}
