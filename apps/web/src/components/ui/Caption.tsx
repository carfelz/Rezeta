import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const captionVariants = cva(['font-sans'], {
  variants: {
    tone: {
      neutral: 'text-n-500',
      muted: 'text-n-400',
      strong: 'text-n-700',
      primary: 'text-p-700',
      warning: 'text-warning-text',
      danger: 'text-danger-text',
      success: 'text-success-text',
    },
    size: {
      xs: 'text-[11px]',
      sm: 'text-[11.5px]',
      md: 'text-[12px]',
      lg: 'text-[12.5px]',
    },
    weight: {
      regular: 'font-regular',
      medium: 'font-medium',
      semibold: 'font-semibold',
    },
  },
  defaultVariants: {
    tone: 'neutral',
    size: 'md',
    weight: 'regular',
  },
})

export interface CaptionProps
  extends React.HTMLAttributes<HTMLElement>, VariantProps<typeof captionVariants> {
  as?: 'span' | 'div' | 'p'
}

/**
 * Small sentence-case secondary text. Used for subtitles, section labels,
 * helper text, mini-captions next to step titles, last-edit timestamps.
 *
 * For UPPERCASE mono labels, use `<Overline>` instead.
 */
export const Caption = forwardRef<HTMLElement, CaptionProps>(
  ({ className, tone, size, weight, as = 'span', ...props }, ref) => {
    const Comp = as
    return (
      <Comp
        ref={ref as never}
        className={cn(captionVariants({ tone, size, weight }), className)}
        {...props}
      />
    )
  },
)

Caption.displayName = 'Caption'
