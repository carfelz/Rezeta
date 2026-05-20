import { Input, InputGroup, InputAdorn } from '@/components/ui'

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
      <InputGroup>
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          readOnly={readOnly}
          disabled={disabled}
        />
        <InputAdorn side="right">{unit}</InputAdorn>
      </InputGroup>
    </div>
  )
}
