import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useProtocolTemplates,
  useDeleteProtocolTemplate,
} from '@/hooks/protocol-templates/use-protocol-templates'
import { strings } from '@/lib/strings'
import type { ProtocolTemplateDto } from '@rezeta/shared'
import { Button, Badge, EmptyState, Callout } from '@/components/ui'

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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-h1 m-0">{strings.TEMPLATES_PAGE_TITLE}</h1>
        <Button variant="primary" onClick={() => void navigate('/ajustes/plantillas/new')}>
          <i className="ph ph-plus mr-2" />
          {strings.TEMPLATES_NEW_BUTTON}
        </Button>
      </div>

      {isLoading && <p className="text-body text-n-500">{strings.TEMPLATES_LOADING}</p>}

      {isError && (
        <Callout variant="danger" icon={<i className="ph ph-warning" style={{ fontSize: 18 }} />}>
          {strings.TEMPLATES_ERROR}
        </Callout>
      )}

      {!isLoading && !isError && templates?.length === 0 && (
        <EmptyState
          icon={<i className="ph ph-file-text" />}
          title={strings.TEMPLATES_EMPTY_TITLE}
          description={strings.TEMPLATES_EMPTY_DESCRIPTION}
          action={
            <Button variant="primary" onClick={() => void navigate('/ajustes/plantillas/new')}>
              {strings.TEMPLATES_NEW_BUTTON}
            </Button>
          }
        />
      )}

      {!isLoading && !isError && (templates?.length ?? 0) > 0 && (
        <div className="border border-n-200 rounded-md overflow-hidden">
          <table className="w-full border-collapse bg-n-0">
            <thead>
              <tr>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-3 text-left">
                  Nombre
                </th>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-3 text-left">
                  Especialidad
                </th>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-3 text-left">
                  Estado
                </th>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-3 text-left">
                  Actualizado
                </th>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-3 text-left"></th>
              </tr>
            </thead>
            <tbody>
              {templates!.map((t) => (
                <tr key={t.id} className="hover:bg-n-25">
                  <td className="text-[13px] px-4 py-3 border-b border-n-100 font-semibold text-n-800">
                    {t.name}
                    {t.isSeeded && (
                      <span className="ml-2 text-[11px] font-mono text-n-400 uppercase tracking-[0.06em]">
                        {strings.TEMPLATES_LIST_SEEDED}
                      </span>
                    )}
                  </td>
                  <td className="text-[13px] px-4 py-3 border-b border-n-100 text-n-500">
                    {t.suggestedSpecialty ?? '—'}
                  </td>
                  <td className="text-[13px] px-4 py-3 border-b border-n-100">
                    {t.isLocked ? (
                      <Badge variant="review">
                        {strings.TEMPLATES_LIST_BLOCKED_BY(t.blockingTypeIds?.length ?? 0)}
                      </Badge>
                    ) : (
                      <Badge variant="active">Activa</Badge>
                    )}
                  </td>
                  <td className="text-[12px] px-4 py-3 border-b border-n-100 font-mono text-n-500">
                    {new Date(t.updatedAt).toLocaleDateString('es-DO', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="text-[13px] px-4 py-3 border-b border-n-100">
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void navigate(`/ajustes/plantillas/${t.id}/edit`)}
                      >
                        {t.isLocked ? 'Ver' : strings.TEMPLATES_LIST_EDIT}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-[28px] px-0"
                        title={strings.TEMPLATES_LIST_DELETE}
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
