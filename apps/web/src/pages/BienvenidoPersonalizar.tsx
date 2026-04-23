import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOnboardingStarters, useOnboardingCustom } from '@/hooks/onboarding/use-onboarding'
import type { StarterCandidate } from '@/hooks/onboarding/use-onboarding'
import { strings } from '@/lib/strings'

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
    setLocal((prev) => [...prev, { clientId: id, name: '', schema: { version: '1.0', blocks: [] } }])
  }

  const canContinue = local.length > 0 && local.every((t) => t.name.trim().length > 0)

  return (
    <div>
      <h2 className="text-h2" style={{ marginBottom: 'var(--space-2)' }}>
        {strings.ONBOARDING_STEP1_TITLE}
      </h2>
      <p className="text-body" style={{ color: 'var(--color-n-600)', marginBottom: 'var(--space-6)' }}>
        {strings.ONBOARDING_STEP1_DESC}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
        {local.map((t) => (
          <div
            key={t.clientId}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              background: 'var(--color-n-0)',
              border: 'var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-3) var(--space-4)',
            }}
          >
            <i className="ph ph-file-text" style={{ fontSize: 16, color: 'var(--color-p-500)', flexShrink: 0 }} />
            <input
              className="input"
              style={{ flex: 1, border: 'none', padding: 0, background: 'transparent', boxShadow: 'none' }}
              value={t.name}
              placeholder="Nombre de la plantilla"
              onChange={(e) => updateName(t.clientId, e.target.value)}
            />
            <button
              className="btn btn--ghost btn--icon-only btn--sm"
              onClick={() => remove(t.clientId)}
              title="Eliminar"
            >
              <i className="ph ph-trash" style={{ fontSize: 15, color: 'var(--color-danger-text)' }} />
            </button>
          </div>
        ))}
      </div>

      {local.length === 0 && (
        <p className="text-caption" style={{ color: 'var(--color-warning-text)', marginBottom: 'var(--space-4)' }}>
          {strings.ONBOARDING_STEP1_EMPTY}
        </p>
      )}

      <button className="btn btn--ghost btn--sm" onClick={addBlank} style={{ marginBottom: 'var(--space-8)' }}>
        {strings.ONBOARDING_STEP1_ADD}
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="btn btn--secondary" onClick={onBack}>
          {strings.ONBOARDING_STEP1_BACK}
        </button>
        <button className="btn btn--primary" disabled={!canContinue} onClick={() => onContinue(local)}>
          {strings.ONBOARDING_STEP1_CONTINUE}
        </button>
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
    setLocal((prev) => [
      ...prev,
      { name: '', templateClientId: templates[0]?.clientId ?? '' },
    ])
  }

  const canFinish =
    local.length > 0 &&
    local.every((t) => t.name.trim().length > 0 && t.templateClientId.length > 0)

  return (
    <div>
      <h2 className="text-h2" style={{ marginBottom: 'var(--space-2)' }}>
        {strings.ONBOARDING_STEP2_TITLE}
      </h2>
      <p className="text-body" style={{ color: 'var(--color-n-600)', marginBottom: 'var(--space-6)' }}>
        {strings.ONBOARDING_STEP2_DESC}
      </p>

      {error && (
        <div className="callout callout--danger" style={{ marginBottom: 'var(--space-4)' }}>
          <i className="ph ph-warning" style={{ fontSize: 18 }} />
          <div className="callout__body">{strings.ONBOARDING_ERROR}</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
        {local.map((t, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              background: 'var(--color-n-0)',
              border: 'var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-3) var(--space-4)',
            }}
          >
            <i className="ph ph-tag" style={{ fontSize: 16, color: 'var(--color-p-500)', flexShrink: 0 }} />
            <input
              className="input"
              style={{ flex: 1, border: 'none', padding: 0, background: 'transparent', boxShadow: 'none' }}
              value={t.name}
              placeholder="Nombre del tipo"
              onChange={(e) => updateName(i, e.target.value)}
            />
            <select
              className="input"
              style={{ flex: 1, fontSize: 12 }}
              value={t.templateClientId}
              onChange={(e) => updateTemplate(i, e.target.value)}
            >
              {templates.map((tmpl) => (
                <option key={tmpl.clientId} value={tmpl.clientId}>
                  {tmpl.name}
                </option>
              ))}
            </select>
            <button
              className="btn btn--ghost btn--icon-only btn--sm"
              onClick={() => remove(i)}
              title="Eliminar"
            >
              <i className="ph ph-trash" style={{ fontSize: 15, color: 'var(--color-danger-text)' }} />
            </button>
          </div>
        ))}
      </div>

      {local.length === 0 && (
        <p className="text-caption" style={{ color: 'var(--color-warning-text)', marginBottom: 'var(--space-4)' }}>
          {strings.ONBOARDING_STEP2_EMPTY}
        </p>
      )}

      <button className="btn btn--ghost btn--sm" onClick={addBlank} style={{ marginBottom: 'var(--space-8)' }}>
        {strings.ONBOARDING_STEP2_ADD}
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="btn btn--secondary" onClick={onBack} disabled={isSubmitting}>
          {strings.ONBOARDING_STEP2_BACK}
        </button>
        <button
          className="btn btn--primary"
          disabled={!canFinish || isSubmitting}
          onClick={() => onFinish(local)}
        >
          {isSubmitting ? strings.ONBOARDING_LOADING : strings.ONBOARDING_STEP2_FINISH}
        </button>
      </div>
    </div>
  )
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepDots({ current }: { current: 1 | 2 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
      {[1, 2].map((n) => (
        <div
          key={n}
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: n === current ? 'var(--color-p-500)' : 'var(--color-n-300)',
          }}
        />
      ))}
      <span className="text-caption" style={{ marginLeft: 'var(--space-2)', color: 'var(--color-n-500)' }}>
        {current === 1 ? 'Plantillas' : 'Tipos'}
      </span>
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

  // Initialize candidates from starters once loaded
  const initialTemplates: TemplateCandidate[] = starters
    ? starters.map((s: StarterCandidate) => ({ clientId: s.clientId, name: s.name, schema: s.schema }))
    : []
  const activeTemplates = templates ?? initialTemplates

  function handleStep1Continue(updated: TemplateCandidate[]) {
    setTemplates(updated)
    // Build default types: one per template, using starter typeName if available
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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-n-25)' }}>
        <p className="text-body-sm" style={{ color: 'var(--color-n-500)' }}>Cargando...</p>
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--color-n-25)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: 'var(--space-16) var(--space-8)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 560 }}>
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
            onFinish={(finalTypes) => { void handleFinish(finalTypes) }}
            onBack={handleStep2Back}
            isSubmitting={customMutation.isPending}
            error={customMutation.isError}
          />
        )}
      </div>
    </div>
  )
}
