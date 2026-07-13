import type { FC } from 'react'

type VitalsField = {
  id: string
  label: string
  unit?: string
  input_type: 'text' | 'number' | 'computed'
  formula?: string
}

type VitalsBlockProps = {
  fields: VitalsField[]
  values?: Record<string, string | number>
  readOnly?: boolean
  onChange?: (fieldId: string, value: string) => void
}

export const VitalsBlock: FC<VitalsBlockProps> = ({ fields, values = {}, readOnly, onChange }) => {
  return (
    <div className="grid grid-cols-2 gap-3">
      {fields.map((field) => (
        <div key={field.id} className="flex flex-col gap-1">
          <label className="text-xs font-mono text-n-500 uppercase tracking-wide">
            {field.label}
            {field.unit && <span className="ml-1 text-n-400">({field.unit})</span>}
          </label>
          {field.input_type === 'computed' ? (
            <div className="h-touch flex items-center px-3 bg-n-50 rounded-sm border border-n-200 text-n-600 font-mono text-body-sm">
              {values[field.id] ?? '—'}
            </div>
          ) : (
            <input
              type={field.input_type === 'number' ? 'number' : 'text'}
              className="h-touch px-3 rounded-sm border border-n-200 bg-n-0 text-n-900 font-mono text-body-sm focus:outline-none focus:ring-1 focus:ring-p-500 disabled:bg-n-50"
              value={String(values[field.id] ?? '')}
              disabled={readOnly}
              onChange={(e) => onChange?.(field.id, e.target.value)}
              placeholder="—"
            />
          )}
        </div>
      ))}
    </div>
  )
}
