import { forwardRef, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from './Button'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { cn } from '@/lib/utils'
import { timePickerStrings } from './datePickerStrings'

export interface TimePickerProps {
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  error?: boolean
  intervalMin?: number
  minTime?: string
  maxTime?: string
  className?: string
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function toMinutes(time: string): number {
  const parts = time.split(':').map((n) => parseInt(n, 10))
  const h = parts[0] ?? 0
  const m = parts[1] ?? 0
  return h * 60 + m
}

function fromMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  return `${pad(h)}:${pad(m)}`
}

function formatDisplay(value: string): string {
  const parts = value.split(':').map((n) => parseInt(n, 10))
  const h = parts[0]
  const m = parts[1]
  if (h === undefined || m === undefined || Number.isNaN(h) || Number.isNaN(m)) return value
  const period = h >= 12 ? 'p.m.' : 'a.m.'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${pad(m)} ${period}`
}

export const TimePicker = forwardRef<HTMLButtonElement, TimePickerProps>(
  (
    {
      value,
      onChange,
      placeholder,
      disabled,
      error,
      intervalMin = 15,
      minTime,
      maxTime,
      className,
    },
    ref,
  ) => {
    const [open, setOpen] = useState(false)
    const listRef = useRef<HTMLDivElement>(null)

    const slots = useMemo(() => {
      const start = minTime ? toMinutes(minTime) : 0
      const end = maxTime ? toMinutes(maxTime) : 24 * 60
      const items: string[] = []
      for (let m = start; m <= end - intervalMin; m += intervalMin) {
        items.push(fromMinutes(m))
      }
      return items
    }, [intervalMin, minTime, maxTime])

    useEffect(() => {
      if (!open || !value) return
      const id = window.requestAnimationFrame(() => {
        const el = listRef.current?.querySelector<HTMLButtonElement>(
          `[data-time="${value}"]`,
        )
        el?.scrollIntoView?.({ block: 'center' })
      })
      return () => window.cancelAnimationFrame(id)
    }, [open, value])

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
              'w-full justify-between font-normal',
              !value && 'text-n-400',
              error && 'border-danger-solid',
              className,
            )}
          >
            <span className="flex items-center gap-2">
              <i className="ph ph-clock text-[16px]" />
              {value ? formatDisplay(value) : placeholder ?? timePickerStrings.placeholder}
            </span>
            <i className="ph ph-caret-down text-[14px] text-n-500" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[180px] p-1 bg-n-0 border border-n-200"
          align="start"
        >
          <div
            ref={listRef}
            className="max-h-[240px] overflow-y-auto flex flex-col gap-0.5"
          >
            {slots.map((slot) => {
              const isActive = slot === value
              return (
                <button
                  key={slot}
                  type="button"
                  data-time={slot}
                  onClick={() => {
                    onChange(slot)
                    setOpen(false)
                  }}
                  className={cn(
                    'h-btn-md px-3 text-[13px] font-mono text-left rounded-sm transition-colors',
                    'hover:bg-n-50',
                    isActive && 'bg-p-500 text-n-0 hover:bg-p-700',
                  )}
                >
                  {formatDisplay(slot)}
                </button>
              )
            })}
          </div>
        </PopoverContent>
      </Popover>
    )
  },
)

TimePicker.displayName = 'TimePicker'
