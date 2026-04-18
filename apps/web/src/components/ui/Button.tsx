import { forwardRef } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { clsx } from 'clsx'

const buttonVariants = cva(
  // Base — every button
  [
    'inline-flex items-center justify-center gap-2',
    'font-sans font-medium leading-none',
    'rounded-sm border',
    'whitespace-nowrap select-none cursor-pointer',
    'transition-[background-color,border-color,color] duration-[100ms] ease-[ease]',
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
        danger: [
          'bg-danger-solid text-n-0 border-danger-solid',
          'hover:bg-[#6E2018] hover:border-[#6E2018]',
          'active:bg-[#52170F] active:border-[#52170F]',
          'focus-visible:shadow-focus-danger',
          'disabled:bg-n-200 disabled:border-n-200 disabled:text-n-400 disabled:cursor-not-allowed',
        ],
      },
      size: {
        sm: 'h-btn-sm text-[12.5px] px-[10px]',
        md: 'h-btn-md text-[13px] px-[14px]',
        lg: 'h-btn-lg text-body px-[18px]',
      },
      iconOnly: {
        true: 'px-0',
        false: '',
      },
    },
    compoundVariants: [
      { size: 'sm', iconOnly: true, class: 'w-[28px] [&>svg]:w-[14px] [&>svg]:h-[14px]' },
      { size: 'md', iconOnly: true, class: 'w-[32px] [&>svg]:w-[16px] [&>svg]:h-[16px]' },
      { size: 'lg', iconOnly: true, class: 'w-[40px] [&>svg]:w-[18px] [&>svg]:h-[18px]' },
    ],
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      iconOnly: false,
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, iconOnly, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        ref={ref}
        className={clsx(buttonVariants({ variant, size, iconOnly }), className)}
        {...props}
      />
    )
  },
)

Button.displayName = 'Button'
