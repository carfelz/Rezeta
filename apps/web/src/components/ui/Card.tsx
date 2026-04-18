import { clsx } from 'clsx'
import type { ReactNode } from 'react'

// Standard Card

export interface CardProps {
  children: ReactNode
  selected?: boolean
  className?: string
}

export function Card({ children, selected, className }: CardProps) {
  return (
    <div
      className={clsx(
        'relative bg-n-0 border rounded p-5',
        selected
          ? 'border-p-500 before:absolute before:left-0 before:top-3 before:bottom-3 before:w-0.5 before:bg-p-500 before:rounded-r-sm'
          : 'border-n-200',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx('text-[14px] font-sans font-semibold text-n-800 leading-tight', className)}>
      {children}
    </div>
  )
}

export function CardSubtitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx('text-[12.5px] font-sans text-n-500 mt-0.5', className)}>
      {children}
    </div>
  )
}

// CardItem (list row)

export interface CardItemProps {
  leading?: ReactNode
  name: ReactNode
  meta?: ReactNode
  trailing?: ReactNode
  onClick?: () => void
  className?: string
}

export function CardItem({ leading, name, meta, trailing, onClick, className }: CardItemProps) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      className={clsx(
        'flex items-center gap-[14px] px-[18px] py-[14px] border border-n-200 rounded-sm bg-n-0',
        onClick && 'cursor-pointer hover:bg-n-25',
        className,
      )}
    >
      {leading}
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-sans font-semibold text-n-800 truncate">{name}</div>
        {meta && (
          <div className="text-[12px] font-sans text-n-500 mt-0.5 truncate">{meta}</div>
        )}
      </div>
      {trailing}
    </div>
  )
}
