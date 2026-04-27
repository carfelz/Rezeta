import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { strings, firebaseErrorToSpanish } from '@/lib/strings'
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
      console.log(err)
      const code = (err as { code?: string }).code ?? ''
      setError(firebaseErrorToSpanish(code))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-n-25 p-8">
      <Card className="w-full max-w-[400px]">
        <div className="mb-6 text-center">
          <div className="w-[44px] h-touch-min bg-p-500 rounded-lg flex items-center justify-center font-serif text-[24px] font-medium text-n-0 mx-auto mb-4">
            R
          </div>
          <h1 className="text-h2">{strings.LOGIN_TITLE}</h1>
          <p className="text-body-sm mt-1">{strings.LOGIN_SUBTITLE}</p>
        </div>

        <form
          onSubmit={(e) => {
            void handleSubmit(e)
          }}
          className="flex flex-col gap-4"
        >
          <Field label={strings.LOGIN_FIELD_EMAIL}>
            <Input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={strings.LOGIN_FIELD_EMAIL_PLACEHOLDER}
              autoComplete="email"
              required
            />
          </Field>

          <Field label={strings.LOGIN_FIELD_PASSWORD}>
            <Input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={strings.LOGIN_FIELD_PASSWORD_PLACEHOLDER}
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
            {isLoading ? strings.LOGIN_SUBMITTING : strings.LOGIN_SUBMIT}
          </Button>

          <p className="text-body-sm text-center mt-2">
            {strings.LOGIN_NO_ACCOUNT}{' '}
            <Link
              to="/signup"
              className="text-p-500 font-medium hover:text-p-700 transition-colors duration-[100ms]"
            >
              {strings.LOGIN_SIGNUP_LINK}
            </Link>
          </p>
        </form>
      </Card>
    </div>
  )
}
