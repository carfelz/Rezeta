import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { strings, firebaseErrorToSpanish } from '@/lib/strings'

function isSafeRedirect(path: string | null): path is string {
  if (!path) return false
  if (!path.startsWith('/')) return false
  if (path.startsWith('//')) return false
  if (path.includes('://')) return false
  return true
}

export function Login(): JSX.Element {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { signIn } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsLoading(true)
    try {
      await signIn(email, password)
      const redirectTo = searchParams.get('redirectTo')
      const destination = isSafeRedirect(redirectTo) ? redirectTo : '/dashboard'
      void navigate(destination, { replace: true })
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? ''
      setError(firebaseErrorToSpanish(code))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-n-25)',
      }}
    >
      <div className="card" style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ marginBottom: 'var(--space-6)', textAlign: 'center' }}>
          <div
            style={{
              width: 44,
              height: 44,
              background: 'var(--color-p-500)',
              borderRadius: 8,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-serif)',
              fontSize: 24,
              fontWeight: 500,
              color: 'white',
              marginBottom: 'var(--space-4)',
            }}
          >
            R
          </div>
          <h1 className="text-h2">{strings.LOGIN_TITLE}</h1>
          <p className="text-body-sm" style={{ color: 'var(--color-n-500)', marginTop: 4 }}>
            {strings.LOGIN_SUBTITLE}
          </p>
        </div>

        <form
          onSubmit={(e) => {
            void handleSubmit(e)
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
        >
          <div className="field">
            <label className="field__label" htmlFor="login-email">
              {strings.LOGIN_FIELD_EMAIL}
            </label>
            <input
              id="login-email"
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={strings.LOGIN_FIELD_EMAIL_PLACEHOLDER}
              autoComplete="email"
              required
            />
          </div>

          <div className="field">
            <label className="field__label" htmlFor="login-password">
              {strings.LOGIN_FIELD_PASSWORD}
            </label>
            <input
              id="login-password"
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={strings.LOGIN_FIELD_PASSWORD_PLACEHOLDER}
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <div className="callout callout--danger">
              <i className="ph ph-warning" />
              <div className="callout__body">{error}</div>
            </div>
          )}

          <button className="btn btn--primary btn--lg" type="submit" disabled={isLoading}>
            {isLoading ? strings.LOGIN_SUBMITTING : strings.LOGIN_SUBMIT}
          </button>

          <p
            className="text-body-sm"
            style={{ textAlign: 'center', color: 'var(--color-n-500)', marginTop: 'var(--space-2)' }}
          >
            {strings.LOGIN_NO_ACCOUNT}{' '}
            <Link
              to="/signup"
              style={{ color: 'var(--color-p-500)', textDecoration: 'none', fontWeight: 500 }}
            >
              {strings.LOGIN_SIGNUP_LINK}
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
