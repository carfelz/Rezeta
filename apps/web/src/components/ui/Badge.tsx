import { cva, type VariantProps } from 'class-variance-authority'
import { clsx } from 'clsx'

const badgeVariants = cva(
  'inline-flex items-center gap-[5px] text-[11.5px] font-sans font-medium px-2 py-1 rounded-sm border',
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
}

export function Badge({ variant, children, showDot = true, className }: BadgeProps): JSX.Element {
  return (
    <span className={clsx(badgeVariants({ variant }), className)}>
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
