import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const radioCardVariants = cva(
  [
    'flex items-center gap-3 w-full text-left transition-colors',
    'focus-visible:outline-none focus-visible:shadow-focus',
    'disabled:opacity-50 disabled:cursor-not-allowed',
  ],
  {
    variants: {
      density: {
        compact: 'px-3 py-2 rounded',
        standard: 'px-3 py-3 rounded',
      },
      state: {
        default: 'border border-n-200 bg-n-0 hover:bg-n-25',
        selected: 'border border-p-500 bg-p-50',
      },
    },
    defaultVariants: {
      density: 'standard',
      state: 'default',
    },
  },
)

export interface RadioCardProps
  extends
    Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'>,
    VariantProps<typeof radioCardVariants> {
  selected: boolean
}

/**
 * Radio-button-styled selectable row. Used for dialog reasons (SkipStepDialog),
 * single-choice settings, etc. Composes a left-aligned filled-dot indicator
 * + arbitrary content.
 */
export const RadioCard = forwardRef<HTMLButtonElement, RadioCardProps>(
  ({ className, density, state, selected, children, ...props }, ref) => {
    const finalState = state ?? (selected ? 'selected' : 'default')
    return (
      <button
        ref={ref}
        type="button"
        role="radio"
        aria-checked={selected}
        className={cn(radioCardVariants({ density, state: finalState }), className)}
        {...props}
      >
        <span
          className={cn(
            'w-4 h-4 rounded-full border flex items-center justify-center shrink-0',
            selected ? 'border-p-500' : 'border-n-300',
          )}
        >
          {selected && <span className="w-2 h-2 rounded-full bg-p-500" />}
        </span>
        {children}
      </button>
    )
  },
)

RadioCard.displayName = 'RadioCard'
