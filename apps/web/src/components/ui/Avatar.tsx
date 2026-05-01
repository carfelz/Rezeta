import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const avatarVariants = cva(
  'inline-flex items-center justify-center rounded-full bg-p-50 text-p-700 font-sans font-semibold shrink-0 select-none uppercase',
  {
    variants: {
      size: {
        default: 'w-[36px] h-[36px] text-[13px]',
        sm: 'w-[30px] h-[30px] text-[11px]',
        xs: 'w-[28px] h-[28px] text-[11px]',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  },
)

export interface AvatarProps extends VariantProps<typeof avatarVariants> {
  initials: string
  className?: string
}

export function Avatar({ initials, size, className }: AvatarProps): JSX.Element {
  return <span className={cn(avatarVariants({ size }), className)}>{initials.slice(0, 2)}</span>
}
