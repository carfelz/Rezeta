import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const containerVariants = cva(
  ['inline-flex items-center bg-p-100 border border-p-100 rounded gap-px p-px'],
  {
    variants: {},
    defaultVariants: {},
  },
)

const optionVariants = cva(
  [
    'font-mono uppercase tracking-[0.06em] rounded-sm transition-colors',
    'focus-visible:outline-none focus-visible:shadow-focus',
    'disabled:opacity-40 disabled:cursor-not-allowed',
  ],
  {
    variants: {
      active: {
        true: 'bg-n-0 text-p-700 font-semibold',
        false: 'bg-transparent text-p-700 opacity-60 font-regular hover:opacity-100',
      },
      size: {
        sm: 'text-[10px] px-2 py-px',
        md: 'text-[11px] px-3 py-px',
      },
    },
    defaultVariants: {
      active: false,
      size: 'md',
    },
  },
)

export interface SegmentedControlOption<T extends string = string> {
  value: T
  label: string
}

export interface SegmentedControlProps<T extends string = string>
  extends
    VariantProps<typeof optionVariants>,
    Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  options: SegmentedControlOption<T>[]
  value: T
  onChange: (value: T) => void
  disabled?: boolean
}

export function SegmentedControl<T extends string = string>({
  className,
  options,
  value,
  onChange,
  size,
  disabled = false,
  ...props
}: SegmentedControlProps<T>): JSX.Element {
  return (
    <div className={cn(containerVariants(), className)} {...props}>
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={cn(optionVariants({ active, size }))}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

SegmentedControl.displayName = 'SegmentedControl'
