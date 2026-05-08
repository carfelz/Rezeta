import { cn } from '@/lib/utils'

export interface SoapTextareaProps {
  value: string
  onChange: (v: string) => void
  placeholder: string
  rows: number
  disabled: boolean
}

export function SoapTextarea({
  value,
  onChange,
  placeholder,
  rows,
  disabled,
}: SoapTextareaProps): JSX.Element {
  if (disabled) {
    return (
      <p
        className={cn(
          'text-[13.5px] font-sans text-n-700 leading-[1.55] whitespace-pre-wrap min-h-[48px]',
          !value && 'text-n-300',
        )}
      >
        {value || '—'}
      </p>
    )
  }
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full text-[13.5px] font-sans text-n-700 placeholder:text-n-300 leading-[1.55] resize-none focus:outline-none focus:ring-0 bg-transparent"
    />
  )
}
