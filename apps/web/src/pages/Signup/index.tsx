import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { SignUpSchema, type SignUpDto } from '@rezeta/shared'
import { useAuthStore } from '@/store/auth.store'
import { signupStrings } from './strings'
import { authClient } from '@/lib/auth'
import { Card, Field, Input, Button, Callout } from '@/components/ui'

function isSafeRedirect(path: string | null): path is string {
  if (!path) return false
  if (!path.startsWith('/')) return false
  if (path.startsWith('//')) return false
  if (path.includes('://')) return false
  return true
}

export function Signup(): JSX.Element {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { signUp } = useAuthStore()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpDto>({
    resolver: zodResolver(SignUpSchema),
  })

  async function onSubmit(data: SignUpDto) {
    setServerError(null)
    try {
      await signUp(data.email, data.password)
      const redirectTo = searchParams.get('redirectTo')
      const destination = isSafeRedirect(redirectTo) ? redirectTo : '/dashboard'
      void navigate(destination, { replace: true })
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? ''
      setServerError(authClient.errorCodeToMessage(code))
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-n-25 p-8">
      <Card className="w-full max-w-[400px]">
        <div className="mb-6 text-center">
          <div className="w-touch-min h-touch-min bg-p-500 rounded-lg flex items-center justify-center font-serif text-[24px] font-medium text-n-0 mx-auto mb-4">
            R
          </div>
          <h1 className="text-h2">{signupStrings.title}</h1>
          <p className="text-body-sm mt-1">{signupStrings.subtitle}</p>
        </div>

        <form
          onSubmit={(e) => {
            void handleSubmit(onSubmit)(e)
          }}
          className="flex flex-col gap-4"
          noValidate
        >
          <Field label={signupStrings.fieldEmail} error={errors.email?.message}>
            <Input
              id="signup-email"
              type="email"
              error={!!errors.email}
              placeholder={signupStrings.fieldEmailPlaceholder}
              autoComplete="email"
              {...register('email')}
            />
          </Field>

          <Field label={signupStrings.fieldPassword} error={errors.password?.message}>
            <Input
              id="signup-password"
              type="password"
              error={!!errors.password}
              placeholder={signupStrings.fieldPasswordPlaceholder}
              autoComplete="new-password"
              {...register('password')}
            />
          </Field>

          <Field label={signupStrings.fieldConfirmPassword} error={errors.confirmPassword?.message}>
            <Input
              id="signup-confirm"
              type="password"
              error={!!errors.confirmPassword}
              placeholder={signupStrings.fieldConfirmPasswordPlaceholder}
              autoComplete="new-password"
              {...register('confirmPassword')}
            />
          </Field>

          {serverError && (
            <Callout variant="danger" icon={<i className="ph ph-warning" />}>
              {serverError}
            </Callout>
          )}

          <Button
            variant="primary"
            size="lg"
            type="submit"
            disabled={isSubmitting}
            className="w-full justify-center text-n-0"
          >
            {isSubmitting ? signupStrings.submitting : signupStrings.submit}
          </Button>

          <p className="text-body-sm text-center mt-2">
            {signupStrings.haveAccount}{' '}
            <Link
              to="/login"
              className="text-p-500 font-medium hover:text-p-700 transition-colors duration-[100ms]"
            >
              {signupStrings.loginLink}
            </Link>
          </p>
        </form>
      </Card>
    </div>
  )
}
