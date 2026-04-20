import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { SignUpSchema, type SignUpDto } from '@rezeta/shared'
import { useAuthStore } from '@/store/auth.store'
import { strings, firebaseErrorToSpanish } from '@/lib/strings'

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
      // onAuthStateChanged fires → AuthProvider calls provision → status: authenticated
      const redirectTo = searchParams.get('redirectTo')
      const destination = isSafeRedirect(redirectTo) ? redirectTo : '/dashboard'
      void navigate(destination, { replace: true })
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? ''
      setServerError(firebaseErrorToSpanish(code))
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
        {/* Brand header */}
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
          <h1 className="text-h2">{strings.SIGNUP_TITLE}</h1>
          <p className="text-body-sm" style={{ color: 'var(--color-n-500)', marginTop: 4 }}>
            {strings.SIGNUP_SUBTITLE}
          </p>
        </div>

        <form
          onSubmit={(e) => {
            void handleSubmit(onSubmit)(e)
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
          noValidate
        >
          {/* Email */}
          <div className="field">
            <label className="field__label" htmlFor="signup-email">
              {strings.SIGNUP_FIELD_EMAIL}
            </label>
            <input
              id="signup-email"
              className={`input${errors.email ? ' input--error' : ''}`}
              type="email"
              placeholder={strings.SIGNUP_FIELD_EMAIL_PLACEHOLDER}
              autoComplete="email"
              {...register('email')}
            />
            {errors.email && (
              <span className="field__error">
                <i className="ph ph-warning-circle" />
                {errors.email.message}
              </span>
            )}
          </div>

          {/* Password */}
          <div className="field">
            <label className="field__label" htmlFor="signup-password">
              {strings.SIGNUP_FIELD_PASSWORD}
            </label>
            <input
              id="signup-password"
              className={`input${errors.password ? ' input--error' : ''}`}
              type="password"
              placeholder={strings.SIGNUP_FIELD_PASSWORD_PLACEHOLDER}
              autoComplete="new-password"
              {...register('password')}
            />
            {errors.password && (
              <span className="field__error">
                <i className="ph ph-warning-circle" />
                {errors.password.message}
              </span>
            )}
          </div>

          {/* Confirm Password */}
          <div className="field">
            <label className="field__label" htmlFor="signup-confirm">
              {strings.SIGNUP_FIELD_CONFIRM_PASSWORD}
            </label>
            <input
              id="signup-confirm"
              className={`input${errors.confirmPassword ? ' input--error' : ''}`}
              type="password"
              placeholder={strings.SIGNUP_FIELD_CONFIRM_PASSWORD_PLACEHOLDER}
              autoComplete="new-password"
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && (
              <span className="field__error">
                <i className="ph ph-warning-circle" />
                {errors.confirmPassword.message}
              </span>
            )}
          </div>

          {/* Server error */}
          {serverError && (
            <div className="callout callout--danger">
              <i className="ph ph-warning" />
              <div className="callout__body">{serverError}</div>
            </div>
          )}

          <button className="btn btn--primary btn--lg" type="submit" disabled={isSubmitting}>
            {isSubmitting ? strings.SIGNUP_SUBMITTING : strings.SIGNUP_SUBMIT}
          </button>

          <p
            className="text-body-sm"
            style={{ textAlign: 'center', color: 'var(--color-n-500)', marginTop: 'var(--space-2)' }}
          >
            {strings.SIGNUP_HAVE_ACCOUNT}{' '}
            <Link
              to="/login"
              style={{ color: 'var(--color-p-500)', textDecoration: 'none', fontWeight: 500 }}
            >
              {strings.SIGNUP_LOGIN_LINK}
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
