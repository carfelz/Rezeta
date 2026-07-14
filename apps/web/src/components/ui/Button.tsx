import { forwardRef } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

export const buttonVariants = cva(
  // Base — every button
  [
    'inline-flex items-center justify-center gap-2',
    'font-sans font-medium leading-none',
    'rounded-sm border',
    'whitespace-nowrap select-none cursor-pointer',
    'transition-colors-border duration-fast ease-[ease]',
    'focus-visible:outline-none',
  ],
  {
    variants: {
      variant: {
        primary: [
          'bg-p-500 text-n-0 border-p-500',
          'hover:bg-p-700 hover:border-p-700',
          'active:bg-p-900 active:border-p-900',
          'focus-visible:shadow-focus',
          'disabled:bg-n-200 disabled:border-n-200 disabled:text-n-400 disabled:cursor-not-allowed',
        ],
        secondary: [
          'bg-n-0 text-n-800 border-n-300',
          'hover:bg-n-50 hover:border-n-400',
          'active:bg-n-100',
          'focus-visible:shadow-focus',
          'disabled:bg-n-25 disabled:border-n-200 disabled:text-n-400 disabled:cursor-not-allowed',
        ],
        ghost: [
          'bg-transparent text-n-700 border-transparent',
          'hover:bg-n-100',
          'active:bg-n-200',
          'focus-visible:shadow-focus',
          'disabled:text-n-300 disabled:cursor-not-allowed',
        ],
        item: [
          'bg-transparent text-n-700 border-transparent',
          'hover:bg-n-25',
          'active:bg-n-50',
          'focus-visible:shadow-focus',
          'disabled:text-n-300 disabled:cursor-not-allowed',
        ],
        danger: [
          'bg-danger-solid text-n-0 border-danger-solid',
          'hover:bg-danger-hover hover:border-danger-hover',
          'active:bg-danger-active active:border-danger-active',
          'focus-visible:shadow-focus-danger',
          'disabled:bg-n-200 disabled:border-n-200 disabled:text-n-400 disabled:cursor-not-allowed',
        ],
        warning: [
          'bg-warning-text text-n-0 border-warning-text',
          'hover:opacity-90',
          'active:opacity-80',
          'focus-visible:shadow-focus',
          'disabled:bg-n-200 disabled:border-n-200 disabled:text-n-400 disabled:cursor-not-allowed',
        ],
      },
      size: {
        sm: 'h-btn-sm text-xs px-2.5',
        md: 'h-btn-md text-sm px-3.5',
        lg: 'h-btn-lg text-body px-4.5',
        xl: 'h-btn-xl text-body px-5',
        icon: 'h-btn-md w-btn-md p-0 [&>svg]:w-4 [&>svg]:h-4',
      },
      iconOnly: {
        true: 'px-0',
        false: '',
      },
    },
    compoundVariants: [
      { size: 'sm', iconOnly: true, class: 'w-btn-sm [&>svg]:w-3.5 [&>svg]:h-3.5' },
      { size: 'md', iconOnly: true, class: 'w-btn-md [&>svg]:w-4 [&>svg]:h-4' },
      { size: 'lg', iconOnly: true, class: 'w-btn-lg [&>svg]:w-4.5 [&>svg]:h-4.5' },
      { size: 'xl', iconOnly: true, class: 'w-touch-min [&>svg]:w-5 [&>svg]:h-5' },
    ],
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      iconOnly: false,
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, iconOnly, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, iconOnly }), className)}
        {...props}
      />
    )
  },
)

Button.displayName = 'Button'
