import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

const calloutVariants = cva('flex rounded border font-sans', {
  variants: {
    variant: {
      success: 'bg-success-bg border-success-border text-success-text',
      warning: 'bg-warning-bg border-warning-border text-warning-text',
      danger: 'bg-danger-bg border-danger-border text-danger-text',
      info: 'bg-info-bg border-info-border text-info-text',
    },
    // Standard = full callout box (icon left, optional title, body).
    // Compact = chip-like row, single line, used for inline alerts in right rails.
    density: {
      standard: 'gap-3 py-3.5 px-4 text-sm leading-prose-snug',
      compact: 'gap-2 px-3 py-2 text-xs items-center',
    },
  },
  defaultVariants: {
    variant: 'info',
    density: 'standard',
  },
})

export interface CalloutProps extends VariantProps<typeof calloutVariants> {
  /**
   * Either a Phosphor icon class name (string, e.g. `ph ph-warning-circle`)
   * or any ReactNode. Strings render as `<i>` inside a sized wrapper.
   */
  icon?: ReactNode
  title?: string
  children: ReactNode
  className?: string
  /** Alias for `density="compact"` — convenience prop. */
  compact?: boolean
  /** Tone alias for `variant` — convenience prop matching naming used in newer components. */
  tone?: 'success' | 'warning' | 'danger' | 'info'
}

export function Callout({
  variant,
  density,
  icon,
  title,
  children,
  className,
  compact,
  tone,
}: CalloutProps): JSX.Element {
  const finalVariant = variant ?? tone ?? 'info'
  const finalDensity = density ?? (compact ? 'compact' : 'standard')
  const iconSize = finalDensity === 'compact' ? 'text-sm' : 'text-h3'
  return (
    <div
      className={cn(calloutVariants({ variant: finalVariant, density: finalDensity }), className)}
    >
      {icon && (
        <span className={cn('shrink-0 leading-none mt-px', iconSize)}>
          {typeof icon === 'string' ? <i className={icon} /> : icon}
        </span>
      )}
      <div className="flex-1 min-w-0">
        {title && <div className="font-semibold mb-1">{title}</div>}
        {children}
      </div>
    </div>
  )
}
