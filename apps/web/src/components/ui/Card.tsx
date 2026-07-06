import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

// Standard Card

export interface CardProps {
  children: ReactNode
  selected?: boolean
  className?: string
}

export function Card({ children, selected, className }: CardProps): JSX.Element {
  return (
    <div
      className={cn(
        'relative bg-n-0 border rounded p-5',
        selected
          ? 'border-p-500 before:absolute before:left-0 before:top-3 before:bottom-3 before:w-[2px] before:bg-p-500 before:rounded-r-sm'
          : 'border-n-200',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function CardTitle({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}): JSX.Element {
  return (
    <div className={cn('text-[14px] font-sans font-semibold text-n-800 leading-tight', className)}>
      {children}
    </div>
  )
}

export function CardSubtitle({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}): JSX.Element {
  return <div className={cn('text-[12.5px] font-sans text-n-500 mt-1', className)}>{children}</div>
}
