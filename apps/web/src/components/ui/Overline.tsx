import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const overlineVariants = cva(['font-mono'], {
  variants: {
    tone: {
      neutral: 'text-n-400',
      muted: 'text-n-500',
      primary: 'text-p-700',
      warning: 'text-warning-text',
      danger: 'text-danger-text',
      success: 'text-success-text',
    },
    size: {
      xs: 'text-2xs tracking-label',
      sm: 'text-2xs tracking-widest',
      md: 'text-2xs tracking-caps',
      lg: 'text-overline tracking-caps',
    },
    weight: {
      regular: 'font-regular',
      medium: 'font-medium',
      semibold: 'font-semibold',
    },
    case: {
      upper: 'uppercase',
      normal: 'normal-case',
    },
  },
  defaultVariants: {
    tone: 'neutral',
    size: 'md',
    weight: 'medium',
    case: 'upper',
  },
})

export interface OverlineProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof overlineVariants> {
  as?: 'span' | 'div' | 'p'
}

export const Overline = forwardRef<HTMLSpanElement, OverlineProps>(
  ({ className, tone, size, weight, case: textCase, as = 'div', ...props }, ref) => {
    const Comp = as
    return (
      <Comp
        ref={ref as never}
        className={cn(overlineVariants({ tone, size, weight, case: textCase }), className)}
        {...props}
      />
    )
  },
)

Overline.displayName = 'Overline'
