import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOnboardingCustom, useOnboardingStarters } from '@/hooks/onboarding/use-onboarding'
import type { StarterCandidate } from '@/hooks/onboarding/use-onboarding'
import { StepDots } from './StepDots'
import { StepTemplates } from './StepTemplates'
import { StepTypes } from './StepTypes'
import type { TemplateCandidate, TypeCandidate } from './types'

export function OnboardingCustomize(): JSX.Element {
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

  function handleStep1Continue(updated: TemplateCandidate[]): void {
    setTemplates(updated)
    const defaultTypes: TypeCandidate[] = updated.map((t, i) => ({
      name: starters?.[i]?.typeName ?? t.name,
      templateClientId: t.clientId,
    }))
    setTypes(defaultTypes)
    setStep(2)
  }

  async function handleFinish(finalTypes: TypeCandidate[]): Promise<void> {
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
            onBack={() => setStep(1)}
            isSubmitting={customMutation.isPending}
            error={customMutation.isError}
          />
        )}
      </div>
    </div>
  )
}
