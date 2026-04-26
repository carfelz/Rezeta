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
      'text-[13px] font-sans text-n-700 bg-n-0',
      'border border-n-300 rounded-sm outline-none',
      'transition-[border-color,box-shadow] duration-[100ms]',
      'focus:border-p-500 focus:shadow-[0_0_0_3px_rgba(45,87,96,0.12)]',
      'disabled:bg-n-50 disabled:text-n-400 disabled:border-n-200 disabled:cursor-not-allowed',
      'data-[placeholder]:text-n-400',
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <i className="ph ph-caret-down text-[12px] text-n-400 shrink-0" />
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
      'relative z-[600] min-w-[8rem] bg-n-0 border border-n-200 rounded',
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
      'px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.06em] text-n-400',
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
      'relative flex items-center px-3 py-[7px] pr-8',
      'text-[13px] font-sans text-n-700',
      'cursor-pointer select-none outline-none',
      'transition-colors duration-[100ms]',
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
        <i className="ph ph-check text-[13px] text-p-500" />
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
