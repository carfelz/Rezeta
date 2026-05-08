import { useState } from 'react'
import { Button } from '@/components/ui'
import { strings } from '@/lib/strings'
import type { TemplateCandidate } from './types'

export interface StepTemplatesProps {
  templates: TemplateCandidate[]
  onContinue: (updated: TemplateCandidate[]) => void
  onBack: () => void
}

export function StepTemplates({ templates, onContinue, onBack }: StepTemplatesProps): JSX.Element {
  const [local, setLocal] = useState<TemplateCandidate[]>(templates)

  function updateName(clientId: string, name: string): void {
    setLocal((prev) => prev.map((t) => (t.clientId === clientId ? { ...t, name } : t)))
  }

  function remove(clientId: string): void {
    setLocal((prev) => prev.filter((t) => t.clientId !== clientId))
  }

  function addBlank(): void {
    const id = `custom-${Date.now()}`
    setLocal((prev) => [
      ...prev,
      { clientId: id, name: '', schema: { version: '1.0', blocks: [] } },
    ])
  }

  const canContinue = local.length > 0 && local.every((t) => t.name.trim().length > 0)

  return (
    <div>
      <h2 className="text-h2 mb-2">{strings.ONBOARDING_STEP1_TITLE}</h2>
      <p className="text-body text-n-600 mb-6">{strings.ONBOARDING_STEP1_DESC}</p>

      <div className="flex flex-col gap-2 mb-4">
        {local.map((t) => (
          <div
            key={t.clientId}
            className="flex items-center gap-3 bg-n-0 border border-n-200 rounded-md px-4 py-3"
          >
            <i className="ph ph-file-text text-[16px] text-p-500 shrink-0" />
            <input
              className="flex-1 bg-transparent border-0 p-0 text-[13px] text-n-800 placeholder:text-n-400 focus:outline-none"
              value={t.name}
              placeholder="Nombre de la plantilla"
              onChange={(e) => updateName(t.clientId, e.target.value)}
            />
            <Button
              variant="ghost"
              size="sm"
              className="w-[28px] px-0"
              onClick={() => remove(t.clientId)}
              title="Eliminar"
            >
              <i className="ph ph-trash text-[15px] text-danger-text" />
            </Button>
          </div>
        ))}
      </div>

      {local.length === 0 && (
        <p className="text-caption text-warning-text mb-4">{strings.ONBOARDING_STEP1_EMPTY}</p>
      )}

      <Button variant="ghost" size="sm" onClick={addBlank} className="mb-8">
        {strings.ONBOARDING_STEP1_ADD}
      </Button>

      <div className="flex justify-between items-center">
        <Button variant="secondary" onClick={onBack}>
          {strings.ONBOARDING_STEP1_BACK}
        </Button>
        <Button variant="primary" disabled={!canContinue} onClick={() => onContinue(local)}>
          {strings.ONBOARDING_STEP1_CONTINUE}
        </Button>
      </div>
    </div>
  )
}
