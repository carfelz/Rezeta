import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const rowVariants = cva(['flex flex-row'], {
  variants: {
    gap: {
      0: 'gap-0',
      px: 'gap-px',
      1: 'gap-1',
      2: 'gap-2',
      3: 'gap-3',
      4: 'gap-4',
      5: 'gap-5',
      6: 'gap-6',
      8: 'gap-8',
      10: 'gap-10',
      12: 'gap-12',
    },
    align: {
      start: 'items-start',
      center: 'items-center',
      end: 'items-end',
      stretch: 'items-stretch',
      baseline: 'items-baseline',
    },
    justify: {
      start: 'justify-start',
      center: 'justify-center',
      end: 'justify-end',
      between: 'justify-between',
      around: 'justify-around',
    },
    wrap: {
      true: 'flex-wrap',
      false: 'flex-nowrap',
    },
  },
  defaultVariants: {
    gap: 2,
    align: 'center',
    wrap: false,
  },
})

export interface RowProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof rowVariants> {
  as?: keyof JSX.IntrinsicElements
}

/**
 * Horizontal flex container with consistent spacing.
 */
export const Row = forwardRef<HTMLDivElement, RowProps>(
  ({ className, gap, align, justify, wrap, as: Comp = 'div', ...props }, ref) => {
    const Element = Comp as 'div'
    return (
      <Element
        ref={ref}
        className={cn(rowVariants({ gap, align, justify, wrap }), className)}
        {...props}
      />
    )
  },
)

Row.displayName = 'Row'
