import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { loginStrings } from './strings'
import { authClient } from '@/lib/auth'
import { Card, Field, Input, Button, Callout } from '@/components/ui'

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
  const [mfaChallenge, setMfaChallenge] = useState(false)
  const [totpCode, setTotpCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  function redirectAfterSuccess(): void {
    const redirectTo = searchParams.get('redirectTo')
    const destination = isSafeRedirect(redirectTo) ? redirectTo : '/dashboard'
    void navigate(destination, { replace: true })
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setError(null)
    setIsLoading(true)
    try {
      await signIn(email, password)
      redirectAfterSuccess()
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? ''
      if (code === 'auth/multi-factor-auth-required') {
        setMfaChallenge(true)
      } else {
        setError(authClient.errorCodeToMessage(code))
      }
    } finally {
      setIsLoading(false)
    }
  }

  async function handleMfaSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setError(null)
    setIsLoading(true)
    try {
      await authClient.completeTotpSignIn(totpCode)
      redirectAfterSuccess()
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? ''
      setError(authClient.errorCodeToMessage(code))
    } finally {
      setIsLoading(false)
    }
  }

  function backToCredentials(): void {
    setMfaChallenge(false)
    setTotpCode('')
    setError(null)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-n-25 p-8">
      <Card className="w-full max-w-400">
        <div className="mb-6 text-center">
          <div className="w-touch-min h-touch-min bg-p-500 rounded-lg flex items-center justify-center font-serif text-h2 font-medium text-n-0 mx-auto mb-4">
            R
          </div>
          <h1 className="text-h2">{mfaChallenge ? loginStrings.mfaTitle : loginStrings.title}</h1>
          <p className="text-body-sm mt-1">{mfaChallenge ? loginStrings.mfaSubtitle : loginStrings.subtitle}</p>
        </div>

        {!mfaChallenge && (
          <form
            onSubmit={(e) => {
              void handleSubmit(e)
            }}
            className="flex flex-col gap-4"
          >
            <Field label={loginStrings.fieldEmail} id="login-email">
              <Input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={loginStrings.fieldEmailPlaceholder}
                autoComplete="email"
                required
              />
            </Field>

            <Field label={loginStrings.fieldPassword} id="login-password">
              <Input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={loginStrings.fieldPasswordPlaceholder}
                autoComplete="current-password"
                required
              />
            </Field>

            {error && (
              <Callout variant="danger" icon={<i className="ph ph-warning" />}>
                {error}
              </Callout>
            )}

            <Button
              variant="primary"
              size="lg"
              type="submit"
              disabled={isLoading}
              className="w-full justify-center text-n-0"
            >
              {isLoading ? loginStrings.submitting : loginStrings.submit}
            </Button>
          </form>
        )}

        {mfaChallenge && (
          <form
            onSubmit={(e) => {
              void handleMfaSubmit(e)
            }}
            className="flex flex-col gap-4"
          >
            <Field label={loginStrings.mfaFieldCode} id="login-mfa-code">
              <Input
                id="login-mfa-code"
                type="text"
                inputMode="numeric"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                placeholder={loginStrings.mfaFieldCodePlaceholder}
                autoComplete="one-time-code"
                required
              />
            </Field>

            {error && (
              <Callout variant="danger" icon={<i className="ph ph-warning" />}>
                {error}
              </Callout>
            )}

            <Button
              variant="primary"
              size="lg"
              type="submit"
              disabled={isLoading || totpCode.length === 0}
              className="w-full justify-center text-n-0"
            >
              {isLoading ? loginStrings.mfaSubmitting : loginStrings.mfaSubmit}
            </Button>

            <button
              type="button"
              className="text-xs text-n-500 underline self-center"
              onClick={backToCredentials}
            >
              {loginStrings.mfaBackToLogin}
            </button>
          </form>
        )}
      </Card>
    </div>
  )
}
