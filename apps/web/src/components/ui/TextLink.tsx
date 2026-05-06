import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const textLinkVariants = cva(
  [
    'inline-flex items-center gap-1',
    'font-sans transition-colors',
    'focus-visible:outline-none focus-visible:underline',
    'disabled:opacity-50 disabled:cursor-not-allowed',
  ],
  {
    variants: {
      tone: {
        neutral: 'text-n-500 hover:text-n-800',
        primary: 'text-p-500 hover:text-p-700',
        warning: 'text-warning-text hover:opacity-80',
        danger: 'text-danger-text hover:underline',
      },
      size: {
        xs: 'text-[11px]',
        sm: 'text-[11.5px]',
        md: 'text-[12px]',
        lg: 'text-[12.5px]',
      },
      weight: {
        regular: 'font-regular',
        medium: 'font-medium',
        semibold: 'font-semibold',
      },
      underline: {
        always: 'underline underline-offset-2',
        hover: 'hover:underline underline-offset-2',
        never: '',
      },
    },
    defaultVariants: {
      tone: 'neutral',
      size: 'md',
      weight: 'regular',
      underline: 'never',
    },
  },
)

export interface TextLinkProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof textLinkVariants> {}

export const TextLink = forwardRef<HTMLButtonElement, TextLinkProps>(
  ({ className, tone, size, weight, underline, type = 'button', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(textLinkVariants({ tone, size, weight, underline }), className)}
        {...props}
      />
    )
  },
)

TextLink.displayName = 'TextLink'
