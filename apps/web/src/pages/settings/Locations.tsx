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
  useArchiveLocation,
} from '@/hooks/locations/use-locations'
import {
  Button,
  Badge,
  Checkbox,
  EmptyState,
  Callout,
  Field,
  Input,
  Textarea,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '@/components/ui'
import { locationsStrings } from './strings'

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
  const [consultationFee, setConsultationFee] = useState(String(location?.consultationFee ?? 0))
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
      consultationFee: parseFloat(consultationFee) || 0,
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
        <ModalHeader
          title={isEdit ? locationsStrings.formEditTitle : locationsStrings.formCreateTitle}
          showClose={false}
        />
        <form
          onSubmit={(e) => {
            void handleSubmit(e)
          }}
        >
          <ModalBody className="flex flex-col gap-4">
            <Field label={locationsStrings.nameLabel} required>
              <Input
                type="text"
                placeholder={locationsStrings.namePlaceholder}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={locationsStrings.cityLabel}>
                <Input
                  type="text"
                  placeholder={locationsStrings.cityPlaceholder}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </Field>
              <Field label={locationsStrings.phoneLabel}>
                <Input
                  type="tel"
                  placeholder={locationsStrings.phonePlaceholder}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </Field>
            </div>

            <Field label={locationsStrings.addressLabel}>
              <Input
                type="text"
                placeholder={locationsStrings.addressPlaceholder}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={locationsStrings.feeLabel} helper={locationsStrings.feeHelper}>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={consultationFee}
                  onChange={(e) => setConsultationFee(e.target.value)}
                />
              </Field>
              <Field
                label={locationsStrings.commissionLabel}
                helper={locationsStrings.commissionHelper}
              >
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
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label={locationsStrings.typeLabel}>
                <label className="flex items-center gap-2 h-input-md cursor-pointer select-none">
                  <Checkbox checked={isOwned} onChange={(e) => setIsOwned(e.target.checked)} />
                  {locationsStrings.ownedCheckbox}
                </label>
              </Field>
            </div>

            <Field label={locationsStrings.notesLabel}>
              <Textarea
                placeholder={locationsStrings.notesPlaceholder}
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
              {locationsStrings.cancelButton}
            </Button>
            <Button type="submit" variant="primary" disabled={!canSubmit || isPending}>
              {isPending
                ? locationsStrings.savingButton
                : isEdit
                  ? locationsStrings.saveButton
                  : locationsStrings.createButton}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  )
}

// ─── Archive Confirm Modal ────────────────────────────────────────────────────

interface ArchiveConfirmModalProps {
  location: ClinicLocation
  onConfirm: () => void
  onClose: () => void
  isArchiving: boolean
}

function ArchiveConfirmModal({
  location,
  onConfirm,
  onClose,
  isArchiving,
}: ArchiveConfirmModalProps) {
  return (
    <Modal
      open={true}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <ModalContent>
        <ModalHeader title={locationsStrings.archiveTitle} showClose={false} />
        <ModalBody>
          <p className="text-body text-n-700">{locationsStrings.archiveBody(location.name)}</p>
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            {locationsStrings.cancelButton}
          </Button>
          <Button type="button" variant="danger" onClick={onConfirm} disabled={isArchiving}>
            {isArchiving ? locationsStrings.archivingButton : locationsStrings.archiveConfirmButton}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function Locations(): JSX.Element {
  const { data: locations, isLoading, isError } = useLocations()
  const archiveMutation = useArchiveLocation()

  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<ClinicLocation | null>(null)
  const [archiving, setArchiving] = useState<ClinicLocation | null>(null)
  const [archiveError, setArchiveError] = useState<string | null>(null)

  async function handleArchive() {
    if (!archiving) return
    setArchiveError(null)
    try {
      await archiveMutation.mutateAsync(archiving.id)
      setArchiving(null)
    } catch {
      setArchiveError(locationsStrings.archiveError)
    }
  }

  return (
    <div>
      {showCreate && <LocationFormModal onClose={() => setShowCreate(false)} />}
      {editing && <LocationFormModal location={editing} onClose={() => setEditing(null)} />}
      {archiving && (
        <ArchiveConfirmModal
          location={archiving}
          onConfirm={() => {
            void handleArchive()
          }}
          onClose={() => {
            setArchiving(null)
            setArchiveError(null)
          }}
          isArchiving={archiveMutation.isPending}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-h1 m-0">{locationsStrings.pageTitle}</h1>
        <Button variant="primary" onClick={() => setShowCreate(true)}>
          <i className="ph ph-plus mr-2" />
          {locationsStrings.newButton}
        </Button>
      </div>

      {archiveError && (
        <div className="mb-4">
          <Callout variant="danger" icon={<i className="ph ph-warning" style={{ fontSize: 18 }} />}>
            {archiveError}
          </Callout>
        </div>
      )}

      {isLoading && <p className="text-body text-n-500">{locationsStrings.loading}</p>}

      {isError && (
        <Callout variant="danger" icon={<i className="ph ph-warning" style={{ fontSize: 18 }} />}>
          {locationsStrings.loadError}
        </Callout>
      )}

      {!isLoading && !isError && locations?.length === 0 && (
        <EmptyState
          icon={<i className="ph ph-map-pin" />}
          title={locationsStrings.emptyTitle}
          description={locationsStrings.emptyDescription}
          action={
            <Button variant="primary" onClick={() => setShowCreate(true)}>
              {locationsStrings.newButton}
            </Button>
          }
        />
      )}

      {!isLoading && !isError && (locations?.length ?? 0) > 0 && (
        <div className="border border-n-200 rounded-md overflow-hidden">
          <table className="w-full border-collapse bg-n-0">
            <thead>
              <tr>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-3 text-left">
                  {locationsStrings.tableHeaderName}
                </th>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-3 text-left">
                  {locationsStrings.tableHeaderAddress}
                </th>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-3 text-left">
                  {locationsStrings.tableHeaderPhone}
                </th>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-3 text-left">
                  {locationsStrings.tableHeaderFee}
                </th>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-3 text-left">
                  {locationsStrings.tableHeaderCommission}
                </th>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-3 text-left">
                  {locationsStrings.tableHeaderType}
                </th>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-3 text-left" />
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
                    {Number(loc.consultationFee) > 0 ? (
                      `RD$ ${Number(loc.consultationFee).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`
                    ) : (
                      <span className="text-n-400">—</span>
                    )}
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
                      <Badge variant="active">{locationsStrings.ownedBadge}</Badge>
                    ) : (
                      <Badge variant="draft">{locationsStrings.externalBadge}</Badge>
                    )}
                  </td>
                  <td className="text-[13px] px-4 py-3 border-b border-n-100">
                    <div className="flex gap-2 justify-end">
                      <Button variant="secondary" size="sm" onClick={() => setEditing(loc)}>
                        {locationsStrings.editButton}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-[28px] px-0"
                        title={locationsStrings.archiveButtonTitle}
                        onClick={() => {
                          setArchiveError(null)
                          setArchiving(loc)
                        }}
                      >
                        <i
                          className="ph ph-archive text-[15px]"
                          style={{ color: 'var(--color-n-500)' }}
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
