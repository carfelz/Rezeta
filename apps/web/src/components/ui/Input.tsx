import { forwardRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

// Input

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'w-full h-input-md px-3 text-[13px] font-sans',
          'bg-n-0 text-n-700 placeholder:text-n-400',
          'border rounded-sm outline-none',
          'transition-[border-color,box-shadow] duration-[100ms]',
          !error && 'border-n-300 focus:border-p-500 focus:shadow-[0_0_0_3px_rgba(45,87,96,0.12)]',
          error && 'border-danger-solid focus:border-danger-solid',
          'disabled:bg-n-50 disabled:text-n-400 disabled:border-n-200 disabled:cursor-not-allowed',
          'read-only:bg-n-25 read-only:border-n-200 read-only:cursor-default',
          className,
        )}
        {...props}
      />
    )
  },
)

Input.displayName = 'Input'

// Textarea

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          'w-full px-3 py-3 text-[13px] font-sans',
          'bg-n-0 text-n-700 placeholder:text-n-400',
          'border rounded-sm outline-none resize-y',
          'transition-[border-color,box-shadow] duration-[100ms]',
          !error && 'border-n-300 focus:border-p-500 focus:shadow-[0_0_0_3px_rgba(45,87,96,0.12)]',
          error && 'border-danger-solid focus:border-danger-solid',
          'disabled:bg-n-50 disabled:text-n-400 disabled:border-n-200 disabled:cursor-not-allowed',
          className,
        )}
        {...props}
      />
    )
  },
)

Textarea.displayName = 'Textarea'

// InputGroup (adornments + icons wrapper)

export interface InputGroupProps {
  children: ReactNode
  error?: boolean
  className?: string
}

export function InputGroup({ children, error, className }: InputGroupProps): JSX.Element {
  return (
    <div
      className={cn(
        'flex items-stretch w-full',
        'border rounded-sm',
        'transition-[border-color,box-shadow] duration-[100ms]',
        'focus-within:border-p-500 focus-within:shadow-[0_0_0_3px_rgba(45,87,96,0.12)]',
        error
          ? 'border-danger-solid focus-within:border-danger-solid focus-within:shadow-none'
          : 'border-n-300',
        '[&_input]:border-0 [&_input]:shadow-none [&_input]:focus:shadow-none [&_input]:rounded-none',
        className,
      )}
    >
      {children}
    </div>
  )
}

// Adornment (text prefix/suffix)

export interface InputAdornProps {
  children: ReactNode
  side?: 'left' | 'right'
  plain?: boolean
  className?: string
}

export function InputAdorn({
  children,
  side = 'left',
  plain,
  className,
}: InputAdornProps): JSX.Element {
  return (
    <span
      className={cn(
        'flex items-center px-3 text-[13px] font-sans text-n-500 whitespace-nowrap shrink-0',
        !plain && 'bg-n-50',
        side === 'left' && !plain && 'border-r border-n-300',
        side === 'right' && !plain && 'border-l border-n-300',
        className,
      )}
    >
      {children}
    </span>
  )
}

// InputIcon (icon prefix/suffix)

export interface InputIconProps {
  children: ReactNode
  side?: 'left' | 'right'
  action?: boolean
  onClick?: () => void
  className?: string
}

export function InputIcon({
  children,
  side: _side,
  action,
  onClick,
  className,
}: InputIconProps): JSX.Element {
  return (
    <span
      role={action ? 'button' : undefined}
      tabIndex={action ? 0 : undefined}
      onClick={action ? onClick : undefined}
      className={cn(
        'flex items-center justify-center w-8 shrink-0 text-n-400',
        action && 'cursor-pointer hover:text-n-800 hover:bg-n-50',
        className,
      )}
    >
      {children}
    </span>
  )
}

// Field (label + input + helper/error)

export interface FieldProps {
  label?: string
  required?: boolean
  helper?: string
  error?: string
  children: ReactNode
  className?: string
}

export function Field({
  label,
  required,
  helper,
  error,
  children,
  className,
}: FieldProps): JSX.Element {
  return (
    <div className={cn('flex flex-col gap-[6px]', className)}>
      {label && (
        <label className="text-[12.5px] font-sans font-medium text-n-700 leading-none">
          {label}
          {required && <span className="text-danger-solid ml-0.5">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <span className="flex items-center gap-1 text-[11.5px] font-sans text-danger-solid leading-tight">
          <i className="ph ph-warning" style={{ fontSize: 13 }} />
          {error}
        </span>
      ) : helper ? (
        <span className="text-[11.5px] font-sans text-n-500 leading-tight">{helper}</span>
      ) : null}
    </div>
  )
}
