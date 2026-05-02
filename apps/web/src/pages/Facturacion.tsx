import { useState, useCallback } from 'react'
import {
  useInvoices,
  useCreateInvoice,
  useUpdateInvoice,
  useUpdateInvoiceStatus,
  useDeleteInvoice,
} from '@/hooks/invoices/use-invoices'
import { usePatients } from '@/hooks/patients/use-patients'
import { useLocations } from '@/hooks/locations/use-locations'
import type { InvoiceWithDetails, InvoiceStatus } from '@rezeta/shared'
import type { Location as ClinicLocation } from '@rezeta/shared'
import { Badge, Button, Card, Callout, EmptyState, Input } from '@/components/ui'
import type { BadgeProps } from '@/components/ui'
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { apiClient, triggerDownload } from '@/lib/api-client'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency: string): string {
  const symbol = currency === 'USD' ? 'US$' : 'RD$'
  return `${symbol} ${amount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-DO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function statusVariant(status: InvoiceStatus): BadgeProps['variant'] {
  switch (status) {
    case 'paid':
      return 'paid'
    case 'issued':
      return 'active'
    case 'cancelled':
      return 'archived'
    default:
      return 'draft'
  }
}

function statusLabel(status: InvoiceStatus): string {
  switch (status) {
    case 'draft':
      return 'Borrador'
    case 'issued':
      return 'Emitida'
    case 'paid':
      return 'Pagada'
    case 'cancelled':
      return 'Cancelada'
  }
}

// ─── Invoice form types ────────────────────────────────────────────────────────

interface ItemRow {
  description: string
  quantity: number
  unitPrice: number
}

function calcTotal(item: ItemRow): number {
  return Number((item.quantity * item.unitPrice).toFixed(2))
}

function defaultItem(): ItemRow {
  return { description: '', quantity: 1, unitPrice: 0 }
}

// ─── InvoiceFormModal ─────────────────────────────────────────────────────────

interface InvoiceFormModalProps {
  invoice?: InvoiceWithDetails
  onClose: () => void
}

function InvoiceFormModal({ invoice, onClose }: InvoiceFormModalProps): JSX.Element {
  const isEdit = Boolean(invoice)
  const createMutation = useCreateInvoice()
  const updateMutation = useUpdateInvoice(invoice?.id ?? '')
  const isPending = createMutation.isPending || updateMutation.isPending

  const { data: patientsData } = usePatients()
  const { data: locations } = useLocations()

  const [patientId, setPatientId] = useState(invoice?.patientId ?? '')
  const [locationId, setLocationId] = useState(invoice?.locationId ?? '')
  const [currency, setCurrency] = useState<'DOP' | 'USD'>(
    (invoice?.currency as 'DOP' | 'USD') ?? 'DOP',
  )
  const [notes, setNotes] = useState(invoice?.notes ?? '')
  const [items, setItems] = useState<ItemRow[]>(
    invoice?.items.length
      ? invoice.items.map((it) => ({
          description: it.description,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
        }))
      : [defaultItem()],
  )
  const [error, setError] = useState<string | null>(null)

  const selectedLocation: ClinicLocation | undefined = locations?.find((l) => l.id === locationId)
  const commissionPct = selectedLocation ? Number(selectedLocation.commissionPercent) : 0
  const subtotal = items.reduce((sum, it) => sum + calcTotal(it), 0)
  const commissionAmount = Number(((subtotal * commissionPct) / 100).toFixed(2))
  const netToDoctor = Number((subtotal - commissionAmount).toFixed(2))

  const canSubmit =
    patientId.length > 0 &&
    locationId.length > 0 &&
    items.length > 0 &&
    items.every((it) => it.description.trim().length > 0 && it.unitPrice >= 0 && it.quantity >= 1)

  function updateItem(index: number, field: keyof ItemRow, raw: string): void {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== index) return it
        if (field === 'description') return { ...it, description: raw }
        if (field === 'quantity') return { ...it, quantity: Math.max(1, parseInt(raw) || 1) }
        if (field === 'unitPrice') return { ...it, unitPrice: parseFloat(raw) || 0 }
        return it
      }),
    )
  }

  function addItem(): void {
    setItems((prev) => [...prev, defaultItem()])
  }

  function removeItem(index: number): void {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setError(null)
    const dto = {
      patientId,
      locationId,
      currency,
      notes: notes.trim() || null,
      items: items.map((it) => ({
        description: it.description.trim(),
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        total: calcTotal(it),
      })),
    }
    try {
      if (isEdit) {
        await updateMutation.mutateAsync({
          currency: dto.currency,
          items: dto.items,
          notes: dto.notes,
        })
      } else {
        await createMutation.mutateAsync(dto)
      }
      onClose()
    } catch {
      setError(
        isEdit
          ? 'No se pudo actualizar la factura. Intenta de nuevo.'
          : 'No se pudo crear la factura. Intenta de nuevo.',
      )
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
        <ModalHeader title={isEdit ? 'Editar factura' : 'Nueva factura'} />
        <form
          onSubmit={(e) => {
            void handleSubmit(e)
          }}
        >
          <ModalBody className="flex flex-col gap-5">
            {error && (
              <Callout variant="danger" icon={<i className="ph ph-warning-circle" />}>
                {error}
              </Callout>
            )}

            {/* Patient + location */}
            {!isEdit && (
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[12.5px] font-medium text-n-700">
                    Paciente <span className="text-danger-solid">*</span>
                  </label>
                  <select
                    required
                    value={patientId}
                    onChange={(e) => setPatientId(e.target.value)}
                    className="h-input-md w-full border border-n-300 rounded-sm px-3 text-[13px] text-n-700 bg-n-0 focus:outline-none focus:border-p-500"
                  >
                    <option value="">Seleccionar paciente</option>
                    {patientsData?.items.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.firstName} {p.lastName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[12.5px] font-medium text-n-700">
                    Ubicación <span className="text-danger-solid">*</span>
                  </label>
                  <select
                    required
                    value={locationId}
                    onChange={(e) => setLocationId(e.target.value)}
                    className="h-input-md w-full border border-n-300 rounded-sm px-3 text-[13px] text-n-700 bg-n-0 focus:outline-none focus:border-p-500"
                  >
                    <option value="">Seleccionar ubicación</option>
                    {locations?.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Currency */}
            <div className="flex flex-col gap-1">
              <label className="text-[12.5px] font-medium text-n-700">Moneda</label>
              <div className="flex gap-2">
                {(['DOP', 'USD'] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCurrency(c)}
                    className={`px-4 py-2 rounded-sm text-[12px] font-mono font-medium border transition-colors ${
                      currency === c
                        ? 'bg-p-500 text-white border-p-500'
                        : 'bg-n-0 text-n-600 border-n-300 hover:bg-n-50'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Items */}
            <div className="flex flex-col gap-2">
              <label className="text-[12.5px] font-medium text-n-700">
                Ítems <span className="text-danger-solid">*</span>
              </label>
              <div className="border border-n-200 rounded-sm overflow-hidden">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-n-50 text-n-600 text-left">
                      <th className="px-3 py-2 font-semibold uppercase tracking-[0.05em] w-[50%]">
                        Descripción
                      </th>
                      <th className="px-3 py-2 font-semibold uppercase tracking-[0.05em] w-[15%]">
                        Cant.
                      </th>
                      <th className="px-3 py-2 font-semibold uppercase tracking-[0.05em] w-[25%]">
                        Precio unit.
                      </th>
                      <th className="px-3 py-2 font-semibold uppercase tracking-[0.05em] text-right w-[10%]">
                        Total
                      </th>
                      <th className="w-[32px]" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={idx} className="border-t border-n-100">
                        <td className="px-2 py-1.5">
                          <Input
                            value={item.description}
                            onChange={(e) => updateItem(idx, 'description', e.target.value)}
                            placeholder="Descripción del servicio"
                            required
                            className="text-[12px]"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                            className="text-[12px]"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => updateItem(idx, 'unitPrice', e.target.value)}
                            className="text-[12px]"
                          />
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-n-700 whitespace-nowrap">
                          {formatCurrency(calcTotal(item), currency)}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeItem(idx)}
                              className="text-n-400 hover:text-danger-solid transition-colors"
                              title="Eliminar ítem"
                            >
                              <i className="ph ph-x text-[13px]" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                onClick={addItem}
                className="self-start text-[12px] text-p-700 hover:text-p-900 flex items-center gap-1 transition-colors"
              >
                <i className="ph ph-plus text-[13px]" /> Añadir ítem
              </button>
            </div>

            {/* Commission preview */}
            {(commissionPct > 0 || isEdit) && (
              <div className="bg-n-50 border border-n-200 rounded-sm p-3 flex flex-col gap-1 text-[12px] font-mono">
                <div className="flex justify-between text-n-600">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal, currency)}</span>
                </div>
                {commissionPct > 0 && (
                  <div className="flex justify-between text-n-500">
                    <span>Comisión ({commissionPct}%)</span>
                    <span>− {formatCurrency(commissionAmount, currency)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-n-800 border-t border-n-200 mt-1 pt-1">
                  <span>Neto al médico</span>
                  <span>
                    {formatCurrency(commissionPct > 0 ? netToDoctor : subtotal, currency)}
                  </span>
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="flex flex-col gap-1">
              <label className="text-[12.5px] font-medium text-n-700">Notas</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Opcional"
                maxLength={2000}
                className="w-full border border-n-300 rounded-sm px-3 py-2 text-[13px] text-n-700 bg-n-0 resize-none focus:outline-none focus:border-p-500"
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={!canSubmit || isPending}>
              {isPending ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear factura'}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  )
}

// ─── DeleteConfirmModal ────────────────────────────────────────────────────────

interface DeleteConfirmModalProps {
  invoice: InvoiceWithDetails
  onClose: () => void
}

function DeleteConfirmModal({ invoice, onClose }: DeleteConfirmModalProps): JSX.Element {
  const deleteMutation = useDeleteInvoice()
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm(): Promise<void> {
    setError(null)
    try {
      await deleteMutation.mutateAsync(invoice.id)
      onClose()
    } catch {
      setError('No se pudo eliminar la factura. Intenta de nuevo.')
    }
  }

  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <ModalContent>
        <ModalHeader
          title="Eliminar factura"
          subtitle={`¿Eliminar la factura ${invoice.invoiceNumber}? Esta acción no se puede deshacer.`}
          icon={<i className="ph ph-trash" />}
          iconVariant="danger"
        />
        <ModalBody>
          {error && (
            <Callout variant="danger" icon={<i className="ph ph-warning-circle" />}>
              {error}
            </Callout>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={onClose} disabled={deleteMutation.isPending}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={() => void handleConfirm()}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar factura'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

// ─── Status action ────────────────────────────────────────────────────────────

function StatusAction({ invoice }: { invoice: InvoiceWithDetails }): JSX.Element | null {
  const updateStatus = useUpdateInvoiceStatus(invoice.id)

  if (invoice.status === 'draft') {
    return (
      <button
        type="button"
        disabled={updateStatus.isPending}
        onClick={() => void updateStatus.mutateAsync({ status: 'issued' })}
        className="text-[11.5px] font-sans text-p-700 hover:text-p-900 transition-colors disabled:opacity-50"
      >
        Emitir
      </button>
    )
  }
  if (invoice.status === 'issued') {
    return (
      <button
        type="button"
        disabled={updateStatus.isPending}
        onClick={() => void updateStatus.mutateAsync({ status: 'paid', paymentMethod: 'cash' })}
        className="text-[11.5px] font-sans text-p-700 hover:text-p-900 transition-colors disabled:opacity-50"
      >
        Marcar pagada
      </button>
    )
  }
  return null
}

// ─── Invoice row ──────────────────────────────────────────────────────────────

interface InvoiceRowProps {
  invoice: InvoiceWithDetails
  onEdit: (inv: InvoiceWithDetails) => void
  onDelete: (inv: InvoiceWithDetails) => void
}

function InvoiceRow({ invoice, onEdit, onDelete }: InvoiceRowProps): JSX.Element {
  const [downloading, setDownloading] = useState(false)

  async function handleDownloadPdf(): Promise<void> {
    setDownloading(true)
    try {
      const blob = await apiClient.download(`/v1/invoices/${invoice.id}/pdf`)
      triggerDownload(blob, `factura-${invoice.invoiceNumber}.pdf`)
    } finally {
      setDownloading(false)
    }
  }

  const isDraft = invoice.status === 'draft'

  return (
    <tr className="hover:bg-n-25">
      <td className="px-4 py-3 border-b border-n-100">
        <div className="text-[13px] font-mono font-medium text-n-700">{invoice.invoiceNumber}</div>
        <div className="text-[11.5px] text-n-500 mt-1">{formatDate(invoice.createdAt)}</div>
      </td>
      <td className="px-4 py-3 border-b border-n-100">
        <div className="text-[13px] font-sans font-semibold text-n-800">{invoice.patientName}</div>
        <div className="text-[11.5px] text-n-500 mt-1">{invoice.locationName}</div>
      </td>
      <td className="px-4 py-3 border-b border-n-100">
        <Badge variant={statusVariant(invoice.status)} showDot={false}>
          {statusLabel(invoice.status)}
        </Badge>
      </td>
      <td className="px-4 py-3 border-b border-n-100 text-right">
        <div className="text-[13px] font-mono font-semibold text-n-800">
          {formatCurrency(invoice.total, invoice.currency)}
        </div>
        {invoice.commissionPercent > 0 && (
          <div className="text-[11px] font-mono text-n-500 mt-1">
            Neto: {formatCurrency(invoice.netToDoctor, invoice.currency)}
          </div>
        )}
      </td>
      <td className="px-4 py-3 border-b border-n-100 text-right">
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => void handleDownloadPdf()}
            disabled={downloading}
            className="text-[11.5px] font-sans text-n-500 hover:text-n-800 transition-colors disabled:opacity-40 flex items-center gap-1"
            title="Descargar PDF"
          >
            <i
              className={`ph ${downloading ? 'ph-spinner animate-spin' : 'ph-file-pdf'} text-[14px]`}
            />
          </button>
          {isDraft && (
            <>
              <button
                type="button"
                onClick={() => onEdit(invoice)}
                className="text-n-400 hover:text-n-700 transition-colors"
                title="Editar factura"
              >
                <i className="ph ph-pencil-simple text-[14px]" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(invoice)}
                className="text-n-400 hover:text-danger-solid transition-colors"
                title="Eliminar factura"
              >
                <i className="ph ph-trash text-[14px]" />
              </button>
            </>
          )}
          <StatusAction invoice={invoice} />
        </div>
      </td>
    </tr>
  )
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'draft', label: 'Borradores' },
  { value: 'issued', label: 'Emitidas' },
  { value: 'paid', label: 'Pagadas' },
  { value: 'cancelled', label: 'Canceladas' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

type ActiveModal =
  | { type: 'create' }
  | { type: 'edit'; invoice: InvoiceWithDetails }
  | { type: 'delete'; invoice: InvoiceWithDetails }
  | null

export function Facturacion(): JSX.Element {
  const [statusFilter, setStatusFilter] = useState('')
  const [activeModal, setActiveModal] = useState<ActiveModal>(null)

  const { data, isLoading, isError } = useInvoices(
    statusFilter ? { status: statusFilter } : undefined,
  )

  const invoices = data?.items ?? []

  const totals = invoices.reduce(
    (acc, inv) => {
      if (inv.status !== 'cancelled') {
        acc.gross += inv.total
        acc.net += inv.netToDoctor
      }
      return acc
    },
    { gross: 0, net: 0 },
  )

  const closeModal = useCallback(() => setActiveModal(null), [])

  return (
    <div>
      <div className="flex items-center mb-6 gap-4">
        <h1 className="text-h1 flex-1">Facturación</h1>
        <Button variant="primary" size="md" onClick={() => setActiveModal({ type: 'create' })}>
          <i className="ph ph-plus text-[14px]" />
          Nueva factura
        </Button>
      </div>

      {/* Summary row */}
      {!isLoading && invoices.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="border border-n-200 rounded-md bg-n-0 p-4">
            <div className="text-[10.5px] font-mono uppercase tracking-[0.08em] text-n-400">
              Total facturado
            </div>
            <div className="text-[18px] font-serif font-medium text-n-900 mt-1">
              RD$ {totals.gross.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="border border-n-200 rounded-md bg-n-0 p-4">
            <div className="text-[10.5px] font-mono uppercase tracking-[0.08em] text-n-400">
              Neto al médico
            </div>
            <div className="text-[18px] font-serif font-medium text-n-900 mt-1">
              RD$ {totals.net.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="border border-n-200 rounded-md bg-n-0 p-4">
            <div className="text-[10.5px] font-mono uppercase tracking-[0.08em] text-n-400">
              Facturas activas
            </div>
            <div className="text-[18px] font-serif font-medium text-n-900 mt-1">
              {invoices.filter((i) => i.status === 'draft' || i.status === 'issued').length}
            </div>
          </div>
        </div>
      )}

      <Card className="p-0 overflow-hidden">
        {/* Filter bar */}
        <div className="flex items-center gap-2 p-4 border-b border-n-100">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStatusFilter(opt.value)}
              className={`px-3 py-2 rounded-sm text-[12px] font-sans transition-colors ${
                statusFilter === opt.value
                  ? 'bg-p-500 text-white'
                  : 'bg-n-50 text-n-600 hover:bg-n-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="p-8 text-center text-n-400 text-[13px]">Cargando facturas...</div>
        )}

        {isError && (
          <div className="m-4">
            <Callout variant="danger" icon={<i className="ph ph-warning-circle" />}>
              No se pudo cargar la lista de facturas.
            </Callout>
          </div>
        )}

        {!isLoading && !isError && invoices.length === 0 && (
          <EmptyState
            icon={<i className="ph ph-receipt" />}
            title="No hay facturas"
            description="Las facturas se generan automáticamente al firmar una consulta, o puedes crear una manualmente."
            action={
              <Button variant="primary" onClick={() => setActiveModal({ type: 'create' })}>
                Nueva factura
              </Button>
            }
            className="rounded-none border-0"
          />
        )}

        {!isLoading && invoices.length > 0 && (
          <table className="w-full border-collapse bg-n-0">
            <thead>
              <tr>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-3 text-left">
                  Número
                </th>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-3 text-left">
                  Paciente / Ubicación
                </th>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-3 text-left">
                  Estado
                </th>
                <th className="bg-n-50 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-n-600 px-4 py-3 text-right">
                  Monto
                </th>
                <th className="bg-n-50 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <InvoiceRow
                  key={invoice.id}
                  invoice={invoice}
                  onEdit={(inv) => setActiveModal({ type: 'edit', invoice: inv })}
                  onDelete={(inv) => setActiveModal({ type: 'delete', invoice: inv })}
                />
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Modals */}
      {activeModal?.type === 'create' && <InvoiceFormModal onClose={closeModal} />}
      {activeModal?.type === 'edit' && (
        <InvoiceFormModal invoice={activeModal.invoice} onClose={closeModal} />
      )}
      {activeModal?.type === 'delete' && (
        <DeleteConfirmModal invoice={activeModal.invoice} onClose={closeModal} />
      )}
    </div>
  )
}
