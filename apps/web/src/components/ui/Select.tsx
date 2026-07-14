import * as SelectPrimitive from '@radix-ui/react-select'
import { cn } from '@/lib/utils'
import type { ComponentPropsWithoutRef, ElementRef } from 'react'
import { forwardRef } from 'react'

export const Select = SelectPrimitive.Root
export const SelectGroup = SelectPrimitive.Group
export const SelectValue = SelectPrimitive.Value

export const SelectTrigger = forwardRef<
  ElementRef<typeof SelectPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'flex items-center justify-between w-full h-input-md px-3 gap-2',
      'text-sm font-sans text-n-700 bg-n-0',
      'border border-n-300 rounded-sm outline-none',
      'transition-border-shadow duration-fast',
      'focus:border-p-500 focus:shadow-focus-subtle',
      'disabled:bg-n-50 disabled:text-n-400 disabled:border-n-200 disabled:cursor-not-allowed',
      'data-[placeholder]:text-n-400',
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <i className="ph ph-caret-down text-xs text-n-400 shrink-0" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

export const SelectContent = forwardRef<
  ElementRef<typeof SelectPrimitive.Content>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', ...props }, ref) => (
  <SelectPrimitive.Content
    ref={ref}
    position={position}
    className={cn(
      'relative z-modal min-w-menu bg-n-0 border border-n-200 rounded',
      'overflow-hidden',
      'data-[state=open]:animate-in data-[state=closed]:animate-out',
      'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
      position === 'popper' && 'w-[var(--radix-select-trigger-width)] mt-1',
      className,
    )}
    style={{
      boxShadow:
        '0 1px 0 rgba(14,14,13,.04), 0 8px 24px -8px rgba(14,14,13,.12), 0 2px 6px rgba(14,14,13,.06)',
    }}
    {...props}
  >
    <SelectPrimitive.Viewport className="py-1">{children}</SelectPrimitive.Viewport>
  </SelectPrimitive.Content>
))
SelectContent.displayName = SelectPrimitive.Content.displayName

export const SelectLabel = forwardRef<
  ElementRef<typeof SelectPrimitive.Label>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn(
      'px-3 py-2 text-overline font-mono uppercase tracking-label text-n-400',
      className,
    )}
    {...props}
  />
))
SelectLabel.displayName = SelectPrimitive.Label.displayName

export const SelectItem = forwardRef<
  ElementRef<typeof SelectPrimitive.Item>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex items-center px-3 py-1.75 pr-8',
      'text-sm font-sans text-n-700',
      'cursor-pointer select-none outline-none',
      'transition-colors duration-fast',
      'hover:bg-n-50 focus:bg-n-50',
      'data-[highlighted]:bg-n-50',
      'data-[disabled]:opacity-40 data-[disabled]:cursor-not-allowed',
      'data-[state=checked]:font-medium data-[state=checked]:text-n-900',
      className,
    )}
    {...props}
  >
    <span className="absolute right-2 flex h-4 w-4 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <i className="ph ph-check text-sm text-p-500" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = SelectPrimitive.Item.displayName

export const SelectSeparator = forwardRef<
  ElementRef<typeof SelectPrimitive.Separator>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator ref={ref} className={cn('h-px bg-n-100 my-1', className)} {...props} />
))
SelectSeparator.displayName = SelectPrimitive.Separator.displayName
