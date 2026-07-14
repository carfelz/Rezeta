import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const chipVariants = cva(['inline-flex items-center gap-1 rounded-sm border transition-colors'], {
  variants: {
    tone: {
      primary: 'bg-transparent border-p-100 text-p-700 hover:bg-p-100',
      primarySolid: 'bg-p-50 border-p-100 text-p-700',
      warning: 'bg-warning-bg border-warning-border text-warning-text',
      danger: 'bg-danger-bg border-danger-border text-danger-text',
      success: 'bg-success-bg border-success-border text-success-text',
      neutral: 'bg-n-50 border-n-200 text-n-600',
    },
    size: {
      xs: 'text-2xs tracking-label px-2 py-px',
      sm: 'text-2xs tracking-widest px-2 py-px',
      md: 'text-overline tracking-label px-2 py-1',
    },
    // mono+upper = canonical "EN CURSO" / "MÁS PROBABLE" pill
    // sans+normal = small ghost button like "Ver pasos"
    format: {
      uppercase: 'font-mono uppercase',
      sentence: 'font-sans normal-case',
    },
    interactive: {
      true: 'cursor-pointer',
      false: '',
    },
  },
  defaultVariants: {
    tone: 'primary',
    size: 'sm',
    format: 'uppercase',
    interactive: false,
  },
})

export interface ChipProps
  extends
    Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'>,
    VariantProps<typeof chipVariants> {
  children: React.ReactNode
  /** Render as a button. */
  asButton?: boolean
}

/**
 * Tiny mono-text chip used for inline status / pill-button affordances.
 * Examples: "EN CURSO", "MÁS PROBABLE", "REQUERIDO", "FUERA DE PROTOCOLO",
 * the "Ver pasos" pill on the protocol strip.
 *
 * For full Badge-style status indicators (with dots, full-text labels, etc.),
 * prefer `<Badge>`.
 */
export const Chip = forwardRef<HTMLElement, ChipProps>(
  ({ className, tone, size, format, interactive, asButton, children, ...props }, ref) => {
    if (asButton) {
      return (
        <button
          ref={ref as never}
          type="button"
          className={cn(chipVariants({ tone, size, format, interactive: true }), className)}
          {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
        >
          {children}
        </button>
      )
    }
    return (
      <span
        ref={ref as never}
        className={cn(chipVariants({ tone, size, format, interactive }), className)}
        {...props}
      >
        {children}
      </span>
    )
  },
)

Chip.displayName = 'Chip'
