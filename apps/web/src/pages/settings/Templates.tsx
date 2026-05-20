import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  useProtocolTemplates,
  useDeleteProtocolTemplate,
} from '@/hooks/protocol-templates/use-protocol-templates'
import { templatesStrings } from './strings'
import type { ProtocolTemplateDto } from '@rezeta/shared'
import { Button, Badge, EmptyState, Callout, ConfirmDialog } from '@/components/ui'

export function Templates(): JSX.Element {
  const { data: templates, isLoading, isError } = useProtocolTemplates()
  const deleteMutation = useDeleteProtocolTemplate()
  const navigate = useNavigate()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProtocolTemplateDto | null>(null)

  function handleDelete(t: ProtocolTemplateDto) {
    if (t.isLocked) {
      toast.error(templatesStrings.deleteLocked)
      return
    }
    setDeleteTarget(t)
  }

  function confirmDelete() {
    if (!deleteTarget) return
    setDeletingId(deleteTarget.id)
    void deleteMutation.mutateAsync(deleteTarget.id).finally(() => {
      setDeletingId(null)
      setDeleteTarget(null)
    })
  }

  return (
    <div>
      <ConfirmDialog
        open={!!deleteTarget}
        title={templatesStrings.listDelete}
        description={templatesStrings.listDeleteConfirm(deleteTarget?.name ?? '')}
        confirmLabel={templatesStrings.listDelete}
        variant="danger"
        loading={deleteMutation.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-h1 m-0">{templatesStrings.pageTitle}</h1>
        <Button variant="primary" onClick={() => void navigate('/ajustes/plantillas/new')}>
          <i className="ph ph-plus mr-2" />
          {templatesStrings.newButton}
        </Button>
      </div>

      {isLoading && <p className="text-body text-n-500">{templatesStrings.loading}</p>}

      {isError && (
        <Callout variant="danger" icon={<i className="ph ph-warning" style={{ fontSize: 18 }} />}>
          {templatesStrings.error}
        </Callout>
      )}

      {!isLoading && !isError && templates?.length === 0 && (
        <EmptyState
          icon={<i className="ph ph-file-text" />}
          title={templatesStrings.emptyTitle}
          description={templatesStrings.emptyDescription}
          action={
            <Button variant="primary" onClick={() => void navigate('/ajustes/plantillas/new')}>
              {templatesStrings.newButton}
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
                        {templatesStrings.listSeeded}
                      </span>
                    )}
                  </td>
                  <td className="text-[13px] px-4 py-3 border-b border-n-100 text-n-500">
                    {t.suggestedSpecialty ?? '—'}
                  </td>
                  <td className="text-[13px] px-4 py-3 border-b border-n-100">
                    {t.isLocked ? (
                      <Badge variant="review">
                        {templatesStrings.listBlockedBy(t.blockingTypeIds?.length ?? 0)}
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
                        {t.isLocked ? 'Ver' : templatesStrings.listEdit}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-[28px] px-0"
                        title={templatesStrings.listDelete}
                        disabled={t.isLocked || deletingId === t.id}
                        onClick={() => handleDelete(t)}
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
