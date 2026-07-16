import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { authClient } from '@/lib/auth'
import { Card, Field, Input, Button, Callout } from '@/components/ui'
import { setPasswordStrings } from './strings'

export function SetPassword(): JSX.Element {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const oobCode = searchParams.get('oobCode') ?? ''

  const [email, setEmail] = useState<string | null>(null)
  const [linkValid, setLinkValid] = useState<boolean | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let active = true
    void (async () => {
      if (!oobCode) {
        if (active) setLinkValid(false)
        return
      }
      try {
        const verifiedEmail = await authClient.verifyPasswordResetCode(oobCode)
        if (!active) return
        setEmail(verifiedEmail)
        setLinkValid(true)
      } catch {
        if (active) setLinkValid(false)
      }
    })()
    return () => {
      active = false
    }
  }, [oobCode])

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError(setPasswordStrings.passwordTooShort)
      return
    }
    if (password !== confirm) {
      setError(setPasswordStrings.passwordMismatch)
      return
    }
    if (!email) return
    setSubmitting(true)
    try {
      await authClient.confirmPasswordReset(oobCode, password)
      await authClient.signIn(email, password)
      void navigate('/dashboard', { replace: true })
    } catch {
      setError(setPasswordStrings.genericError)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-n-25 p-8">
      <Card className="w-full max-w-400">
        <div className="mb-6 text-center">
          <div className="w-touch-min h-touch-min bg-p-500 rounded-lg flex items-center justify-center font-serif text-h2 font-medium text-n-0 mx-auto mb-4">
            R
          </div>
          <h1 className="text-h2">{setPasswordStrings.title}</h1>
          <p className="text-body-sm mt-1">{setPasswordStrings.subtitle}</p>
        </div>

        {linkValid === null && (
          <p className="text-body-sm text-center text-n-500">{setPasswordStrings.verifying}</p>
        )}

        {linkValid === false && (
          <Callout variant="danger" icon={<i className="ph ph-warning" />}>
            {setPasswordStrings.invalidLink}
          </Callout>
        )}

        {linkValid === true && (
          <form
            onSubmit={(e) => {
              void handleSubmit(e)
            }}
            className="flex flex-col gap-4"
          >
            <Field label={setPasswordStrings.fieldPassword}>
              <Input
                id="set-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={setPasswordStrings.fieldPasswordPlaceholder}
                autoComplete="new-password"
                autoFocus
              />
            </Field>

            <Field label={setPasswordStrings.fieldConfirm}>
              <Input
                id="set-password-confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder={setPasswordStrings.fieldConfirmPlaceholder}
                autoComplete="new-password"
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
              disabled={submitting}
              className="w-full justify-center text-n-0"
            >
              {submitting ? setPasswordStrings.submitting : setPasswordStrings.submit}
            </Button>
          </form>
        )}
      </Card>
    </div>
  )
}
