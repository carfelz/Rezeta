import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const searchInputVariants = cva(
  [
    'w-full font-sans text-n-700 placeholder:text-n-400',
    'bg-n-0 border border-n-200 rounded-sm',
    'focus:outline-none focus:border-p-500',
    'disabled:bg-n-25 disabled:text-n-400',
  ],
  {
    variants: {
      size: {
        sm: 'h-input-md pl-8 pr-3 text-sm',
        md: 'h-btn-lg pl-10 pr-3 text-sm rounded-md',
      },
    },
    defaultVariants: { size: 'md' },
  },
)

const iconPositionBySize: Record<'sm' | 'md', string> = {
  sm: 'left-3 text-base',
  md: 'left-3 text-base',
}

export interface SearchInputProps
  extends
    Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'>,
    VariantProps<typeof searchInputVariants> {}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, size, ...props }, ref) => {
    const iconClass = iconPositionBySize[size ?? 'md']
    return (
      <div className="relative">
        <i
          className={cn(
            'ph ph-magnifying-glass absolute top-1/2 -translate-y-1/2 text-n-400 pointer-events-none',
            iconClass,
          )}
        />
        <input
          ref={ref}
          type="search"
          className={cn(searchInputVariants({ size }), className)}
          {...props}
        />
      </div>
    )
  },
)

SearchInput.displayName = 'SearchInput'
