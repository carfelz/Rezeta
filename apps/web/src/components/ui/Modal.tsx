import * as Dialog from '@radix-ui/react-dialog'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

export interface ModalProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: ReactNode
}

export function Modal({ open, onOpenChange, children }: ModalProps): JSX.Element {
  const rootProps: Parameters<typeof Dialog.Root>[0] = { children }
  if (open !== undefined) rootProps.open = open
  if (onOpenChange !== undefined) rootProps.onOpenChange = onOpenChange
  return <Dialog.Root {...rootProps} />
}

export const ModalTrigger = Dialog.Trigger

export interface ModalContentProps {
  children: ReactNode
  size?: 'default' | 'lg'
  className?: string
}

export function ModalContent({
  children,
  size = 'default',
  className,
}: ModalContentProps): JSX.Element {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 bg-[rgba(14,14,13,0.35)] z-[500] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <Dialog.Content
        className={cn(
          'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[500]',
          'bg-n-0 rounded shadow-floating outline-none',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
          'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
          size === 'lg' ? 'w-[560px]' : 'w-[440px]',
          className,
        )}
      >
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  )
}

export interface ModalHeaderProps {
  icon?: ReactNode
  iconVariant?: 'default' | 'danger' | 'warning' | 'success'
  title: string
  subtitle?: string
  showClose?: boolean
  className?: string
}

export function ModalHeader({
  icon,
  iconVariant = 'default',
  title,
  subtitle,
  showClose = true,
  className,
}: ModalHeaderProps): JSX.Element {
  const iconStyles = {
    default: 'bg-p-50 text-p-700',
    danger: 'bg-danger-bg text-danger-text',
    warning: 'bg-warning-bg text-warning-text',
    success: 'bg-success-bg text-success-text',
  }

  return (
    <div
      className={cn('flex items-start gap-4 px-6 pt-5 pb-[14px] border-b border-n-100', className)}
    >
      {icon && (
        <span
          className={cn(
            'flex items-center justify-center w-[34px] h-[34px] rounded-full shrink-0 text-[18px]',
            iconStyles[iconVariant],
          )}
        >
          {icon}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <Dialog.Title className="text-[19px] font-serif font-medium text-n-900 leading-tight tracking-[-0.005em]">
          {title}
        </Dialog.Title>
        {subtitle && (
          <Dialog.Description className="text-[13px] font-sans text-n-600 mt-1 leading-tight">
            {subtitle}
          </Dialog.Description>
        )}
      </div>
      {showClose && (
        <Dialog.Close className="flex items-center justify-center w-8 h-8 rounded-sm text-n-400 hover:text-n-700 hover:bg-n-50 transition-colors duration-[100ms] shrink-0 -mr-1 mt-[-2px]">
          <i className="ph ph-x text-[16px]" />
          <span className="sr-only">Cerrar</span>
        </Dialog.Close>
      )}
    </div>
  )
}

export function ModalBody({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}): JSX.Element {
  return <div className={cn('px-6 py-5', className)}>{children}</div>
}

export function ModalFooter({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}): JSX.Element {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-3 px-5 py-[14px] bg-n-25 border-t border-n-100 rounded-b',
        className,
      )}
    >
      {children}
    </div>
  )
}

export const ModalClose = Dialog.Close
