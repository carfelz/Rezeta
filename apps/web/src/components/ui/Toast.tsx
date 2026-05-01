import * as ToastPrimitive from '@radix-ui/react-toast'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import type { ComponentPropsWithoutRef, ElementRef, ReactNode } from 'react'
import { forwardRef } from 'react'
import React from 'react'

export const ToastProvider = ToastPrimitive.Provider

export const ToastViewport = forwardRef<
  ElementRef<typeof ToastPrimitive.Viewport>,
  ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Viewport
    ref={ref}
    className={cn(
      'fixed bottom-6 right-6 z-[999] flex flex-col gap-2 w-[380px] max-w-[calc(100vw-48px)]',
      className,
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitive.Viewport.displayName

const toastVariants = cva(
  [
    'relative flex items-start gap-3 p-[12px_16px]',
    'bg-n-0 border border-n-200 rounded',
    'text-[13px] font-sans',
    'transition-all duration-[150ms]',
    'data-[state=open]:animate-in data-[state=closed]:animate-out',
    'data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full',
    'data-[state=open]:slide-in-from-bottom-full data-[state=open]:fade-in-0',
  ],
  {
    variants: {
      variant: {
        default: '',
        success: '',
        warning: '',
        danger: '',
        info: '',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

const iconColorMap = {
  default: 'text-n-500',
  success: 'text-success-text',
  warning: 'text-warning-text',
  danger: 'text-danger-text',
  info: 'text-info-text',
} as const

export interface ToastProps
  extends ComponentPropsWithoutRef<typeof ToastPrimitive.Root>, VariantProps<typeof toastVariants> {
  icon?: ReactNode
}

export const Toast = forwardRef<ElementRef<typeof ToastPrimitive.Root>, ToastProps>(
  ({ className, variant, icon, children, ...props }, ref) => (
    <ToastPrimitive.Root
      ref={ref}
      className={cn(
        toastVariants({ variant }),
        'shadow-[0_1px_0_rgba(14,14,13,.04),0_8px_24px_-8px_rgba(14,14,13,.12),0_2px_6px_rgba(14,14,13,.06)]',
        className,
      )}
      {...props}
    >
      {icon && (
        <span
          className={cn(
            'text-[18px] leading-none mt-px shrink-0',
            iconColorMap[variant ?? 'default'],
          )}
        >
          {icon}
        </span>
      )}
      <div className="flex-1 min-w-0">{children}</div>
      <ToastPrimitive.Close className="shrink-0 text-n-400 hover:text-n-700 transition-colors duration-[100ms]">
        <i className="ph ph-x text-[15px]" />
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  ),
)
Toast.displayName = ToastPrimitive.Root.displayName

export const ToastTitle = forwardRef<
  ElementRef<typeof ToastPrimitive.Title>,
  ComponentPropsWithoutRef<typeof ToastPrimitive.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Title
    ref={ref}
    className={cn('text-[13px] font-semibold text-n-800 leading-snug', className)}
    {...props}
  />
))
ToastTitle.displayName = ToastPrimitive.Title.displayName

export const ToastDescription = forwardRef<
  ElementRef<typeof ToastPrimitive.Description>,
  ComponentPropsWithoutRef<typeof ToastPrimitive.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Description
    ref={ref}
    className={cn('text-[12.5px] text-n-500 leading-[1.45] mt-1', className)}
    {...props}
  />
))
ToastDescription.displayName = ToastPrimitive.Description.displayName

export const ToastAction = ToastPrimitive.Action
export type ToastActionElement = React.ReactElement<typeof ToastAction>
