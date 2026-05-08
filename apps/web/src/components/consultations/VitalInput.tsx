import { cn } from '@/lib/utils'

export interface VitalInputProps {
  label: string
  value: string
  onChange: (v: string) => void
  unit: string
  placeholder?: string
  readOnly?: boolean
  disabled?: boolean
}

export function VitalInput({
  label,
  value,
  onChange,
  unit,
  placeholder = '—',
  readOnly = false,
  disabled = false,
}: VitalInputProps): JSX.Element {
  return (
    <div className="field">
      <label className="block text-[12px] font-sans font-medium text-n-700 mb-1">{label}</label>
      <div className="flex h-[34px] border border-n-300 rounded-sm overflow-hidden focus-within:border-p-500 focus-within:ring-[3px] focus-within:ring-p-500/10">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          readOnly={readOnly}
          disabled={disabled}
          className={cn(
            'flex-1 min-w-0 px-3 text-[13px] font-sans text-n-700 placeholder:text-n-300 bg-n-0 focus:outline-none',
            (readOnly || disabled) && 'bg-n-25 text-n-500 cursor-default',
          )}
        />
        <span className="px-3 flex items-center text-[11.5px] font-mono text-n-500 bg-n-50 border-l border-n-200 shrink-0 whitespace-nowrap">
          {unit}
        </span>
      </div>
    </div>
  )
}
