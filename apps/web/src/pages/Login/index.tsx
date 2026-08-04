import { useRef, useState } from 'react'
import { useAuthStore } from '@/store/auth.store'
import { loginStrings } from './strings'
import { authClient } from '@/lib/auth'
import { fetchLoginMethods } from '@/hooks/identity/use-login-methods'
import type { LoginMethodsResponseDto } from '@rezeta/shared'
import { Card, Field, Input, Button, Callout } from '@/components/ui'

export function Login(): JSX.Element {
  const { signIn, signInWithGoogle, signInWithSso } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mfaChallenge, setMfaChallenge] = useState(false)
  const [totpCode, setTotpCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [ssoRoute, setSsoRoute] = useState<LoginMethodsResponseDto | null>(null)
  /** Tracks the email currently in the input, so a slow routing response for an email the user has since edited never overwrites the (already-reset) state. */
  const latestEmailRef = useRef('')

  const methods = ssoRoute?.methods ?? ['password', 'google']
  const ssoOnly = methods.includes('sso') && !methods.includes('password')
  const showGoogleButton = !ssoOnly && methods.includes('google')
  const showSsoSecondary = !ssoOnly && methods.includes('sso') && methods.includes('password')
  const ssoProviderId = ssoRoute?.ssoProviderId ?? null
  const ssoDisplayName = ssoRoute?.ssoDisplayName ?? ''

  /**
   * Shared success/error handling for every sign-in entry point (password,
   * Google popup, SSO popup). Signing in only updates the provider session —
   * where to go next is entirely PublicOnlyGate's call, made once `identity`
   * settles via resolveDestination. Navigating here, before identity has
   * resolved, is the race that produced the login loop this page used to own.
   */
  async function attemptSignIn(action: () => Promise<void>): Promise<void> {
    setError(null)
    setIsLoading(true)
    try {
      await action()
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

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (ssoOnly && ssoProviderId) {
      await attemptSignIn(() => signInWithSso(ssoProviderId))
      return
    }
    await attemptSignIn(() => signIn(email, password))
  }

  function handleGoogleSignIn(): void {
    void attemptSignIn(() => signInWithGoogle())
  }

  function handleSsoSignIn(providerId: string): void {
    void attemptSignIn(() => signInWithSso(providerId))
  }

  async function handleEmailBlur(): Promise<void> {
    if (mfaChallenge) return
    const requestEmail = email
    if (!requestEmail.trim()) return
    try {
      const result = await fetchLoginMethods(requestEmail)
      // The user may have edited the email while this request was in
      // flight — a stale response for an abandoned address must never
      // override the (already-reset) state for what's in the field now.
      if (latestEmailRef.current !== requestEmail) return
      setSsoRoute(result)
    } catch {
      // fetchLoginMethods already fails open internally; this is a defensive
      // backstop so an unexpected rejection never breaks the login form.
    }
  }

  async function handleMfaSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setError(null)
    setIsLoading(true)
    try {
      await authClient.completeTotpSignIn(totpCode)
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? ''
      setError(authClient.errorCodeToMessage(code))
    } finally {
      setIsLoading(false)
    }
  }

  function backToCredentials(): void {
    authClient.cancelTotpSignIn()
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
                onChange={(e) => {
                  latestEmailRef.current = e.target.value
                  setEmail(e.target.value)
                  setSsoRoute(null)
                }}
                onBlur={() => {
                  void handleEmailBlur()
                }}
                placeholder={loginStrings.fieldEmailPlaceholder}
                autoComplete="email"
                required
              />
            </Field>

            {!ssoOnly && (
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
            )}

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
              {ssoOnly
                ? loginStrings.continueWithSso(ssoDisplayName)
                : isLoading
                  ? loginStrings.submitting
                  : loginStrings.submit}
            </Button>

            {showSsoSecondary && ssoProviderId && (
              <Button
                variant="secondary"
                size="lg"
                type="button"
                disabled={isLoading}
                className="w-full justify-center"
                onClick={() => handleSsoSignIn(ssoProviderId)}
              >
                {loginStrings.continueWithSso(ssoDisplayName)}
              </Button>
            )}

            {showGoogleButton && (
              <>
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-n-200" />
                  <span className="text-xs text-n-500">{loginStrings.orDivider}</span>
                  <div className="h-px flex-1 bg-n-200" />
                </div>

                <Button
                  variant="secondary"
                  size="lg"
                  type="button"
                  disabled={isLoading}
                  className="w-full justify-center"
                  onClick={handleGoogleSignIn}
                >
                  {loginStrings.continueWithGoogle}
                </Button>
              </>
            )}
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
