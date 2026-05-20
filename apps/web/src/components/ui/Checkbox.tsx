import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  tone?: 'primary' | 'danger'
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, tone = 'primary', ...props }, ref) => {
    return (
      <input
        ref={ref}
        type="checkbox"
        className={cn(
          'w-4 h-4 cursor-pointer rounded-sm',
          tone === 'primary' && 'accent-p-500',
          tone === 'danger' && 'accent-danger-text',
          className,
        )}
        {...props}
      />
    )
  },
)

Checkbox.displayName = 'Checkbox'
