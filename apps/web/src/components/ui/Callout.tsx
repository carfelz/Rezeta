import { cva, type VariantProps } from 'class-variance-authority'
import { clsx } from 'clsx'
import type { ReactNode } from 'react'

const calloutVariants = cva(
  'flex gap-3 p-[14px_16px] rounded border text-[13px] font-sans leading-[1.45]',
  {
    variants: {
      variant: {
        success: 'bg-success-bg border-success-border text-success-text',
        warning: 'bg-warning-bg border-warning-border text-warning-text',
        danger: 'bg-danger-bg border-danger-border text-danger-text',
        info: 'bg-info-bg border-info-border text-info-text',
      },
    },
    defaultVariants: {
      variant: 'info',
    },
  },
)

export interface CalloutProps extends VariantProps<typeof calloutVariants> {
  icon?: ReactNode
  title?: string
  children: ReactNode
  className?: string
}

export function Callout({ variant, icon, title, children, className }: CalloutProps) {
  return (
    <div className={clsx(calloutVariants({ variant }), className)}>
      {icon && (
        <span className="text-[18px] shrink-0 leading-none mt-[1px]">{icon}</span>
      )}
      <div className="flex-1 min-w-0">
        {title && (
          <div className="font-semibold mb-0.5">{title}</div>
        )}
        {children}
      </div>
    </div>
  )
}
