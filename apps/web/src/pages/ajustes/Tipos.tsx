import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useProtocolTypes,
  useCreateProtocolType,
  useUpdateProtocolType,
  useDeleteProtocolType,
} from '@/hooks/protocol-types/use-protocol-types'
import { useProtocolTemplates } from '@/hooks/protocol-templates/use-protocol-templates'
import { strings } from '@/lib/strings'
import type { ProtocolTypeDto } from '@rezeta/shared'
import {
  Button,
  Badge,
  EmptyState,
  Callout,
  Field,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '@/components/ui'

// ─── Create Modal ─────────────────────────────────────────────────────────────

function CreateTypeModal({ onClose }: { onClose: () => void }) {
  const { data: templates, isLoading: templatesLoading } = useProtocolTemplates()
  const createMutation = useCreateProtocolType()
  const [name, setName] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await createMutation.mutateAsync({ name, templateId })
      onClose()
    } catch {
      setError('No se pudo crear el tipo. Verifica que el nombre no esté en uso.')
    }
  }

  const canSubmit = name.trim().length > 0 && templateId.length > 0

  return (
    <Modal
      open={true}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <ModalContent>
        <ModalHeader title={strings.TYPES_CREATE_TITLE} showClose={false} />
        <form
          onSubmit={(e) => {
            void handleSubmit(e)
          }}
        >
          <ModalBody className="flex flex-col gap-4">
            <Field label={strings.TYPES_CREATE_FIELD_NAME} required>
              <Input
                type="text"
                placeholder={strings.TYPES_CREATE_FIELD_NAME_PLACEHOLDER}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </Field>
            <Field label={strings.TYPES_CREATE_FIELD_TEMPLATE} required>
              <select
                className="w-full h-input-md px-3 text-[13px] font-sans bg-n-0 text-n-700 border border-n-300 rounded-sm outline-none transition-[border-color] duration-[100ms] focus:border-p-500 disabled:bg-n-50 disabled:text-n-400 disabled:cursor-not-allowed"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                disabled={templatesLoading}
              >
                <option value="">{strings.TYPES_CREATE_FIELD_TEMPLATE_PLACEHOLDER}</option>
                {templates?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
            {error && (
              <Callout
                variant="danger"
                icon={<i className="ph ph-warning" style={{ fontSize: 16 }} />}
              >
                {error}
              </Callout>
            )}
          </ModalBody>
          <ModalFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              {strings.TYPES_CREATE_CANCEL}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!canSubmit || createMutation.isPending}
            >
              {createMutation.isPending
                ? strings.TYPES_CREATE_SUBMITTING
                : strings.TYPES_CREATE_SUBMIT}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  )
}

// ─── Rename Modal ─────────────────────────────────────────────────────────────

