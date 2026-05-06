import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const cardVariants = cva(
  [
    'relative w-full text-left bg-n-0 transition-colors',
    'focus-visible:outline-none focus-visible:shadow-focus',
    'disabled:opacity-50 disabled:cursor-not-allowed',
  ],
  {
    variants: {
      density: {
        compact: 'flex items-center gap-3 px-3 py-2 rounded',
        standard: 'flex items-start gap-3 px-4 py-3 rounded',
        large: 'flex items-start gap-3 px-4 py-4 rounded-md',
      },
      state: {
        default: 'border border-n-200 hover:border-n-400 hover:bg-n-25',
        selected: 'border border-p-500 bg-p-50',
        primary: 'border-2 border-p-500 hover:bg-p-50',
      },
    },
    defaultVariants: {
      density: 'standard',
      state: 'default',
    },
  },
)

export interface SelectableCardProps
  extends
    Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'>,
    VariantProps<typeof cardVariants> {}

/**
 * Clickable card with default/selected/primary visual states.
 * Used wherever the design has a "card" affordance instead of a button —
 * recent-protocol cards on the gate, specialty buckets, switch-protocol list,
 * search results.
 */
export const SelectableCard = forwardRef<HTMLButtonElement, SelectableCardProps>(
  ({ className, density, state, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(cardVariants({ density, state }), className)}
        {...props}
      />
    )
  },
)

SelectableCard.displayName = 'SelectableCard'
