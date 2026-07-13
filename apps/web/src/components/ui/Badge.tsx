import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-[5px] text-overline font-sans font-medium px-2 py-1 rounded-sm border',
  {
    variants: {
      variant: {
        draft: 'bg-n-50 border-n-200 text-n-600',
        active: 'bg-success-bg border-success-border text-success-text',
        signed: 'bg-p-50 border-p-100 text-p-700',
        review: 'bg-warning-bg border-warning-border text-warning-text',
        archived: 'bg-n-50 border-n-200 text-n-500',
        paid: 'bg-success-bg border-success-border text-success-text',
        overdue: 'bg-danger-bg border-danger-border text-danger-text',
      },
    },
    defaultVariants: {
      variant: 'draft',
    },
  },
)

export interface BadgeProps extends VariantProps<typeof badgeVariants> {
  children: React.ReactNode
  showDot?: boolean
  className?: string
  /**
   * Inline style override for data-driven colors that have no semantic variant —
   * e.g. a protocol category's user-chosen color. The dot inherits `currentColor`,
   * so set `color` to tint both text and dot.
   */
  style?: React.CSSProperties
}

export function Badge({
  variant,
  children,
  showDot = true,
  className,
  style,
}: BadgeProps): JSX.Element {
  return (
    <span className={cn(badgeVariants({ variant }), className)} style={style}>
      {showDot && (
        <span
          className="inline-block w-[6px] h-[6px] rounded-full shrink-0"
          style={{ background: 'currentColor' }}
        />
      )}
      {children}
    </span>
  )
}
