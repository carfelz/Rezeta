import { useState } from 'react'
import type {
  CreateSsoConnectionDto,
  SsoConnectionDto,
  SsoTestResultDto,
  StaffInstitutionDto,
  UpdateSsoConnectionDto,
} from '@rezeta/shared'
import {
  Badge,
  Button,
  Callout,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  NativeSelect,
  Spinner,
} from '@/components/ui'
import { logger } from '@/lib/logger'
import { useStaffInstitutions } from '@/hooks/staff/use-institutions'
import {
  useCreateSsoConnection,
  useDeleteSsoConnection,
  useSetSsoConnectionStatus,
  useSsoConnections,
  useTestSsoConnection,
  useUpdateSsoConnection,
} from '@/hooks/identity/use-sso-connections'
import { ssoStrings as s } from './strings'

function parseDomains(raw: string): string[] {
  return raw
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean)
}

function CreateConnectionModal({
  institutions,
  onClose,
}: {
  institutions: StaffInstitutionDto[]
  onClose: () => void
}): JSX.Element {
  const createMutation = useCreateSsoConnection()
  const [tenantId, setTenantId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [issuerUrl, setIssuerUrl] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [domains, setDomains] = useState('')
  const [allowPassword, setAllowPassword] = useState(true)
  const [error, setError] = useState(false)

  const domainList = parseDomains(domains)
  const canSubmit =
    tenantId !== '' &&
    displayName.trim().length > 0 &&
    issuerUrl.trim().length > 0 &&
    clientId.trim().length > 0 &&
    clientSecret.trim().length > 0 &&
    domainList.length > 0

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!canSubmit) return
    setError(false)
    const payload: CreateSsoConnectionDto = {
      tenantId,
      displayName: displayName.trim(),
      issuerUrl: issuerUrl.trim(),
      clientId: clientId.trim(),
      clientSecret,
      domains: domainList,
      allowPassword,
    }
    try {
      await createMutation.mutateAsync(payload)
      onClose()
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      logger.error(error.message, { stack: error.stack, context: 'SsoConnections.create' })
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
      <ModalContent size="lg">
        <ModalHeader title={s.createFormTitle} showClose={false} />
        <form
          onSubmit={(e) => {
            void handleSubmit(e)
          }}
        >
          <ModalBody className="flex flex-col gap-4">
            <Field label={s.fieldTenant} required>
              <NativeSelect value={tenantId} onChange={(e) => setTenantId(e.target.value)}>
                <option value="">{s.fieldTenantPlaceholder}</option>
                {institutions.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.name ?? inst.id}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label={s.fieldDisplayName} required>
              <Input
                type="text"
                placeholder={s.fieldDisplayNamePlaceholder}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoFocus
              />
            </Field>
            <Field label={s.fieldIssuerUrl} required>
              <Input
                type="text"
                placeholder={s.fieldIssuerUrlPlaceholder}
                value={issuerUrl}
                onChange={(e) => setIssuerUrl(e.target.value)}
              />
            </Field>
            <Field label={s.fieldClientId} required>
              <Input
                type="text"
                placeholder={s.fieldClientIdPlaceholder}
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              />
            </Field>
            <Field label={s.fieldClientSecret} required>
              <Input
                type="password"
                placeholder={s.fieldClientSecretPlaceholder}
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
              />
            </Field>
            <Field label={s.fieldDomains} required helper={s.fieldDomainsHelper}>
              <Input
                type="text"
                placeholder={s.fieldDomainsPlaceholder}
                value={domains}
                onChange={(e) => setDomains(e.target.value)}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm text-n-700">
              <Checkbox
                checked={allowPassword}
                onChange={(e) => setAllowPassword(e.target.checked)}
              />
              {s.fieldAllowPassword}
            </label>
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

function EditConnectionModal({
  connection,
  onClose,
}: {
  connection: SsoConnectionDto
  onClose: () => void
}): JSX.Element {
  const updateMutation = useUpdateSsoConnection(connection.id)
  const [displayName, setDisplayName] = useState(connection.displayName)
  const [issuerUrl, setIssuerUrl] = useState(connection.issuerUrl)
  const [clientId, setClientId] = useState(connection.clientId)
  const [clientSecret, setClientSecret] = useState('')
  const [domains, setDomains] = useState(connection.domains.join(', '))
  const [allowPassword, setAllowPassword] = useState(connection.allowPassword)
  const [error, setError] = useState(false)

  const domainList = parseDomains(domains)
  const canSubmit =
    displayName.trim().length > 0 &&
    issuerUrl.trim().length > 0 &&
    clientId.trim().length > 0 &&
    domainList.length > 0

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!canSubmit) return
    setError(false)
    const payload: UpdateSsoConnectionDto = {
      displayName: displayName.trim(),
      issuerUrl: issuerUrl.trim(),
      clientId: clientId.trim(),
      domains: domainList,
      allowPassword,
    }
    if (clientSecret.trim().length > 0) {
      payload.clientSecret = clientSecret.trim()
    }
    try {
      await updateMutation.mutateAsync(payload)
      onClose()
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      logger.error(error.message, { stack: error.stack, context: 'SsoConnections.update' })
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
      <ModalContent size="lg">
        <ModalHeader title={s.editFormTitle} showClose={false} />
        <form
          onSubmit={(e) => {
            void handleSubmit(e)
          }}
        >
          <ModalBody className="flex flex-col gap-4">
            <Field label={s.fieldDisplayName} required>
              <Input
                type="text"
                placeholder={s.fieldDisplayNamePlaceholder}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoFocus
              />
            </Field>
            <Field label={s.fieldIssuerUrl} required>
              <Input
                type="text"
                placeholder={s.fieldIssuerUrlPlaceholder}
                value={issuerUrl}
                onChange={(e) => setIssuerUrl(e.target.value)}
              />
            </Field>
            <Field label={s.fieldClientId} required>
              <Input
                type="text"
                placeholder={s.fieldClientIdPlaceholder}
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              />
            </Field>
            <Field label={s.fieldClientSecret} helper={s.fieldClientSecretEditHelper}>
              <Input
                type="password"
                placeholder={s.fieldClientSecretPlaceholder}
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
              />
            </Field>
            <Field label={s.fieldDomains} required helper={s.fieldDomainsHelper}>
              <Input
                type="text"
                placeholder={s.fieldDomainsPlaceholder}
                value={domains}
                onChange={(e) => setDomains(e.target.value)}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm text-n-700">
              <Checkbox
                checked={allowPassword}
                onChange={(e) => setAllowPassword(e.target.checked)}
              />
              {s.fieldAllowPassword}
            </label>
            {error && (
              <Callout variant="danger" compact>
                {s.saveError}
              </Callout>
            )}
          </ModalBody>
          <ModalFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              {s.cancelButton}
            </Button>
            <Button type="submit" variant="primary" disabled={!canSubmit || updateMutation.isPending}>
              {updateMutation.isPending ? s.savingButton : s.saveButton}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  )
}

function ConnectionRow({ connection }: { connection: SsoConnectionDto }): JSX.Element {
  const setStatus = useSetSsoConnectionStatus(connection.id)
  const deleteMutation = useDeleteSsoConnection(connection.id)
  const testMutation = useTestSsoConnection(connection.id)
  const [showEdit, setShowEdit] = useState(false)
  const [confirmStatus, setConfirmStatus] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [testResult, setTestResult] = useState<SsoTestResultDto | null>(null)
  const [actionError, setActionError] = useState(false)

  const isActive = connection.status === 'active'

  async function handleTest(): Promise<void> {
    setActionError(false)
    try {
      const result = await testMutation.mutateAsync()
      setTestResult(result)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      logger.error(error.message, { stack: error.stack, context: 'SsoConnections.test' })
      setActionError(true)
    }
  }

  async function handleConfirmStatus(): Promise<void> {
    setActionError(false)
    try {
      await setStatus.mutateAsync({ status: isActive ? 'disabled' : 'active' })
      setConfirmStatus(false)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      logger.error(error.message, { stack: error.stack, context: 'SsoConnections.status' })
      setActionError(true)
    }
  }

  async function handleConfirmDelete(): Promise<void> {
    setActionError(false)
    try {
      await deleteMutation.mutateAsync()
      setConfirmDelete(false)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      logger.error(error.message, { stack: error.stack, context: 'SsoConnections.delete' })
      setActionError(true)
    }
  }

  return (
    <>
      <tr className="border-t border-n-100">
        <td className="px-4 py-3 text-sm text-n-800">{connection.tenantName ?? s.fieldTenantPlaceholder}</td>
        <td className="px-4 py-3">
          <span className="font-medium text-n-800">{connection.displayName}</span>
          <span className="block text-xs text-n-500">{connection.clientId}</span>
        </td>
        <td className="px-4 py-3 text-sm text-n-600">{connection.domains.join(', ')}</td>
        <td className="px-4 py-3">
          <Badge variant={isActive ? 'active' : 'archived'}>
            {isActive ? s.statusActive : s.statusDisabled}
          </Badge>
        </td>
        <td className="px-4 py-3 text-sm text-n-600">
          {connection.allowPassword ? s.passwordAllowed : s.passwordBlocked}
        </td>
        <td className="px-4 py-3 text-right">
          <span className="inline-flex flex-wrap justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={testMutation.isPending}
              onClick={() => void handleTest()}
            >
              {testMutation.isPending ? s.testingButton : s.testButton}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowEdit(true)}>
              {s.editButton}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setConfirmStatus(true)}>
              {isActive ? s.deactivateButton : s.activateButton}
            </Button>
            <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
              {s.deleteButton}
            </Button>
          </span>
          {actionError && <span className="block text-xs text-danger-text">{s.actionError}</span>}
          {testResult &&
            (testResult.ok ? (
              <Callout variant="success" compact className="mt-2 text-left">
                {s.testSuccessChecks(testResult.checked)}
              </Callout>
            ) : (
              <Callout variant="danger" compact className="mt-2 text-left">
                {testResult.failure ?? s.testFailureTitle}
              </Callout>
            ))}
        </td>
      </tr>

      {showEdit && <EditConnectionModal connection={connection} onClose={() => setShowEdit(false)} />}

      <ConfirmDialog
        open={confirmStatus}
        onConfirm={() => void handleConfirmStatus()}
        onCancel={() => setConfirmStatus(false)}
        title={isActive ? s.confirmDeactivateTitle : s.confirmActivateTitle}
        description={
          isActive
            ? s.confirmDeactivateBody(connection.displayName)
            : s.confirmActivateBody(connection.displayName)
        }
        variant={isActive ? 'danger' : 'primary'}
        loading={setStatus.isPending}
        confirmLabel={s.confirmButton}
        cancelLabel={s.cancelButton}
      />

      <ConfirmDialog
        open={confirmDelete}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setConfirmDelete(false)}
        title={s.confirmDeleteTitle}
        description={s.confirmDeleteBody(connection.displayName)}
        variant="danger"
        loading={deleteMutation.isPending}
        confirmLabel={s.confirmButton}
        cancelLabel={s.cancelButton}
      />
    </>
  )
}

