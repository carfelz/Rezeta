import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { logger } from '@/lib/logger'
import { useMyDevices, useSignOutAllSessions } from '@/hooks/identity/use-my-devices'
import { Card, CardTitle, Button, ConfirmDialog, Callout } from '@/components/ui'
import { profileDevicesStrings as s } from './strings'

export function ProfileDevices(): JSX.Element {
  const { data: devices, isLoading } = useMyDevices()
  const signOutAll = useSignOutAllSessions()
  const { signOut } = useAuthStore()
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm(): Promise<void> {
    setError(null)
    try {
      await signOutAll.mutateAsync()
      setConfirming(false)
      await signOut()
      void navigate('/login', { replace: true })
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      logger.error(error.message, { stack: error.stack, context: 'ProfileDevices.signOutAll' })
      setError(s.signOutError)
    }
  }

  return (
    <Card className="max-w-560 mb-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <CardTitle>{s.sectionTitle}</CardTitle>
          <p className="text-xs text-n-500 mt-1">{s.sectionDescription}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setConfirming(true)}>
          <i className="ph ph-sign-out mr-1.5" />
          {s.signOutAllButton}
        </Button>
      </div>

      {error && (
        <Callout variant="danger" compact icon={<i className="ph ph-warning" />} className="mb-3">
          {error}
        </Callout>
      )}

      {isLoading && <p className="text-sm text-n-500">{s.loading}</p>}

      {!isLoading && (devices?.length ?? 0) === 0 && <p className="text-sm text-n-500">{s.emptyText}</p>}

      {!isLoading && (devices?.length ?? 0) > 0 && (
        <ul className="flex flex-col gap-2">
          {devices!.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between border-t border-n-100 pt-2 first:border-0 first:pt-0"
            >
              <span className="text-sm text-n-700 truncate">{d.userAgent ?? '—'}</span>
              <span className="text-xs font-mono text-n-400 shrink-0 ml-3">
                {s.lastSeen(new Date(d.lastSeenAt).toLocaleDateString('es-DO'))}
              </span>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={confirming}
        onConfirm={() => {
          void handleConfirm()
        }}
        onCancel={() => setConfirming(false)}
        title={s.confirmTitle}
        description={s.confirmDescription}
        confirmLabel={s.confirmButton}
        cancelLabel={s.cancelButton}
        variant="danger"
        loading={signOutAll.isPending}
      />
    </Card>
  )
}
