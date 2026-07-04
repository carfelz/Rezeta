import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const spinnerVariants = cva('ph ph-spinner animate-spin inline-block leading-none', {
  variants: {
    size: {
      sm: 'text-[14px]',
      md: 'text-[20px]',
      lg: 'text-[32px]',
    },
  },
  defaultVariants: { size: 'md' },
})

export interface SpinnerProps extends VariantProps<typeof spinnerVariants> {
  className?: string
  'aria-label'?: string
}

export function Spinner({
  size,
  className,
  'aria-label': ariaLabel,
}: SpinnerProps): JSX.Element {
  return (
    <i
      role="status"
      aria-label={ariaLabel ?? 'Cargando'}
      className={cn(spinnerVariants({ size }), className)}
    />
  )
}
