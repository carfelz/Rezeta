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
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal__header">
          <div>
            <h2 className="modal__title">{strings.TYPES_CREATE_TITLE}</h2>
          </div>
        </div>
        <form onSubmit={(e) => { void handleSubmit(e) }}>
          <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="field">
              <label className="field__label">
                {strings.TYPES_CREATE_FIELD_NAME}
                <span className="field__required">*</span>
              </label>
              <input
                className="input"
                type="text"
                placeholder={strings.TYPES_CREATE_FIELD_NAME_PLACEHOLDER}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="field">
              <label className="field__label">
                {strings.TYPES_CREATE_FIELD_TEMPLATE}
                <span className="field__required">*</span>
              </label>
              <select
                className="input"
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
            </div>
            {error && (
              <div className="callout callout--danger">
                <i className="ph ph-warning" style={{ fontSize: 16 }} />
                <div className="callout__body">{error}</div>
              </div>
            )}
          </div>
          <div className="modal__footer">
            <button type="button" className="btn btn--secondary" onClick={onClose}>
              {strings.TYPES_CREATE_CANCEL}
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={!canSubmit || createMutation.isPending}
            >
              {createMutation.isPending ? strings.TYPES_CREATE_SUBMITTING : strings.TYPES_CREATE_SUBMIT}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Rename Modal ─────────────────────────────────────────────────────────────

function RenameTypeModal({ type, onClose }: { type: ProtocolTypeDto; onClose: () => void }) {
  const updateMutation = useUpdateProtocolType(type.id)
  const [name, setName] = useState(type.name)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (name.trim() === type.name) { onClose(); return }
    setError(null)
    try {
      await updateMutation.mutateAsync({ name: name.trim() })
      onClose()
    } catch {
      setError('No se pudo renombrar el tipo. Verifica que el nombre no esté en uso.')
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal__header">
          <div>
            <h2 className="modal__title">{strings.TYPES_RENAME_TITLE}</h2>
          </div>
        </div>
        <form onSubmit={(e) => { void handleSubmit(e) }}>
          <div className="modal__body">
            <div className="field">
              <label className="field__label">{strings.TYPES_RENAME_FIELD}</label>
              <input
                className="input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            {error && (
              <div className="callout callout--danger" style={{ marginTop: 'var(--space-3)' }}>
                <i className="ph ph-warning" style={{ fontSize: 16 }} />
                <div className="callout__body">{error}</div>
              </div>
            )}
          </div>
          <div className="modal__footer">
            <button type="button" className="btn btn--secondary" onClick={onClose}>
              {strings.TYPES_RENAME_CANCEL}
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={name.trim().length === 0 || updateMutation.isPending}
            >
              {updateMutation.isPending ? strings.TYPES_RENAME_SUBMITTING : strings.TYPES_RENAME_SUBMIT}
            </button>
          </div>
        </form>
      </div>
    </div>
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

      {/* Page header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-6)',
        }}
      >
        <h1 className="text-h1" style={{ margin: 0 }}>
          {strings.TYPES_PAGE_TITLE}
        </h1>
        <button className="btn btn--primary" onClick={() => setShowCreate(true)}>
          <i className="ph ph-plus" style={{ marginRight: 6 }} />
          {strings.TYPES_NEW_BUTTON}
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <p className="text-body" style={{ color: 'var(--color-n-500)' }}>
          {strings.TYPES_LOADING}
        </p>
      )}

      {/* Error */}
      {isError && (
        <div className="callout callout--danger">
          <i className="ph ph-warning" style={{ fontSize: 18 }} />
          <div className="callout__body">{strings.TYPES_ERROR}</div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && types?.length === 0 && (
        <div className="empty-state">
          <div className="empty-state__icon">
            <i className="ph ph-tag" />
          </div>
          <h3 className="empty-state__title">{strings.TYPES_EMPTY_TITLE}</h3>
          <p className="empty-state__description">{strings.TYPES_EMPTY_DESCRIPTION}</p>
          <button className="btn btn--primary" onClick={() => setShowCreate(true)}>
            {strings.TYPES_NEW_BUTTON}
          </button>
        </div>
      )}

      {/* Types table */}
      {!isLoading && !isError && (types?.length ?? 0) > 0 && (
        <table className="table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Plantilla base</th>
              <th>Estado</th>
              <th>Protocolos</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {types!.map((t) => (
              <tr key={t.id}>
                <td className="td--name">
                  {t.name}
                  {t.isSeeded && (
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: 11,
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--color-n-400)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                      }}
                    >
                      Predeterminado
                    </span>
                  )}
                </td>
                <td style={{ color: 'var(--color-n-500)', fontSize: 13 }}>
                  <button
                    className="btn btn--ghost btn--sm"
                    style={{ padding: '0 4px', height: 'auto', fontSize: 13, color: 'var(--color-n-500)' }}
                    onClick={() => void navigate(`/ajustes/plantillas/${t.templateId}/edit`)}
                  >
                    {t.templateName}
                    <i className="ph ph-arrow-square-out" style={{ fontSize: 12, marginLeft: 4 }} />
                  </button>
                </td>
                <td>
                  {t.isLocked ? (
                    <span className="badge badge--review">
                      <span className="badge__dot" />
                      {strings.TYPES_LOCKED_BADGE(t.protocolCount)}
                    </span>
                  ) : (
                    <span className="badge badge--active">
                      <span className="badge__dot" />
                      {strings.TYPES_ACTIVE_BADGE}
                    </span>
                  )}
                </td>
                <td style={{ color: 'var(--color-n-500)', fontSize: 13, fontFamily: 'var(--font-mono)' }}>
                  {t.protocolCount}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                    <button
                      className="btn btn--secondary btn--sm"
                      onClick={() => setRenaming(t)}
                    >
                      {strings.TYPES_LIST_EDIT}
                    </button>
                    <button
                      className="btn btn--ghost btn--sm btn--icon-only"
                      title={strings.TYPES_LIST_DELETE}
                      disabled={t.isLocked || deletingId === t.id}
                      onClick={() => void handleDelete(t)}
                    >
                      <i
                        className="ph ph-trash"
                        style={{
                          fontSize: 15,
                          color: t.isLocked ? 'var(--color-n-300)' : 'var(--color-danger-text)',
                        }}
                      />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
