import { useState } from 'react'
import {
  Button,
  Callout,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
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
            <i className="ph ph-tag text-body-lg text-p-500 shrink-0" />
            <Input
              variant="ghost"
              className="flex-1 p-0"
              value={t.name}
              placeholder={onboardingCustomizeStrings.step2TypePlaceholder}
              onChange={(e) => updateName(i, e.target.value)}
            />
            <Select value={t.templateClientId} onValueChange={(v) => updateTemplate(i, v)}>
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {templates.map((tmpl) => (
                  <SelectItem key={tmpl.clientId} value={tmpl.clientId}>
                    {tmpl.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              className="w-btn-sm px-0"
              onClick={() => remove(i)}
              title={onboardingCustomizeStrings.step2DeleteLabel}
            >
              <i className="ph ph-trash text-base text-danger-text" />
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
