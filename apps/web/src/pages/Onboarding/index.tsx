import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { useOnboardingDefault } from '@/hooks/onboarding/use-onboarding'
import { onboardingStrings } from './strings'
import { Button, Callout } from '@/components/ui'

export function Onboarding(): JSX.Element {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const defaultMutation = useOnboardingDefault()

  async function handleDefault() {
    await defaultMutation.mutateAsync()
    void navigate('/dashboard', { replace: true })
  }

  return (
    <div className="min-h-screen bg-n-25 flex items-center justify-center p-8">
      <div className="w-full max-w-[560px]">
        <div className="w-touch-min h-touch-min bg-p-500 rounded-lg flex items-center justify-center font-serif text-[24px] font-medium text-n-0 mb-6">
          R
        </div>

        <h1 className="text-h1 mb-4">{onboardingStrings.welcomeHeading(user?.fullName ?? null)}</h1>
        <p className="text-body text-n-600 mb-8">{onboardingStrings.welcomeLead}</p>

        {defaultMutation.isError && (
          <div className="mb-6">
            <Callout
              variant="danger"
              icon={<i className="ph ph-warning" style={{ fontSize: 18 }} />}
            >
              {onboardingStrings.error}
            </Callout>
          </div>
        )}

        <Button
          variant="primary"
          size="lg"
          className="w-full justify-center mb-3"
          disabled={defaultMutation.isPending}
          onClick={() => {
            void handleDefault()
          }}
        >
          {defaultMutation.isPending ? onboardingStrings.loading : onboardingStrings.defaultCta}
        </Button>

        <p className="text-caption text-n-500 text-center mb-8">
          {onboardingStrings.defaultHelper}
        </p>

        <div className="text-center">
          <Button
            variant="ghost"
            className="text-n-600 text-[13px]"
            onClick={() => void navigate('/bienvenido/personalizar')}
          >
            {onboardingStrings.customizeLink}
          </Button>
        </div>
      </div>
    </div>
  )
}
