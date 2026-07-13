import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { useOnboardingDefault } from '@/hooks/onboarding/use-onboarding'
import { onboardingStrings } from './strings'
import { Button, Callout, Spinner } from '@/components/ui'

export function Onboarding(): JSX.Element {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const defaultMutation = useOnboardingDefault()
  const { mutate } = defaultMutation

  useEffect(() => {
    mutate()
  }, [mutate])

  if (defaultMutation.isError) {
    return (
      <div className="min-h-screen bg-n-25 flex items-center justify-center p-8">
        <div className="w-full max-w-[560px]">
          <div className="w-touch-min h-touch-min bg-p-500 rounded-lg flex items-center justify-center font-serif text-h2 font-medium text-n-0 mb-6">
            R
          </div>
          <h1 className="text-h1 mb-4">
            {onboardingStrings.welcomeHeading(user?.fullName ?? null)}
          </h1>
          <div className="mb-6">
            <Callout
              variant="danger"
              icon={<i className="ph ph-warning" style={{ fontSize: 18 }} />}
            >
              {onboardingStrings.error}
            </Callout>
          </div>
          <Button
            variant="primary"
            size="lg"
            className="w-full justify-center mb-3 text-n-0"
            onClick={() => mutate()}
          >
            {onboardingStrings.retryLabel}
          </Button>
          <div className="text-center mt-4">
            <Button
              variant="ghost"
              className="text-n-600 text-sm"
              onClick={() => void navigate('/bienvenido/personalizar')}
            >
              {onboardingStrings.customizeLink}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-n-25 flex items-center justify-center p-8">
      <div className="w-full max-w-[560px] text-center">
        <div className="w-touch-min h-touch-min bg-p-500 rounded-lg flex items-center justify-center font-serif text-h2 font-medium text-n-0 mb-6 mx-auto">
          R
        </div>
        <Spinner size="lg" className="text-p-500 mb-4 block" decorative />
        <p className="text-body-sm text-n-500">{onboardingStrings.loading}</p>
      </div>
    </div>
  )
}
