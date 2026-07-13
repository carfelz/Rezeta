import { useState } from 'react'
import { IconButton, Input, TextLink } from '@/components/ui'
import { diagnosesSectionStrings } from './strings'

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
          className="inline-flex items-center gap-2 text-xs font-sans px-3 py-1 rounded bg-p-50 border border-p-100 text-p-700"
        >
          {d}
          {!disabled && (
            <IconButton
              icon="ph ph-x"
              size="sm"
              tone="neutral"
              aria-label={diagnosesSectionStrings.removeDiagnosisLabel(d)}
              onClick={() => removeDiagnosis(d)}
              className="ml-1"
            />
          )}
        </span>
      ))}
      {!disabled && (
        <div className="flex items-center gap-2">
          <Input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addDiagnosis()
              }
            }}
            placeholder={diagnosesSectionStrings.addPlaceholder}
            className="h-[30px] text-xs border-dashed w-[200px]"
          />
          {input.trim() && (
            <TextLink tone="primary" size="sm" weight="medium" onClick={addDiagnosis}>
              {diagnosesSectionStrings.addButton}
            </TextLink>
          )}
        </div>
      )}
      {diagnoses.length === 0 && disabled && (
        <span className="text-sm text-n-300">{diagnosesSectionStrings.emptyDash}</span>
      )}
    </div>
  )
}
