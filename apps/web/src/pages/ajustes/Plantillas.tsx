import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useProtocolTemplates,
  useDeleteProtocolTemplate,
} from '@/hooks/protocol-templates/use-protocol-templates'
import { strings } from '@/lib/strings'
import type { ProtocolTemplateDto } from '@rezeta/shared'

export function Plantillas(): JSX.Element {
  const { data: templates, isLoading, isError } = useProtocolTemplates()
  const deleteMutation = useDeleteProtocolTemplate()
  const navigate = useNavigate()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDelete(t: ProtocolTemplateDto) {
    if (t.isLocked) {
      alert(strings.TEMPLATES_DELETE_LOCKED)
      return
    }
    if (!window.confirm(strings.TEMPLATES_LIST_DELETE_CONFIRM(t.name))) return
    setDeletingId(t.id)
    try {
      await deleteMutation.mutateAsync(t.id)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div>
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
          {strings.TEMPLATES_PAGE_TITLE}
        </h1>
        <button
          className="btn btn--primary"
          onClick={() => void navigate('/ajustes/plantillas/new')}
        >
          <i className="ph ph-plus" style={{ marginRight: 6 }} />
          {strings.TEMPLATES_NEW_BUTTON}
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <p className="text-body" style={{ color: 'var(--color-n-500)' }}>
          {strings.TEMPLATES_LOADING}
        </p>
      )}

      {/* Error */}
      {isError && (
        <div className="callout callout--danger">
          <i className="ph ph-warning" style={{ fontSize: 18 }} />
          <div className="callout__body">{strings.TEMPLATES_ERROR}</div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && templates?.length === 0 && (
        <div className="empty-state">
          <div className="empty-state__icon">
            <i className="ph ph-file-text" />
          </div>
          <h3 className="empty-state__title">{strings.TEMPLATES_EMPTY_TITLE}</h3>
          <p className="empty-state__description">{strings.TEMPLATES_EMPTY_DESCRIPTION}</p>
          <button
            className="btn btn--primary"
            onClick={() => void navigate('/ajustes/plantillas/new')}
          >
            {strings.TEMPLATES_NEW_BUTTON}
          </button>
        </div>
      )}

      {/* Template table */}
      {!isLoading && !isError && (templates?.length ?? 0) > 0 && (
        <table className="table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Especialidad</th>
              <th>Estado</th>
              <th>Actualizado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {templates!.map((t) => (
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
                      {strings.TEMPLATES_LIST_SEEDED}
                    </span>
                  )}
                </td>
                <td style={{ color: 'var(--color-n-500)', fontSize: 13 }}>
                  {t.suggestedSpecialty ?? '—'}
                </td>
                <td>
                  {t.isLocked ? (
                    <span className="badge badge--review">
                      <span className="badge__dot" />
                      {strings.TEMPLATES_LIST_BLOCKED_BY(t.blockingTypeIds?.length ?? 0)}
                    </span>
                  ) : (
                    <span className="badge badge--active">
                      <span className="badge__dot" />
                      Activa
                    </span>
                  )}
                </td>
                <td style={{ color: 'var(--color-n-500)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                  {new Date(t.updatedAt).toLocaleDateString('es-DO', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                    <button
                      className="btn btn--secondary btn--sm"
                      onClick={() => void navigate(`/ajustes/plantillas/${t.id}/edit`)}
                    >
                      {t.isLocked ? 'Ver' : strings.TEMPLATES_LIST_EDIT}
                    </button>
                    <button
                      className="btn btn--ghost btn--sm btn--icon-only"
                      title={strings.TEMPLATES_LIST_DELETE}
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
