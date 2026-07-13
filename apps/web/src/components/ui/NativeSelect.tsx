import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface NativeSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean
}

export const NativeSelect = forwardRef<HTMLSelectElement, NativeSelectProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          'w-full h-input-md px-3 text-sm font-sans',
          'bg-n-0 text-n-700 border rounded-sm',
          'outline-none transition-[border-color] duration-[100ms]',
          !error && 'border-n-300 focus:border-p-500',
          error && 'border-danger-solid focus:border-danger-solid',
          'disabled:bg-n-50 disabled:text-n-400 disabled:border-n-200 disabled:cursor-not-allowed',
          className,
        )}
        {...props}
      />
    )
  },
)
NativeSelect.displayName = 'NativeSelect'
