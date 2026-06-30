import { useState } from 'react'
import { toast } from 'sonner'
import {
  useProtocolCategories,
  useCreateProtocolCategory,
  useUpdateProtocolCategory,
  useDeleteProtocolCategory,
  type ProtocolCategoryDto,
} from '@/hooks/protocol-categories/use-protocol-categories'
import { typesStrings } from './strings'
import { logger } from '@/lib/logger'
import { ApiRequestError } from '@/lib/api-client'
import {
  Button,
  Badge,
  EmptyState,
  Callout,
  ConfirmDialog,
  Field,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '@/components/ui'

// ─── Create Modal ─────────────────────────────────────────────────────────────

function CreateCategoryModal({ onClose }: { onClose: () => void }) {
  const createMutation = useCreateProtocolCategory()
  const [name, setName] = useState('')
  const [color, setColor] = useState('#6B7280')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await createMutation.mutateAsync({ name, color })
      onClose()
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      logger.error(error.message, { stack: error.stack, context: 'Types.create' })
      setError('No se pudo crear la categoría. Verifica que el nombre no esté en uso.')
    }
  }

  const canSubmit = name.trim().length > 0

  return (
    <Modal
      open={true}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <ModalContent>
        <ModalHeader title={typesStrings.createTitle} showClose={false} />
        <form
          onSubmit={(e) => {
            void handleSubmit(e)
          }}
        >
          <ModalBody className="flex flex-col gap-4">
            <Field label={typesStrings.createFieldName} required>
              <Input
                type="text"
                placeholder={typesStrings.createFieldNamePlaceholder}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </Field>
            <Field label={typesStrings.createFieldColor}>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-full rounded-sm border border-n-200 cursor-pointer"
              />
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
              {typesStrings.createCancel}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!canSubmit || createMutation.isPending}
            >
              {createMutation.isPending ? typesStrings.createSubmitting : typesStrings.createSubmit}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  )
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

