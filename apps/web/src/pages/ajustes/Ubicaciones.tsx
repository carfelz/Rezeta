import { useState } from 'react'
import type {
  Location as ClinicLocation,
  CreateLocationDto,
  UpdateLocationDto,
} from '@rezeta/shared'
import {
  useLocations,
  useCreateLocation,
  useUpdateLocation,
  useDeleteLocation,
} from '@/hooks/locations/use-locations'
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

// ─── Location Form Modal ──────────────────────────────────────────────────────

interface LocationFormModalProps {
  location?: ClinicLocation
  onClose: () => void
}

function LocationFormModal({ location, onClose }: LocationFormModalProps) {
  const createMutation = useCreateLocation()
  const updateMutation = useUpdateLocation(location?.id ?? '')
  const isPending = createMutation.isPending || updateMutation.isPending

  const [name, setName] = useState(location?.name ?? '')
  const [address, setAddress] = useState(location?.address ?? '')
  const [city, setCity] = useState(location?.city ?? '')
  const [phone, setPhone] = useState(location?.phone ?? '')
  const [commissionPercent, setCommissionPercent] = useState(
    String(location?.commissionPercent ?? 0),
  )
  const [isOwned, setIsOwned] = useState(location?.isOwned ?? false)
  const [notes, setNotes] = useState(location?.notes ?? '')
  const [error, setError] = useState<string | null>(null)

  const isEdit = !!location
  const canSubmit = name.trim().length >= 2

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const payload = {
      name: name.trim(),
      address: address.trim() || null,
      city: city.trim() || null,
      phone: phone.trim() || null,
      commissionPercent: parseFloat(commissionPercent) || 0,
      isOwned,
      notes: notes.trim() || null,
    }

    try {
      if (isEdit) {
        await updateMutation.mutateAsync(payload as UpdateLocationDto)
      } else {
        await createMutation.mutateAsync(payload as CreateLocationDto)
      }
      onClose()
    } catch {
      setError(
        isEdit
          ? 'No se pudo actualizar la ubicación. Intenta de nuevo.'
          : 'No se pudo crear la ubicación. Intenta de nuevo.',
      )
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
        <ModalHeader title={isEdit ? 'Editar ubicación' : 'Nueva ubicación'} showClose={false} />
        <form
          onSubmit={(e) => {
            void handleSubmit(e)
          }}
        >
          <ModalBody className="flex flex-col gap-4">
            <Field label="Nombre" required>
              <Input
                type="text"
                placeholder="Ej. Centro Médico Lincoln"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Ciudad">
                <Input
                  type="text"
                  placeholder="Ej. Santo Domingo"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </Field>
              <Field label="Teléfono">
                <Input
                  type="tel"
                  placeholder="Ej. 809-555-0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </Field>
            </div>

            <Field label="Dirección">
              <Input
                type="text"
                placeholder="Ej. Av. Winston Churchill 1099, Suite 301"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Comisión (%)" helper="Porcentaje que retiene el centro">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="0"
                  value={commissionPercent}
                  onChange={(e) => setCommissionPercent(e.target.value)}
                />
              </Field>
              <Field label="Tipo">
                <label className="flex items-center gap-2 h-input-md cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-p-500"
                    checked={isOwned}
                    onChange={(e) => setIsOwned(e.target.checked)}
                  />
                  <span className="text-[13px] text-n-700">Consultorio propio</span>
                </label>
              </Field>
            </div>

            <Field label="Notas">
              <textarea
                className="w-full min-h-[72px] px-3 py-2 text-[13px] font-sans bg-n-0 text-n-700 border border-n-300 rounded-sm outline-none transition-[border-color] duration-[100ms] focus:border-p-500 placeholder:text-n-400 resize-y"
                placeholder="Información adicional sobre esta ubicación..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
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
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={!canSubmit || isPending}>
              {isPending ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear ubicación'}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  )
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

interface DeleteConfirmModalProps {
  location: ClinicLocation
  onConfirm: () => void
  onClose: () => void
  isDeleting: boolean
}

function DeleteConfirmModal({ location, onConfirm, onClose, isDeleting }: DeleteConfirmModalProps) {
  return (
    <Modal
      open={true}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <ModalContent>
        <ModalHeader title="Eliminar ubicación" showClose={false} />
        <ModalBody>
          <p className="text-body text-n-700">
            ¿Eliminar <span className="font-semibold">{location.name}</span>? Esta acción no se
            puede deshacer.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variant="danger" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? 'Eliminando...' : 'Eliminar ubicación'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function Ubicaciones(): JSX.Element {
  const { data: locations, isLoading, isError } = useLocations()
  const deleteMutation = useDeleteLocation()

  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<ClinicLocation | null>(null)
  const [deleting, setDeleting] = useState<ClinicLocation | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleDelete() {
    if (!deleting) return
    setDeleteError(null)
    try {
      await deleteMutation.mutateAsync(deleting.id)
      setDeleting(null)
    } catch {
      setDeleteError('No se puede eliminar: la ubicación tiene citas próximas programadas.')
    }
  }

  return (
    <div>
      {showCreate && <LocationFormModal onClose={() => setShowCreate(false)} />}
      {editing && <LocationFormModal location={editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <DeleteConfirmModal
          location={deleting}
          onConfirm={() => {
            void handleDelete()
          }}
          onClose={() => {
            setDeleting(null)
            setDeleteError(null)
          }}
          isDeleting={deleteMutation.isPending}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-h1 m-0">Ubicaciones</h1>
        <Button variant="primary" onClick={() => setShowCreate(true)}>
          <i className="ph ph-plus mr-1.5" />
          Nueva ubicación
        </Button>
      </div>

      {deleteError && (
        <div className="mb-4">
          <Callout variant="danger" icon={<i className="ph ph-warning" style={{ fontSize: 18 }} />}>
            {deleteError}
          </Callout>
        </div>
      )}

      {isLoading && <p className="text-body text-n-500">Cargando ubicaciones...</p>}

      {isError && (
        <Callout variant="danger" icon={<i className="ph ph-warning" style={{ fontSize: 18 }} />}>
          No se pudieron cargar las ubicaciones. Intenta recargar la página.
        </Callout>
      )}

      {!isLoading && !isError && locations?.length === 0 && (
        <EmptyState
          icon={<i className="ph ph-map-pin" />}
          title="Aún no tienes ubicaciones registradas"
          description="Registra los centros médicos o consultorios donde ejerces para poder agendar citas."
          action={
            <Button variant="primary" onClick={() => setShowCreate(true)}>
              Nueva ubicación
            </Button>
          }
        />
      )}

      {!isLoading && !isError && (locations?.length ?? 0) > 0 && (
        <div className="border border-n-200 rounded-md overflow-hidden">
          <table className="w-full border-collapse bg-n-0">
            <thead>
              <tr>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-2.5 text-left">
                  Nombre
                </th>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-2.5 text-left">
                  Dirección
                </th>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-2.5 text-left">
                  Teléfono
                </th>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-2.5 text-left">
                  Comisión
                </th>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-2.5 text-left">
                  Tipo
                </th>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-2.5 text-left" />
              </tr>
            </thead>
            <tbody>
              {locations!.map((loc) => (
                <tr key={loc.id} className="hover:bg-n-25">
                  <td className="text-[13px] px-4 py-3 border-b border-n-100 font-semibold text-n-800">
                    {loc.name}
                  </td>
                  <td className="text-[13px] px-4 py-3 border-b border-n-100 text-n-600">
                    {[loc.address, loc.city].filter(Boolean).join(', ') || (
                      <span className="text-n-400">—</span>
                    )}
                  </td>
                  <td className="text-[13px] px-4 py-3 border-b border-n-100 font-mono text-n-600">
                    {loc.phone ?? <span className="text-n-400">—</span>}
                  </td>
                  <td className="text-[13px] px-4 py-3 border-b border-n-100 font-mono text-n-600">
                    {Number(loc.commissionPercent) > 0 ? (
                      `${loc.commissionPercent}%`
                    ) : (
                      <span className="text-n-400">—</span>
                    )}
                  </td>
                  <td className="text-[13px] px-4 py-3 border-b border-n-100">
                    {loc.isOwned ? (
                      <Badge variant="active">Propio</Badge>
                    ) : (
                      <Badge variant="draft">Externo</Badge>
                    )}
                  </td>
                  <td className="text-[13px] px-4 py-3 border-b border-n-100">
                    <div className="flex gap-2 justify-end">
                      <Button variant="secondary" size="sm" onClick={() => setEditing(loc)}>
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-[28px] px-0"
                        title="Eliminar ubicación"
                        onClick={() => {
                          setDeleteError(null)
                          setDeleting(loc)
                        }}
                      >
                        <i
                          className="ph ph-trash text-[15px]"
                          style={{ color: 'var(--color-danger-text)' }}
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
