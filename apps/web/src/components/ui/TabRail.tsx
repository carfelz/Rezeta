import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const railVariants = cva(['flex items-stretch gap-0 border-b border-n-100'], {
  variants: {
    background: {
      neutral: 'bg-n-25',
      transparent: 'bg-transparent',
    },
    padding: {
      page: 'px-7',
      none: 'px-0',
    },
  },
  defaultVariants: {
    background: 'neutral',
    padding: 'page',
  },
})

const tabVariants = cva(
  [
    'relative flex items-center gap-2 px-4 py-3 transition-colors',
    'focus-visible:outline-none focus-visible:bg-n-50',
    'disabled:opacity-50 disabled:cursor-not-allowed',
  ],
  {
    variants: {
      active: {
        true: 'text-n-900 font-semibold',
        false: 'text-n-500 hover:text-n-700 font-regular',
      },
    },
    defaultVariants: { active: false },
  },
)

export interface TabRailProps
  extends VariantProps<typeof railVariants>, React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export const TabRail = forwardRef<HTMLDivElement, TabRailProps>(
  ({ className, background, padding, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn(railVariants({ background, padding }), className)} {...props}>
        {children}
      </div>
    )
  },
)
TabRail.displayName = 'TabRail'

export interface TabRailItemProps
  extends VariantProps<typeof tabVariants>, React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Renders a 2px teal underline at the bottom edge when true. */
  active?: boolean
  /** Optional secondary text shown right of the main label (e.g. progress count). */
  meta?: React.ReactNode
}

export const TabRailItem = forwardRef<HTMLButtonElement, TabRailItemProps>(
  ({ className, active = false, meta, type = 'button', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        aria-pressed={active}
        className={cn(tabVariants({ active }), 'text-[13px]', className)}
        {...props}
      >
        <span>{children}</span>
        {meta && <span className="font-mono text-[11px] text-n-400">{meta}</span>}
        {active && (
          <span className="absolute left-0 right-0 bottom-0 bg-p-500" style={{ height: '2px' }} />
        )}
      </button>
    )
  },
)
TabRailItem.displayName = 'TabRailItem'

/** Trailing "+ Add" affordance rendered alongside tab items. */
export const TabRailAdd = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, type = 'button', children, ...props }, ref) => {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'flex items-center gap-1 px-4 py-3 text-[12.5px] text-n-500 hover:text-n-700 transition-colors',
        'focus-visible:outline-none focus-visible:bg-n-50',
        className,
      )}
      {...props}
    >
      <i className="ph ph-plus text-[12px]" />
      {children}
    </button>
  )
})
TabRailAdd.displayName = 'TabRailAdd'
