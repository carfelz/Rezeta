import { useState } from 'react'
import type { TotpEnrollment } from '@/lib/auth/auth-client.interface'
import { useAuthStore } from '@/store/auth.store'
import { logger } from '@/lib/logger'
import { authClient } from '@/lib/auth'
import { useSyncMfaEnrollment } from '@/hooks/identity/use-mfa'
import { Badge, Button, Callout, Card, CardTitle, ConfirmDialog, Field, Input } from '@/components/ui'
import { profileMfaStrings as s } from './strings'

type EnrollStep = 'idle' | 'verifying'

export function ProfileMfa(): JSX.Element {
  const { user, setUser } = useAuthStore()
  const syncMfa = useSyncMfaEnrollment()
  const [step, setStep] = useState<EnrollStep>('idle')
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmingRemove, setConfirmingRemove] = useState(false)

  const isEnrolled = Boolean(user?.mfaEnrolledAt)

  function resetEnrollFlow(): void {
    setStep('idle')
    setEnrollment(null)
    setCode('')
  }

  async function handleStartEnroll(): Promise<void> {
    setError(null)
    setBusy(true)
    try {
      const result = await authClient.enrollTotp()
      setEnrollment(result)
      setStep('verifying')
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      logger.error(error.message, { stack: error.stack, context: 'ProfileMfa.enrollTotp' })
      setError(s.enrollError)
    } finally {
      setBusy(false)
    }
  }

  async function handleVerify(): Promise<void> {
    if (!enrollment) return
    setError(null)
    setBusy(true)
    try {
      await enrollment.verify(code)
      const synced = await syncMfa.mutateAsync()
      if (user) setUser({ ...user, mfaEnrolledAt: synced.mfaEnrolledAt })
      resetEnrollFlow()
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      logger.error(error.message, { stack: error.stack, context: 'ProfileMfa.verify' })
      setError(s.verifyError)
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove(): Promise<void> {
    setError(null)
    try {
      await authClient.unenrollTotp()
      const synced = await syncMfa.mutateAsync()
      if (user) setUser({ ...user, mfaEnrolledAt: synced.mfaEnrolledAt })
      setConfirmingRemove(false)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      logger.error(error.message, { stack: error.stack, context: 'ProfileMfa.unenroll' })
      setError(s.removeError)
    }
  }

  return (
    <Card className="max-w-560 mb-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <CardTitle>{s.sectionTitle}</CardTitle>
          <p className="text-xs text-n-500 mt-1">{s.sectionDescription}</p>
        </div>
        {isEnrolled ? (
          <Badge variant="active">{s.statusEnrolled}</Badge>
        ) : (
          <Badge variant="draft">{s.statusNotEnrolled}</Badge>
        )}
      </div>

      {error && (
        <Callout variant="danger" compact icon={<i className="ph ph-warning" />} className="mb-3">
          {error}
        </Callout>
      )}

      {step === 'idle' && !isEnrolled && (
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => {
            void handleStartEnroll()
          }}
        >
          {s.configureButton}
        </Button>
      )}

      {step === 'idle' && isEnrolled && (
        <Button variant="secondary" size="sm" onClick={() => setConfirmingRemove(true)}>
          {s.removeButton}
        </Button>
      )}

      {step === 'verifying' && enrollment && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-n-500">{s.scanInstructions}</p>
          <div className="border border-n-200 rounded-md bg-n-25 p-3">
            <div className="text-2xs font-mono uppercase tracking-label-wide text-n-400 mb-1">
              {s.otpauthUrlLabel}
            </div>
            <div className="text-xs font-mono text-n-700 break-all">{enrollment.otpauthUrl}</div>
            <div className="text-2xs font-mono uppercase tracking-label-wide text-n-400 mt-3 mb-1">
              {s.secretLabel}
            </div>
            <div className="text-xs font-mono text-n-700 break-all">{enrollment.secret}</div>
          </div>
          <Field label={s.fieldCode} id="profile-mfa-code">
            <Input
              id="profile-mfa-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={s.fieldCodePlaceholder}
              autoComplete="one-time-code"
            />
          </Field>
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              disabled={busy || code.length === 0}
              onClick={() => {
                void handleVerify()
              }}
            >
              {s.verifyButton}
            </Button>
            <Button variant="secondary" size="sm" onClick={resetEnrollFlow}>
              {s.cancelButton}
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmingRemove}
        onConfirm={() => {
          void handleRemove()
        }}
        onCancel={() => setConfirmingRemove(false)}
        title={s.removeConfirmTitle}
        description={s.removeConfirmDescription}
        confirmLabel={s.removeConfirmButton}
        cancelLabel={s.cancelButton}
        variant="danger"
      />
    </Card>
  )
}
