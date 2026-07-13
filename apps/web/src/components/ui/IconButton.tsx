import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const iconButtonVariants = cva(
  [
    'inline-flex items-center justify-center rounded-sm shrink-0',
    'transition-colors',
    'focus-visible:outline-none focus-visible:shadow-focus',
    'disabled:opacity-40 disabled:cursor-not-allowed',
  ],
  {
    variants: {
      tone: {
        // Hover transitions to neutral darker — used for non-destructive close/dismiss actions
        neutral: 'text-n-400 hover:bg-n-100 hover:text-n-700',
        // Hover transitions to danger — used for trash/remove actions
        danger: 'text-n-300 hover:bg-n-100 hover:text-danger-text',
        // Subtle muted variant — used inside cards on hover-only reveal
        muted: 'text-n-300 hover:bg-n-100 hover:text-n-700',
        // Inverse for tinted-bg contexts (warning callouts etc.)
        warning: 'text-warning-text hover:opacity-70',
      },
      size: {
        sm: 'w-6 h-6 [&>i]:text-xs',
        md: 'w-7 h-7 [&>i]:text-base',
        lg: 'w-8 h-8 [&>i]:text-body-lg',
      },
    },
    defaultVariants: {
      tone: 'neutral',
      size: 'sm',
    },
  },
)

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof iconButtonVariants> {
  /** Phosphor icon class name (e.g. `ph ph-x`). Required for accessibility — use `aria-label` to describe the action. */
  icon: string
  /** Always required for icon-only buttons (a11y). */
  'aria-label': string
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, tone, size, icon, type = 'button', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(iconButtonVariants({ tone, size }), className)}
        {...props}
      >
        <i className={icon} />
      </button>
    )
  },
)

IconButton.displayName = 'IconButton'
