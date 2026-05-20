import { useState } from 'react'
import { Button, Callout } from '@/components/ui'
import { onboardingCustomizeStrings } from './strings'
import type { TemplateCandidate, TypeCandidate } from './types'

export interface StepTypesProps {
  types: TypeCandidate[]
  templates: TemplateCandidate[]
  onFinish: (updated: TypeCandidate[]) => void
  onBack: () => void
  isSubmitting: boolean
  error: boolean
}

export function StepTypes({
  types,
  templates,
  onFinish,
  onBack,
  isSubmitting,
  error,
}: StepTypesProps): JSX.Element {
  const [local, setLocal] = useState<TypeCandidate[]>(types)

  function updateName(i: number, name: string): void {
    setLocal((prev) => prev.map((t, idx) => (idx === i ? { ...t, name } : t)))
  }

  function updateTemplate(i: number, templateClientId: string): void {
    setLocal((prev) => prev.map((t, idx) => (idx === i ? { ...t, templateClientId } : t)))
  }

  function remove(i: number): void {
    setLocal((prev) => prev.filter((_, idx) => idx !== i))
  }

  function addBlank(): void {
    setLocal((prev) => [...prev, { name: '', templateClientId: templates[0]?.clientId ?? '' }])
  }

  const canFinish =
    local.length > 0 &&
    local.every((t) => t.name.trim().length > 0 && t.templateClientId.length > 0)

  return (
    <div>
      <h2 className="text-h2 mb-2">{onboardingCustomizeStrings.step2Title}</h2>
      <p className="text-body text-n-600 mb-6">{onboardingCustomizeStrings.step2Desc}</p>

      {error && (
        <div className="mb-4">
          <Callout variant="danger" icon={<i className="ph ph-warning" style={{ fontSize: 18 }} />}>
            {onboardingCustomizeStrings.error}
          </Callout>
        </div>
      )}

      <div className="flex flex-col gap-2 mb-4">
        {local.map((t, i) => (
          <div
            key={i}
            className="flex items-center gap-3 bg-n-0 border border-n-200 rounded-md px-4 py-3"
          >
            <i className="ph ph-tag text-[16px] text-p-500 shrink-0" />
            <input
              className="flex-1 bg-transparent border-0 p-0 text-[13px] text-n-800 placeholder:text-n-400 focus:outline-none"
              value={t.name}
              placeholder={onboardingCustomizeStrings.step2TypePlaceholder}
              onChange={(e) => updateName(i, e.target.value)}
            />
            <select
              className="flex-1 text-[12px] h-[34px] border border-n-300 rounded-sm bg-n-0 px-3 text-n-800 focus:outline-none focus:border-p-500"
              value={t.templateClientId}
              onChange={(e) => updateTemplate(i, e.target.value)}
            >
              {templates.map((tmpl) => (
                <option key={tmpl.clientId} value={tmpl.clientId}>
                  {tmpl.name}
                </option>
              ))}
            </select>
            <Button
              variant="ghost"
              size="sm"
              className="w-[28px] px-0"
              onClick={() => remove(i)}
              title={onboardingCustomizeStrings.step2DeleteLabel}
            >
              <i className="ph ph-trash text-[15px] text-danger-text" />
            </Button>
          </div>
        ))}
      </div>

      {local.length === 0 && (
        <p className="text-caption text-warning-text mb-4">
          {onboardingCustomizeStrings.step2Empty}
        </p>
      )}

      <Button variant="ghost" size="sm" onClick={addBlank} className="mb-8">
        {onboardingCustomizeStrings.step2Add}
      </Button>

      <div className="flex justify-between items-center">
        <Button variant="secondary" onClick={onBack} disabled={isSubmitting}>
          {onboardingCustomizeStrings.step2Back}
        </Button>
        <Button
          variant="primary"
          disabled={!canFinish || isSubmitting}
          onClick={() => onFinish(local)}
        >
          {isSubmitting
            ? onboardingCustomizeStrings.loading
            : onboardingCustomizeStrings.step2Finish}
        </Button>
      </div>
    </div>
  )
}