function EditCategoryModal({
  category,
  onClose,
}: {
  category: ProtocolCategoryDto
  onClose: () => void
}) {
  const updateMutation = useUpdateProtocolCategory(category.id)
  const [name, setName] = useState(category.name)
  const [color, setColor] = useState(category.color)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmedName = name.trim()
    if (trimmedName === category.name && color === category.color) {
      onClose()
      return
    }
    setError(null)
    try {
      await updateMutation.mutateAsync({ name: trimmedName, color })
      onClose()
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      logger.error(error.message, { stack: error.stack, context: 'Types.edit' })
      setError('No se pudo guardar la categoría. Verifica que el nombre no esté en uso.')
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
        <ModalHeader title={typesStrings.editTitle} showClose={false} />
        <form
          onSubmit={(e) => {
            void handleSubmit(e)
          }}
        >
          <ModalBody className="flex flex-col gap-4">
            <Field label={typesStrings.editFieldName} required>
              <Input type="text" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </Field>
            <Field label={typesStrings.editFieldColor}>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-full rounded-sm border border-n-200 cursor-pointer"
              />
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
              {typesStrings.editCancel}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={name.trim().length === 0 || updateMutation.isPending}
            >
              {updateMutation.isPending ? typesStrings.editSubmitting : typesStrings.editSubmit}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function Types(): JSX.Element {
  const { data: categories, isLoading, isError } = useProtocolCategories()
  const deleteMutation = useDeleteProtocolCategory()
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<ProtocolCategoryDto | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProtocolCategoryDto | null>(null)
  const [blockedCount, setBlockedCount] = useState<number | null>(null)

  function handleDelete(c: ProtocolCategoryDto) {
    if (c.isSeeded) {
      toast.error(typesStrings.deleteSeeded)
      return
    }
    setDeleteTarget(c)
  }

  function confirmDelete() {
    if (!deleteTarget) return
    setDeletingId(deleteTarget.id)
    void deleteMutation
      .mutateAsync(deleteTarget.id)
      .catch((err: unknown) => {
        if (
          err instanceof ApiRequestError &&
          err.error.code === 'CATEGORY_IN_USE_BY_TEMPLATES'
        ) {
          const count = (err.error.details?.['count'] as number | undefined) ?? 0
          setBlockedCount(count)
        } else {
          toast.error(typesStrings.error)
          logger.error(err instanceof Error ? err.message : String(err), {
            context: 'Types.delete',
          })
        }
      })
      .finally(() => {
        setDeletingId(null)
        setDeleteTarget(null)
      })
  }

  return (
    <div>
      {showCreate && <CreateCategoryModal onClose={() => setShowCreate(false)} />}
      {editing && <EditCategoryModal category={editing} onClose={() => setEditing(null)} />}
      {blockedCount !== null && (
        <Modal open={true} onOpenChange={(open) => { if (!open) setBlockedCount(null) }}>
          <ModalContent>
            <ModalHeader title={typesStrings.deleteBlockedTitle} showClose={false} />
            <ModalBody>
              <p className="text-body text-n-700">{typesStrings.deleteBlockedBody(blockedCount)}</p>
            </ModalBody>
            <ModalFooter>
              <Button variant="primary" onClick={() => setBlockedCount(null)}>
                {typesStrings.deleteBlockedClose}
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}
      <ConfirmDialog
        open={!!deleteTarget}
        title={typesStrings.listDelete}
        description={typesStrings.listDeleteConfirm(deleteTarget?.name ?? '')}
        confirmLabel={typesStrings.listDelete}
        variant="danger"
        loading={deleteMutation.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-h1 m-0">{typesStrings.pageTitle}</h1>
        <Button variant="primary" onClick={() => setShowCreate(true)}>
          <i className="ph ph-plus mr-2" />
          {typesStrings.newButton}
        </Button>
      </div>

      {isLoading && <p className="text-body text-n-500">{typesStrings.loading}</p>}

      {isError && (
        <Callout variant="danger" icon={<i className="ph ph-warning" style={{ fontSize: 18 }} />}>
          {typesStrings.error}
        </Callout>
      )}

      {!isLoading && !isError && categories?.length === 0 && (
        <EmptyState
          icon={<i className="ph ph-tag" />}
          title={typesStrings.emptyTitle}
          description={typesStrings.emptyDescription}
          action={
            <Button variant="primary" onClick={() => setShowCreate(true)}>
              {typesStrings.newButton}
            </Button>
          }
        />
      )}

      {!isLoading && !isError && (categories?.length ?? 0) > 0 && (
        <div className="border border-n-200 rounded-md overflow-hidden">
          <table className="w-full border-collapse bg-n-0">
            <thead>
              <tr>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-3 text-left">
                  Color
                </th>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-3 text-left">
                  Nombre
                </th>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-3 text-left">
                  Estado
                </th>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-3 text-left"></th>
              </tr>
            </thead>
            <tbody>
              {categories!.map((c) => (
                <tr key={c.id} className="hover:bg-n-25">
                  <td className="px-4 py-3 border-b border-n-100">
                    <span
                      className="inline-block w-4 h-4 rounded-sm"
                      style={{ backgroundColor: c.color }}
                    />
                  </td>
                  <td className="text-[13px] px-4 py-3 border-b border-n-100 font-semibold text-n-800">
                    {c.name}
                  </td>
                  <td className="text-[13px] px-4 py-3 border-b border-n-100">
                    {c.isSeeded ? (
                      <Badge variant="draft">{typesStrings.seededBadge}</Badge>
                    ) : (
                      <Badge variant="active">{typesStrings.activeBadge}</Badge>
                    )}
                  </td>
                  <td className="text-[13px] px-4 py-3 border-b border-n-100">
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={c.isSeeded}
                        onClick={() => setEditing(c)}
                      >
                        {typesStrings.listEdit}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-[28px] px-0"
                        title={c.isSeeded ? typesStrings.deleteSeeded : typesStrings.listDelete}
                        disabled={c.isSeeded || deletingId === c.id}
                        onClick={() => handleDelete(c)}
                      >
                        <i
                          className="ph ph-trash text-[15px]"
                          style={{
                            color: c.isSeeded ? 'var(--color-n-300)' : 'var(--color-danger-text)',
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
