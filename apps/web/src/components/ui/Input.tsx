import { forwardRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

// Input

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
  variant?: 'default' | 'ghost'
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, variant = 'default', ...props }, ref) => {
    const isGhost = variant === 'ghost'
    return (
      <input
        ref={ref}
        className={cn(
          'w-full h-input-md px-3 text-sm font-sans',
          'text-n-700 placeholder:text-n-400',
          'outline-none',
          'transition-border-shadow duration-fast',
          !isGhost && [
            'bg-n-0 border rounded-sm',
            !error &&
              'border-n-300 focus:border-p-500 focus:shadow-focus-subtle',
            error && 'border-danger-solid focus:border-danger-solid',
            'disabled:bg-n-50 disabled:text-n-400 disabled:border-n-200 disabled:cursor-not-allowed',
            'read-only:bg-n-25 read-only:border-n-200 read-only:cursor-default',
          ],
          isGhost && 'bg-transparent border-0 shadow-none placeholder:text-n-300',
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
  variant?: 'default' | 'ghost'
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, variant = 'default', ...props }, ref) => {
    const isGhost = variant === 'ghost'
    return (
      <textarea
        ref={ref}
        className={cn(
          'w-full px-3 text-sm font-sans',
          'text-n-700 placeholder:text-n-400',
          'outline-none',
          'transition-border-shadow duration-fast',
          !isGhost && [
            'py-3 bg-n-0 border rounded-sm resize-y',
            !error &&
              'border-n-300 focus:border-p-500 focus:shadow-focus-subtle',
            error && 'border-danger-solid focus:border-danger-solid',
            'disabled:bg-n-50 disabled:text-n-400 disabled:border-n-200 disabled:cursor-not-allowed',
          ],
          isGhost && 'bg-transparent border-0 shadow-none resize-none placeholder:text-n-300',
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
        'transition-border-shadow duration-fast',
        'focus-within:border-p-500 focus-within:shadow-focus-subtle',
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
        'flex items-center px-3 text-sm font-sans text-n-500 whitespace-nowrap shrink-0',
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
  error?: string | undefined
  children: ReactNode
  className?: string
  id?: string
}

export function Field({
  label,
  required,
  helper,
  error,
  children,
  className,
  id,
}: FieldProps): JSX.Element {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={id} className="text-xs font-sans font-medium text-n-700 leading-none">
          {label}
          {required && <span className="text-danger-solid ml-1">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <span className="flex items-center gap-1 text-overline font-sans text-danger-solid leading-tight">
          <i className="ph ph-warning" style={{ fontSize: 13 }} />
          {error}
        </span>
      ) : helper ? (
        <span className="text-overline font-sans text-n-500 leading-tight">{helper}</span>
      ) : null}
    </div>
  )
}