function RenameTypeModal({ type, onClose }: { type: ProtocolTypeDto; onClose: () => void }) {
  const updateMutation = useUpdateProtocolType(type.id)
  const [name, setName] = useState(type.name)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (name.trim() === type.name) {
      onClose()
      return
    }
    setError(null)
    try {
      await updateMutation.mutateAsync({ name: name.trim() })
      onClose()
    } catch {
      setError('No se pudo renombrar el tipo. Verifica que el nombre no esté en uso.')
    }
  }

  return (
    <Modal
      open={true}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <ModalContent>
        <ModalHeader title={strings.TYPES_RENAME_TITLE} showClose={false} />
        <form
          onSubmit={(e) => {
            void handleSubmit(e)
          }}
        >
          <ModalBody>
            <Field label={strings.TYPES_RENAME_FIELD}>
              <Input type="text" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </Field>
            {error && (
              <div className="mt-3">
                <Callout
                  variant="danger"
                  icon={<i className="ph ph-warning" style={{ fontSize: 16 }} />}
                >
                  {error}
                </Callout>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              {strings.TYPES_RENAME_CANCEL}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={name.trim().length === 0 || updateMutation.isPending}
            >
              {updateMutation.isPending
                ? strings.TYPES_RENAME_SUBMITTING
                : strings.TYPES_RENAME_SUBMIT}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function Tipos(): JSX.Element {
  const { data: types, isLoading, isError } = useProtocolTypes()
  const deleteMutation = useDeleteProtocolType()
  const navigate = useNavigate()
  const [showCreate, setShowCreate] = useState(false)
  const [renaming, setRenaming] = useState<ProtocolTypeDto | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDelete(t: ProtocolTypeDto) {
    if (t.isLocked) {
      alert(strings.TYPES_DELETE_LOCKED)
      return
    }
    if (!window.confirm(strings.TYPES_LIST_DELETE_CONFIRM(t.name))) return
    setDeletingId(t.id)
    try {
      await deleteMutation.mutateAsync(t.id)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div>
      {showCreate && <CreateTypeModal onClose={() => setShowCreate(false)} />}
      {renaming && <RenameTypeModal type={renaming} onClose={() => setRenaming(null)} />}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-h1 m-0">{strings.TYPES_PAGE_TITLE}</h1>
        <Button variant="primary" onClick={() => setShowCreate(true)}>
          <i className="ph ph-plus mr-1.5" />
          {strings.TYPES_NEW_BUTTON}
        </Button>
      </div>

      {isLoading && <p className="text-body text-n-500">{strings.TYPES_LOADING}</p>}

      {isError && (
        <Callout variant="danger" icon={<i className="ph ph-warning" style={{ fontSize: 18 }} />}>
          {strings.TYPES_ERROR}
        </Callout>
      )}

      {!isLoading && !isError && types?.length === 0 && (
        <EmptyState
          icon={<i className="ph ph-tag" />}
          title={strings.TYPES_EMPTY_TITLE}
          description={strings.TYPES_EMPTY_DESCRIPTION}
          action={
            <Button variant="primary" onClick={() => setShowCreate(true)}>
              {strings.TYPES_NEW_BUTTON}
            </Button>
          }
        />
      )}

      {!isLoading && !isError && (types?.length ?? 0) > 0 && (
        <div className="border border-n-200 rounded-md overflow-hidden">
          <table className="w-full border-collapse bg-n-0">
            <thead>
              <tr>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-2.5 text-left">
                  Nombre
                </th>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-2.5 text-left">
                  Plantilla base
                </th>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-2.5 text-left">
                  Estado
                </th>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-2.5 text-left">
                  Protocolos
                </th>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-2.5 text-left"></th>
              </tr>
            </thead>
            <tbody>
              {types!.map((t) => (
                <tr key={t.id} className="hover:bg-n-25">
                  <td className="text-[13px] px-4 py-3 border-b border-n-100 font-semibold text-n-800">
                    {t.name}
                    {t.isSeeded && (
                      <span className="ml-2 text-[11px] font-mono text-n-400 uppercase tracking-[0.06em]">
                        Predeterminado
                      </span>
                    )}
                  </td>
                  <td className="text-[13px] px-4 py-3 border-b border-n-100 text-n-500">
                    <button
                      className="inline-flex items-center gap-1 text-[13px] text-n-500 hover:text-n-800 transition-colors duration-[100ms]"
                      onClick={() => void navigate(`/ajustes/plantillas/${t.templateId}/edit`)}
                    >
                      {t.templateName}
                      <i className="ph ph-arrow-square-out text-[12px]" />
                    </button>
                  </td>
                  <td className="text-[13px] px-4 py-3 border-b border-n-100">
                    {t.isLocked ? (
                      <Badge variant="review">{strings.TYPES_LOCKED_BADGE(t.protocolCount)}</Badge>
                    ) : (
                      <Badge variant="active">{strings.TYPES_ACTIVE_BADGE}</Badge>
                    )}
                  </td>
                  <td className="text-[13px] px-4 py-3 border-b border-n-100 font-mono text-n-500">
                    {t.protocolCount}
                  </td>
                  <td className="text-[13px] px-4 py-3 border-b border-n-100">
                    <div className="flex gap-2 justify-end">
                      <Button variant="secondary" size="sm" onClick={() => setRenaming(t)}>
                        {strings.TYPES_LIST_EDIT}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-[28px] px-0"
                        title={strings.TYPES_LIST_DELETE}
                        disabled={t.isLocked || deletingId === t.id}
                        onClick={() => void handleDelete(t)}
                      >
                        <i
                          className="ph ph-trash text-[15px]"
                          style={{
                            color: t.isLocked ? 'var(--color-n-300)' : 'var(--color-danger-text)',
                          }}
                        />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
