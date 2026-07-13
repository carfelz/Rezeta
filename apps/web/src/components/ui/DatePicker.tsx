import { forwardRef, useState } from 'react'
import { es } from 'date-fns/locale'
import { format } from 'date-fns'
import { Button } from './Button'
import { Calendar } from './calendar'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { cn } from '@/lib/utils'
import { datePickerStrings } from './datePickerStrings'

export interface DatePickerProps {
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  error?: boolean
  minDate?: Date
  maxDate?: Date
  className?: string
}

function parseDateInputValue(value: string | undefined): Date | undefined {
  if (!value) return undefined
  const [y, m, d] = value.split('-').map((n) => parseInt(n, 10))
  if (!y || !m || !d) return undefined
  return new Date(y, m - 1, d)
}

function toDateInputString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export const DatePicker = forwardRef<HTMLButtonElement, DatePickerProps>(
  (
    { value, onChange, placeholder, disabled, error, minDate, maxDate, className },
    ref,
  ) => {
    const [open, setOpen] = useState(false)
    const selected = parseDateInputValue(value)

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            ref={ref}
            type="button"
            variant="secondary"
            size="md"
            disabled={disabled}
            className={cn(
              'w-full justify-between font-regular',
              !selected && 'text-n-400',
              error && 'border-danger-solid',
              className,
            )}
          >
            <span className="flex items-center gap-2">
              <i className="ph ph-calendar text-[16px]" />
              {selected
                ? format(selected, 'PPP', { locale: es })
                : placeholder ?? datePickerStrings.placeholder}
            </span>
            <i className="ph ph-caret-down text-[14px] text-n-500" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-n-0 border border-n-200" align="start">
          <Calendar
            mode="single"
            locale={es}
            selected={selected}
            onSelect={(date: Date | undefined) => {
              if (date) {
                onChange(toDateInputString(date))
                setOpen(false)
              }
            }}
            disabled={(date: Date) => {
              if (minDate && date < minDate) return true
              if (maxDate && date > maxDate) return true
              return false
            }}
            autoFocus
          />
        </PopoverContent>
      </Popover>
    )
  },
)

DatePicker.displayName = 'DatePicker'
