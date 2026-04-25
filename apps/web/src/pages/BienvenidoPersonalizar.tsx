import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOnboardingStarters, useOnboardingCustom } from '@/hooks/onboarding/use-onboarding'
import type { StarterCandidate } from '@/hooks/onboarding/use-onboarding'
import { strings } from '@/lib/strings'
import { Button, Callout } from '@/components/ui'

// ─── Types ───────────────────────────────────────────────────────────────────

interface TemplateCandidate {
  clientId: string
  name: string
  schema: object
}

interface TypeCandidate {
  name: string
  templateClientId: string
}

// ─── Step 1 — Templates ───────────────────────────────────────────────────────

function StepTemplates({
  templates,
  onContinue,
  onBack,
}: {
  templates: TemplateCandidate[]
  onContinue: (updated: TemplateCandidate[]) => void
  onBack: () => void
}) {
  const [local, setLocal] = useState<TemplateCandidate[]>(templates)

  function updateName(clientId: string, name: string) {
    setLocal((prev) => prev.map((t) => (t.clientId === clientId ? { ...t, name } : t)))
  }

  function remove(clientId: string) {
    setLocal((prev) => prev.filter((t) => t.clientId !== clientId))
  }

  function addBlank() {
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

// ─── Step 2 — Types ───────────────────────────────────────────────────────────

function StepTypes({
  types,
  templates,
  onFinish,
  onBack,
  isSubmitting,
  error,
}: {
  types: TypeCandidate[]
  templates: TemplateCandidate[]
  onFinish: (updated: TypeCandidate[]) => void
  onBack: () => void
  isSubmitting: boolean
  error: boolean
}) {
  const [local, setLocal] = useState<TypeCandidate[]>(types)

  function updateName(i: number, name: string) {
    setLocal((prev) => prev.map((t, idx) => (idx === i ? { ...t, name } : t)))
  }

  function updateTemplate(i: number, templateClientId: string) {
    setLocal((prev) => prev.map((t, idx) => (idx === i ? { ...t, templateClientId } : t)))
  }

  function remove(i: number) {
    setLocal((prev) => prev.filter((_, idx) => idx !== i))
  }

  function addBlank() {
    setLocal((prev) => [...prev, { name: '', templateClientId: templates[0]?.clientId ?? '' }])
  }

  const canFinish =
    local.length > 0 &&
    local.every((t) => t.name.trim().length > 0 && t.templateClientId.length > 0)

  return (
    <div>
      <h2 className="text-h2 mb-2">{strings.ONBOARDING_STEP2_TITLE}</h2>
      <p className="text-body text-n-600 mb-6">{strings.ONBOARDING_STEP2_DESC}</p>

      {error && (
        <div className="mb-4">
          <Callout variant="danger" icon={<i className="ph ph-warning" style={{ fontSize: 18 }} />}>
            {strings.ONBOARDING_ERROR}
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
              placeholder="Nombre del tipo"
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
              title="Eliminar"
            >
              <i className="ph ph-trash text-[15px] text-danger-text" />
            </Button>
          </div>
        ))}
      </div>

      {local.length === 0 && (
        <p className="text-caption text-warning-text mb-4">{strings.ONBOARDING_STEP2_EMPTY}</p>
      )}

      <Button variant="ghost" size="sm" onClick={addBlank} className="mb-8">
        {strings.ONBOARDING_STEP2_ADD}
      </Button>

      <div className="flex justify-between items-center">
        <Button variant="secondary" onClick={onBack} disabled={isSubmitting}>
          {strings.ONBOARDING_STEP2_BACK}
        </Button>
        <Button
          variant="primary"
          disabled={!canFinish || isSubmitting}
          onClick={() => onFinish(local)}
        >
          {isSubmitting ? strings.ONBOARDING_LOADING : strings.ONBOARDING_STEP2_FINISH}
        </Button>
      </div>
    </div>
  )
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepDots({ current }: { current: 1 | 2 }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {[1, 2].map((n) => (
        <div
          key={n}
          className={`w-2 h-2 rounded-full ${n === current ? 'bg-p-500' : 'bg-n-300'}`}
        />
      ))}
      <span className="text-caption text-n-500 ml-2">{current === 1 ? 'Plantillas' : 'Tipos'}</span>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function BienvenidoPersonalizar(): JSX.Element {
  const navigate = useNavigate()
  const { data: starters, isLoading } = useOnboardingStarters()
  const customMutation = useOnboardingCustom()

  const [step, setStep] = useState<1 | 2>(1)
  const [templates, setTemplates] = useState<TemplateCandidate[] | null>(null)
  const [types, setTypes] = useState<TypeCandidate[] | null>(null)

  const initialTemplates: TemplateCandidate[] = starters
    ? starters.map((s: StarterCandidate) => ({
        clientId: s.clientId,
        name: s.name,
        schema: s.schema,
      }))
    : []
  const activeTemplates = templates ?? initialTemplates

  function handleStep1Continue(updated: TemplateCandidate[]) {
    setTemplates(updated)
    const defaultTypes: TypeCandidate[] = updated.map((t, i) => ({
      name: starters?.[i]?.typeName ?? t.name,
      templateClientId: t.clientId,
    }))
    setTypes(defaultTypes)
    setStep(2)
  }

  function handleStep2Back() {
    setStep(1)
  }

  async function handleFinish(finalTypes: TypeCandidate[]) {
    await customMutation.mutateAsync({
      templates: activeTemplates.map((t) => ({
        clientId: t.clientId,
        name: t.name,
        schema: t.schema as { version: string; blocks: unknown[] },
      })),
      types: finalTypes,
    })
    void navigate('/dashboard', { replace: true })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-n-25">
        <p className="text-body-sm text-n-500">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-n-25 flex items-start justify-center pt-16 px-8">
      <div className="w-full max-w-[560px]">
        <StepDots current={step} />

        {step === 1 && (
          <StepTemplates
            templates={activeTemplates}
            onContinue={handleStep1Continue}
            onBack={() => void navigate('/bienvenido')}
          />
        )}

        {step === 2 && (
          <StepTypes
            types={types ?? []}
            templates={activeTemplates}
            onFinish={(finalTypes) => {
              void handleFinish(finalTypes)
            }}
            onBack={handleStep2Back}
            isSubmitting={customMutation.isPending}
            error={customMutation.isError}
          />
        )}
      </div>
    </div>
  )
}
