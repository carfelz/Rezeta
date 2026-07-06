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
  /**
   * When true, the spinner is purely decorative: it is hidden from assistive
   * technology (`aria-hidden`) with no `role="status"` and no accessible name.
   * Use this when a surrounding live region already announces the loading state
   * to avoid duplicate announcements. Defaults to false (status + label).
   */
  decorative?: boolean
}

export function Spinner({
  size,
  className,
  'aria-label': ariaLabel,
  decorative = false,
}: SpinnerProps): JSX.Element {
  const glyphClassName = cn(spinnerVariants({ size }), className)

  if (decorative) {
    return <i aria-hidden="true" className={glyphClassName} />
  }

  const label = ariaLabel ?? 'Cargando'

  return (
    <span role="status" className="inline-flex leading-none">
      <i aria-hidden="true" className={glyphClassName} />
      <span className="sr-only">{label}</span>
    </span>
  )
}
