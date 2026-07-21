import { useState } from 'react'
import type { PlatformUserApiDto } from '@rezeta/shared'
import {
  Badge,
  Button,
  Callout,
  EmptyState,
  Field,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Spinner,
} from '@/components/ui'
import { logger } from '@/lib/logger'
import { useStaffMe } from '@/hooks/staff/use-staff-me'
import {
  useCreatePlatformUser,
  useResendPlatformUserInvite,
  useSetPlatformUserActive,
  useStaffPlatformUsers,
} from '@/hooks/staff/use-platform-users'
import { platformUsersStrings as s } from './strings'

function CreateUserModal({ onClose }: { onClose: () => void }): JSX.Element {
  const createMutation = useCreatePlatformUser()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState(false)
  const canSubmit = fullName.trim().length >= 2 && email.includes('@')

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!canSubmit) return
    setError(false)
    try {
      await createMutation.mutateAsync({ fullName: fullName.trim(), email: email.trim() })
      onClose()
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      logger.error(error.message, { stack: error.stack, context: 'PlatformUsers.create' })
      setError(true)
    }
  }

  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <ModalContent>
        <ModalHeader title={s.formTitle} showClose={false} />
        <form
          onSubmit={(e) => {
            void handleSubmit(e)
          }}
        >
          <ModalBody className="flex flex-col gap-4">
            <Field label={s.nameLabel} required>
              <Input
                type="text"
                placeholder={s.namePlaceholder}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoFocus
              />
            </Field>
            <Field label={s.emailLabel} required>
              <Input
                type="email"
                placeholder={s.emailPlaceholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <p className="text-xs text-n-500">{s.linkNote}</p>
            {error && (
              <Callout variant="danger" compact>
                {s.createError}
              </Callout>
            )}
          </ModalBody>
          <ModalFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              {s.cancelButton}
            </Button>
            <Button type="submit" variant="primary" disabled={!canSubmit || createMutation.isPending}>
              {createMutation.isPending ? s.creatingButton : s.createButton}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  )
}

function UserRow({ user, isSelf }: { user: PlatformUserApiDto; isSelf: boolean }): JSX.Element {
  const setActive = useSetPlatformUserActive(user.id)
  const resend = useResendPlatformUserInvite(user.id)
  const [actionError, setActionError] = useState(false)

  function run(promise: Promise<unknown>): void {
    setActionError(false)
    promise.catch((err: unknown) => {
      const error = err instanceof Error ? err : new Error(String(err))
      logger.error(error.message, { stack: error.stack, context: 'PlatformUsers.action' })
      setActionError(true)
    })
  }

  const statusLabel = !user.isActive
    ? s.statusDeactivated
    : user.status === 'invited'
      ? s.statusInvited
      : s.statusActive
  const statusVariant = !user.isActive ? 'archived' : user.status === 'invited' ? 'review' : 'active'

  return (
    <tr className="border-t border-n-100">
      <td className="px-4 py-3">
        <span className="font-medium text-n-800">{user.fullName ?? user.email}</span>
        <span className="block text-xs text-n-500">{user.email}</span>
      </td>
      <td className="px-4 py-3">
        <Badge variant={statusVariant}>{statusLabel}</Badge>
      </td>
      <td className="px-4 py-3 text-sm text-n-600">
        {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : s.neverAccessed}
      </td>
      <td className="px-4 py-3 text-right">
        {isSelf ? (
          <Badge variant="active">{s.youChip}</Badge>
        ) : (
          <span className="inline-flex gap-2">
            {user.isActive && user.status === 'invited' && (
              <Button
                variant="secondary"
                size="sm"
                disabled={resend.isPending}
                onClick={() => run(resend.mutateAsync())}
              >
                {s.resendButton}
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              disabled={setActive.isPending}
              onClick={() => run(setActive.mutateAsync({ isActive: !user.isActive }))}
            >
              {user.isActive ? s.deactivateButton : s.reactivateButton}
            </Button>
          </span>
        )}
        {actionError && <span className="block text-xs text-danger-text">{s.actionError}</span>}
      </td>
    </tr>
  )
}

export function PlatformUsers(): JSX.Element {
  const { data: me } = useStaffMe()
  const { data: users, isLoading, isError } = useStaffPlatformUsers()
  const [showCreate, setShowCreate] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-h2 font-serif font-medium text-n-900">{s.pageTitle}</h1>
          <p className="text-sm text-n-500">{s.pageSubtitle}</p>
        </div>
        <Button variant="primary" onClick={() => setShowCreate(true)}>
          {s.newUserButton}
        </Button>
      </div>

      {isLoading && <Spinner />}
      {isError && <Callout variant="danger">{s.loadError}</Callout>}

      {users && users.length === 0 && (
        <EmptyState icon={<i className="ph ph-users" />} title={s.emptyTitle} description={s.emptyBody} />
      )}

      {users && users.length > 0 && (
        <div className="border border-n-200 rounded-md overflow-hidden">
          <table className="w-full border-collapse bg-n-0">
            <thead>
              <tr>
                <th className="bg-n-50 text-overline font-semibold uppercase tracking-label text-n-600 px-4 py-3 text-left">
                  {s.tableUser}
                </th>
                <th className="bg-n-50 text-overline font-semibold uppercase tracking-label text-n-600 px-4 py-3 text-left">
                  {s.tableStatus}
                </th>
                <th className="bg-n-50 text-overline font-semibold uppercase tracking-label text-n-600 px-4 py-3 text-left">
                  {s.tableLastAccess}
                </th>
                <th className="bg-n-50 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <UserRow key={u.id} user={u} isSelf={u.id === me?.id} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
