import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const stepCircleVariants = cva(
  [
    'inline-flex items-center justify-center rounded-full border shrink-0',
    'transition-colors',
    'focus-visible:outline-none focus-visible:shadow-focus',
    'disabled:cursor-default disabled:opacity-70',
  ],
  {
    variants: {
      status: {
        done: 'bg-p-500 border-p-500 hover:bg-p-700 text-n-0',
        active: 'bg-n-0 border-p-500 text-p-700',
        pending: 'bg-n-0 border-n-300 hover:border-p-500 text-n-400',
      },
      size: {
        sm: 'w-5 h-5 [&>i]:text-2xs [&>span]:text-2xs',
        md: 'w-6 h-6 [&>i]:text-xs [&>span]:text-2xs',
        lg: 'w-7 h-7 [&>i]:text-base [&>span]:text-overline',
      },
    },
    defaultVariants: {
      status: 'pending',
      size: 'md',
    },
  },
)

export interface StepCircleProps
  extends
    Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'>,
    VariantProps<typeof stepCircleVariants> {
  /** When given, renders the number inside the circle (only meaningful for `active`/`pending`). */
  number?: number | null
  /** Override the default visual: forces a check icon for `done`, the number for `active`, blank for `pending`. */
  showCheck?: boolean
  /** Always required for accessibility; describe the action (e.g. "Marcar como completado"). */
  'aria-label': string
}

/**
 * Round step indicator. Composes a button (so it can be toggled) with a
 * fixed visual contract:
 *   - `done`: filled teal + white check icon
 *   - `active`: hollow teal-bordered circle, optionally showing the step number
 *   - `pending`: hollow gray circle, hover hints at activation
 *
 * Pure visual — caller wires `onClick` to flip the underlying state.
 */
export const StepCircle = forwardRef<HTMLButtonElement, StepCircleProps>(
  ({ className, status, size, number, showCheck, ...props }, ref) => {
    const renderInner = (): React.ReactNode => {
      if (status === 'done' || showCheck) return <i className="ph ph-check" />
      if (status === 'active' && number != null)
        return <span className="font-mono">{String(number).padStart(2, '0')}</span>
      return null
    }
    return (
      <button
        ref={ref}
        type="button"
        className={cn(stepCircleVariants({ status, size }), className)}
        {...props}
      >
        {renderInner()}
      </button>
    )
  },
)

StepCircle.displayName = 'StepCircle'
