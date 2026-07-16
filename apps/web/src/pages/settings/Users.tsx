import { useState } from 'react'
import type { ManagedUserDto, UserRoleValue } from '@rezeta/shared'
import {
  useUsers,
  useCreateUser,
  useSetUserActive,
} from '@/hooks/users/use-users'
import { useCan } from '@/hooks/use-can'
import { logger } from '@/lib/logger'
import { usersStrings } from './strings'
import {
  Button,
  Badge,
  EmptyState,
  Callout,
  Field,
  Input,
  NativeSelect,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '@/components/ui'

// ─── Create Modal ─────────────────────────────────────────────────────────────

function CreateUserModal({ onClose }: { onClose: () => void }): JSX.Element {
  const createMutation = useCreateUser()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRoleValue>('assistant')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setError(null)
    try {
      await createMutation.mutateAsync({ email, fullName, role })
      onClose()
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      logger.error(error.message, { stack: error.stack, context: 'Users.submit' })
      setError(usersStrings.createError)
    }
  }

  const canSubmit = fullName.trim().length > 0 && email.trim().length > 0

  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <ModalContent>
        <ModalHeader title={usersStrings.formTitle} showClose={false} />
        <form
          onSubmit={(e) => {
            void handleSubmit(e)
          }}
        >
          <ModalBody className="flex flex-col gap-4">
            <Field label={usersStrings.nameLabel} required>
              <Input
                type="text"
                placeholder={usersStrings.namePlaceholder}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoFocus
              />
            </Field>
            <Field label={usersStrings.emailLabel} required>
              <Input
                type="email"
                placeholder={usersStrings.emailPlaceholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label={usersStrings.roleLabel}>
              <NativeSelect
                aria-label={usersStrings.roleLabel}
                value={role}
                onChange={(e) => setRole(e.target.value as UserRoleValue)}
              >
                <option value="assistant">{usersStrings.roleAssistant}</option>
                <option value="doctor">{usersStrings.roleDoctor}</option>
                <option value="admin">{usersStrings.roleAdmin}</option>
                <option value="super_admin">{usersStrings.roleSuperAdmin}</option>
              </NativeSelect>
            </Field>
            {error && (
              <Callout variant="danger" icon={<i className="ph ph-warning" />}>
                {error}
              </Callout>
            )}
          </ModalBody>
          <ModalFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              {usersStrings.cancelButton}
            </Button>
            <Button type="submit" variant="primary" disabled={!canSubmit || createMutation.isPending}>
              {createMutation.isPending ? usersStrings.creatingButton : usersStrings.createButton}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  )
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ user }: { user: ManagedUserDto }): JSX.Element {
  if (!user.isActive) {
    return <Badge variant="archived">{usersStrings.statusInactive}</Badge>
  }
  if (user.status === 'invited') {
    return <Badge variant="review">{usersStrings.statusInvited}</Badge>
  }
  return <Badge variant="active">{usersStrings.statusActive}</Badge>
}

// ─── Roster row ───────────────────────────────────────────────────────────────

function UserRow({ user }: { user: ManagedUserDto }): JSX.Element {
  const setActiveMutation = useSetUserActive(user.id)
  const [pendingError, setPendingError] = useState<string | null>(null)

  function handleToggleActive(): void {
    setPendingError(null)
    void setActiveMutation.mutateAsync({ isActive: !user.isActive }).catch((err: unknown) => {
      const error = err instanceof Error ? err : new Error(String(err))
      logger.error(error.message, { stack: error.stack, context: 'Users.setActive' })
      setPendingError(usersStrings.createError)
    })
  }

  return (
    <tr className="hover:bg-n-25">
      <td className="text-sm px-4 py-3 border-b border-n-100 font-semibold text-n-800">
        {user.fullName ?? user.email}
      </td>
      <td className="text-sm px-4 py-3 border-b border-n-100">{user.email}</td>
      <td className="text-sm px-4 py-3 border-b border-n-100">{roleLabel(user.role)}</td>
      <td className="text-sm px-4 py-3 border-b border-n-100">
        <StatusBadge user={user} />
        {pendingError && <p className="text-xs text-danger-text mt-1">{pendingError}</p>}
      </td>
      <td className="text-sm px-4 py-3 border-b border-n-100">
        <div className="flex justify-end">
          <Button
            variant="secondary"
            size="sm"
            disabled={setActiveMutation.isPending}
            onClick={handleToggleActive}
          >
            {user.isActive ? usersStrings.deactivateButton : usersStrings.activateButton}
          </Button>
        </div>
      </td>
    </tr>
  )
}

function roleLabel(role: UserRoleValue): string {
  switch (role) {
    case 'assistant':
      return usersStrings.roleAssistant
    case 'doctor':
      return usersStrings.roleDoctor
    case 'admin':
      return usersStrings.roleAdmin
    case 'super_admin':
      return usersStrings.roleSuperAdmin
  }
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function Users(): JSX.Element {
  const canManage = useCan('users', 'manage')
  const { data: users, isLoading, isError } = useUsers()
  const [showCreate, setShowCreate] = useState(false)

  if (!canManage) {
    return (
      <div>
        <h1 className="text-h1 mb-6">{usersStrings.pageTitle}</h1>
        <EmptyState
          icon={<i className="ph ph-lock" />}
          title={usersStrings.noAccessTitle}
          description={usersStrings.noAccessDescription}
        />
      </div>
    )
  }

  return (
    <div>
      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} />}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-h1 m-0">{usersStrings.pageTitle}</h1>
        <Button variant="primary" onClick={() => setShowCreate(true)}>
          <i className="ph ph-plus mr-2" />
          {usersStrings.newButton}
        </Button>
      </div>

      {isLoading && <p className="text-body text-n-500">{usersStrings.loading}</p>}

      {isError && (
        <Callout variant="danger" icon={<i className="ph ph-warning" />}>
          {usersStrings.loadError}
        </Callout>
      )}

      {!isLoading && !isError && (users?.length ?? 0) === 0 && (
        <EmptyState
          icon={<i className="ph ph-users" />}
          title={usersStrings.emptyTitle}
          description={usersStrings.emptyDescription}
          action={
            <Button variant="primary" onClick={() => setShowCreate(true)}>
              {usersStrings.newButton}
            </Button>
          }
        />
      )}

      {!isLoading && !isError && (users?.length ?? 0) > 0 && (
        <div className="border border-n-200 rounded-md overflow-hidden">
          <table className="w-full border-collapse bg-n-0">
            <thead>
              <tr>
                <th className="bg-n-50 text-overline font-semibold uppercase tracking-label text-n-600 px-4 py-3 text-left">
                  {usersStrings.tableName}
                </th>
                <th className="bg-n-50 text-overline font-semibold uppercase tracking-label text-n-600 px-4 py-3 text-left">
                  {usersStrings.tableEmail}
                </th>
                <th className="bg-n-50 text-overline font-semibold uppercase tracking-label text-n-600 px-4 py-3 text-left">
                  {usersStrings.tableRole}
                </th>
                <th className="bg-n-50 text-overline font-semibold uppercase tracking-label text-n-600 px-4 py-3 text-left">
                  {usersStrings.tableStatus}
                </th>
                <th className="bg-n-50 text-overline font-semibold uppercase tracking-label text-n-600 px-4 py-3 text-left"></th>
              </tr>
            </thead>
            <tbody>
              {users!.map((u) => (
                <UserRow key={u.id} user={u} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
