import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const stackVariants = cva(['flex flex-col'], {
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
    },
    justify: {
      start: 'justify-start',
      center: 'justify-center',
      end: 'justify-end',
      between: 'justify-between',
    },
  },
  defaultVariants: {
    gap: 3,
    align: 'stretch',
  },
})

export interface StackProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof stackVariants> {
  as?: keyof JSX.IntrinsicElements
}

/**
 * Vertical flex container with consistent spacing. Replaces ad-hoc
 * `flex flex-col gap-N` declarations across the app.
 */
export const Stack = forwardRef<HTMLDivElement, StackProps>(
  ({ className, gap, align, justify, as: Comp = 'div', ...props }, ref) => {
    const Element = Comp as 'div'
    return (
      <Element
        ref={ref}
        className={cn(stackVariants({ gap, align, justify }), className)}
        {...props}
      />
    )
  },
)

Stack.displayName = 'Stack'