export function SsoConnections(): JSX.Element {
  const { data: connections, isLoading, isError } = useSsoConnections()
  const { data: institutions } = useStaffInstitutions()
  const [showCreate, setShowCreate] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-h2 font-serif font-medium text-n-900">{s.pageTitle}</h1>
          <p className="text-sm text-n-500">{s.pageSubtitle}</p>
        </div>
        <Button variant="primary" onClick={() => setShowCreate(true)}>
          {s.newButton}
        </Button>
      </div>

      {isLoading && <Spinner />}
      {isError && <Callout variant="danger">{s.loadError}</Callout>}

      {connections && connections.length === 0 && (
        <EmptyState icon={<i className="ph ph-shield-check" />} title={s.emptyTitle} description={s.emptyBody} />
      )}

      {connections && connections.length > 0 && (
        <div className="border border-n-200 rounded-md overflow-hidden">
          <table className="w-full border-collapse bg-n-0">
            <thead>
              <tr>
                <th className="bg-n-50 text-overline font-semibold uppercase tracking-label text-n-600 px-4 py-3 text-left">
                  {s.tableInstitution}
                </th>
                <th className="bg-n-50 text-overline font-semibold uppercase tracking-label text-n-600 px-4 py-3 text-left">
                  {s.tableName}
                </th>
                <th className="bg-n-50 text-overline font-semibold uppercase tracking-label text-n-600 px-4 py-3 text-left">
                  {s.tableDomains}
                </th>
                <th className="bg-n-50 text-overline font-semibold uppercase tracking-label text-n-600 px-4 py-3 text-left">
                  {s.tableStatus}
                </th>
                <th className="bg-n-50 text-overline font-semibold uppercase tracking-label text-n-600 px-4 py-3 text-left">
                  {s.tablePassword}
                </th>
                <th className="bg-n-50 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {connections.map((c) => (
                <ConnectionRow key={c.id} connection={c} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateConnectionModal
          institutions={institutions ?? []}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  )
}
