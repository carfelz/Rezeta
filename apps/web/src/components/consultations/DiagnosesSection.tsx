import { useState } from 'react'
import { TextLink } from '@/components/ui'

export interface DiagnosesSectionProps {
  diagnoses: string[]
  onChange: (d: string[]) => void
  disabled: boolean
}

export function DiagnosesSection({
  diagnoses,
  onChange,
  disabled,
}: DiagnosesSectionProps): JSX.Element {
  const [input, setInput] = useState('')

  function addDiagnosis(): void {
    const trimmed = input.trim()
    if (!trimmed || diagnoses.includes(trimmed)) return
    onChange([...diagnoses, trimmed])
    setInput('')
  }

  function removeDiagnosis(d: string): void {
    onChange(diagnoses.filter((x) => x !== d))
  }

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {diagnoses.map((d) => (
        <span
          key={d}
          className="inline-flex items-center gap-2 text-[12.5px] font-sans px-3 py-1 rounded bg-p-50 border border-p-100 text-p-700"
        >
          {d}
          {!disabled && (
            <button
              type="button"
              onClick={() => removeDiagnosis(d)}
              className="ml-1 text-p-500 hover:text-p-900 leading-none"
              aria-label={`Quitar ${d}`}
            >
              <i className="ph ph-x text-[11px]" />
            </button>
          )}
        </span>
      ))}
      {!disabled && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addDiagnosis()
              }
            }}
            placeholder="Añadir diagnóstico…"
            className="h-[30px] px-3 text-[12.5px] font-sans border border-dashed border-n-300 rounded-sm bg-n-0 placeholder:text-n-300 text-n-700 focus:outline-none focus:border-p-500 w-[200px]"
          />
          {input.trim() && (
            <TextLink tone="primary" size="sm" weight="medium" onClick={addDiagnosis}>
              Añadir
            </TextLink>
          )}
        </div>
      )}
      {diagnoses.length === 0 && disabled && <span className="text-[13px] text-n-300">—</span>}
    </div>
  )
}
