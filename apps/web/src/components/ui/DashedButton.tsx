import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const dashedButtonVariants = cva(
  [
    'flex items-center justify-center gap-2 w-full',
    'font-sans border border-dashed rounded-sm',
    'transition-colors',
    'focus-visible:outline-none focus-visible:shadow-focus',
    'disabled:opacity-50 disabled:cursor-not-allowed',
  ],
  {
    variants: {
      tone: {
        neutral: 'border-n-300 text-n-500 hover:border-n-400 hover:text-n-800 hover:bg-n-25',
        subtle: 'border-n-100 text-n-400 hover:border-n-200 hover:text-n-700 bg-transparent',
        warning:
          'border-n-300 text-n-600 hover:border-warning-border hover:text-warning-text hover:bg-warning-bg',
      },
      size: {
        sm: 'py-2 text-xs',
        md: 'py-3 text-xs',
      },
    },
    defaultVariants: {
      tone: 'neutral',
      size: 'md',
    },
  },
)

export interface DashedButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof dashedButtonVariants> {}

/**
 * Dashed-border CTA button. Used for "+ Add" affordances:
 *   - "+ Añadir grupo de receta" / "+ Añadir grupo de imagen" in OrderQueuePanel
 *   - "Añadir nota fuera de protocolo" trigger
 *   - Empty-state CTAs
 */
export const DashedButton = forwardRef<HTMLButtonElement, DashedButtonProps>(
  ({ className, tone, size, type = 'button', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(dashedButtonVariants({ tone, size }), className)}
        {...props}
      />
    )
  },
)

DashedButton.displayName = 'DashedButton'
