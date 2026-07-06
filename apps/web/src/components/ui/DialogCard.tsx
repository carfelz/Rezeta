import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Overline } from './Overline'
import { cn } from '@/lib/utils'

const dialogCardVariants = cva(['bg-n-0 border border-n-200 rounded-md max-w-full'], {
  variants: {
    width: {
      sm: 'w-[440px]',
      md: 'w-[460px]',
      lg: 'w-[520px]',
      xl: 'w-[540px]',
    },
    elevation: {
      none: '',
      raised: 'shadow-raised',
      floating: 'shadow-floating',
    },
  },
  defaultVariants: {
    width: 'md',
    elevation: 'floating',
  },
})

export interface DialogCardProps
  extends
    Omit<React.HTMLAttributes<HTMLDivElement>, 'title'>,
    VariantProps<typeof dialogCardVariants> {
  /** Mono uppercase overline label (top of the card) */
  overline: string
  /** Tone of the overline. Use `warning` for skip-step / switch-protocol, `neutral` for resume. */
  overlineTone?: 'neutral' | 'warning' | 'danger' | 'primary'
  /** Serif H2 title */
  title: React.ReactNode
  /** Optional sans description below title */
  description?: React.ReactNode
  /** Optional footer row (right-aligned by default). */
  footer?: React.ReactNode
  /** When true, footer divider is rendered. Default true. */
  footerDivider?: boolean
}

/**
 * Card-shaped dialog frame: overline + serif h2 + optional description +
 * body (children) + optional footer row.
 *
 * Used by: SkipStepDialog, ResumeBanner, gate empty state, OffProtocolNote
 * header pattern (when used in modal).
 */
export const DialogCard = forwardRef<HTMLDivElement, DialogCardProps>(
  (
    {
      className,
      width,
      elevation,
      overline,
      overlineTone = 'warning',
      title,
      description,
      footer,
      footerDivider = true,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <div ref={ref} className={cn(dialogCardVariants({ width, elevation }), className)} {...props}>
        <div className="px-5 pt-5 pb-3">
          <Overline tone={overlineTone} className="mb-2">
            {overline}
          </Overline>
          <h2 className="font-serif font-medium text-[20px] text-n-900 leading-tight tracking-[-0.005em] mb-2">
            {title}
          </h2>
          {description && <p className="text-[12.5px] text-n-500 leading-snug">{description}</p>}
        </div>
        {children !== undefined && <div className="px-5 pb-3">{children}</div>}
        {footer && (
          <div
            className={cn(
              'px-5 py-3 flex justify-end items-center gap-2',
              footerDivider && 'border-t border-n-100',
            )}
          >
            {footer}
          </div>
        )}
      </div>
    )
  },
)

DialogCard.displayName = 'DialogCard'
