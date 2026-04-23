import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { useOnboardingDefault } from '@/hooks/onboarding/use-onboarding'
import { strings } from '@/lib/strings'

export function Bienvenido(): JSX.Element {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const defaultMutation = useOnboardingDefault()

  async function handleDefault() {
    await defaultMutation.mutateAsync()
    void navigate('/dashboard', { replace: true })
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--color-n-25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-8)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 560 }}>
        {/* Brand mark */}
        <div
          style={{
            width: 44,
            height: 44,
            background: 'var(--color-p-500)',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-serif)',
            fontSize: 24,
            fontWeight: 500,
            color: 'white',
            marginBottom: 'var(--space-6)',
          }}
        >
          R
        </div>

        <h1 className="text-h1" style={{ marginBottom: 'var(--space-4)' }}>
          {strings.ONBOARDING_WELCOME_HEADING(user?.fullName ?? null)}
        </h1>
        <p className="text-body" style={{ color: 'var(--color-n-600)', marginBottom: 'var(--space-8)' }}>
          {strings.ONBOARDING_WELCOME_LEAD}
        </p>

        {defaultMutation.isError && (
          <div className="callout callout--danger" style={{ marginBottom: 'var(--space-6)' }}>
            <i className="ph ph-warning" style={{ fontSize: 18 }} />
            <div className="callout__body">{strings.ONBOARDING_ERROR}</div>
          </div>
        )}

        {/* Primary CTA */}
        <button
          className="btn btn--primary btn--lg"
          style={{ width: '100%', marginBottom: 'var(--space-3)' }}
          disabled={defaultMutation.isPending}
          onClick={() => { void handleDefault() }}
        >
          {defaultMutation.isPending ? strings.ONBOARDING_LOADING : strings.ONBOARDING_DEFAULT_CTA}
        </button>

        <p
          className="text-caption"
          style={{ color: 'var(--color-n-500)', textAlign: 'center', marginBottom: 'var(--space-8)' }}
        >
          {strings.ONBOARDING_DEFAULT_HELPER}
        </p>

        {/* Secondary link */}
        <div style={{ textAlign: 'center' }}>
          <button
            className="btn btn--ghost"
            style={{ color: 'var(--color-n-600)', fontSize: 13 }}
            onClick={() => void navigate('/bienvenido/personalizar')}
          >
            {strings.ONBOARDING_CUSTOMIZE_LINK}
          </button>
        </div>
      </div>
    </div>
  )
}
