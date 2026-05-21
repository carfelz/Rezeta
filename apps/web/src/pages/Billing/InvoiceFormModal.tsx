import { useState } from 'react'
import {
  Button,
  Callout,
  IconButton,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  TextLink,
} from '@/components/ui'
import { useCreateInvoice, useUpdateInvoice } from '@/hooks/invoices/use-invoices'
import { useLocations } from '@/hooks/locations/use-locations'
import { usePatients } from '@/hooks/patients/use-patients'
import type { InvoiceWithDetails, Location as ClinicLocation } from '@rezeta/shared'
import { calcTotal, defaultItem, formatCurrency, type ItemRow } from './helpers'
import { logger } from '@/lib/logger'
import { billingStrings } from './strings'

export interface InvoiceFormModalProps {
  invoice?: InvoiceWithDetails
  onClose: () => void
}

export function InvoiceFormModal({ invoice, onClose }: InvoiceFormModalProps): JSX.Element {
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
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      logger.error(error.message, { stack: error.stack, context: 'Billing.InvoiceFormModal' })
      setError(isEdit ? billingStrings.updateErrorMessage : billingStrings.createErrorMessage)
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
        <ModalHeader
          title={isEdit ? billingStrings.editModalTitle : billingStrings.createModalTitle}
        />
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

            {!isEdit && (
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[12.5px] font-medium text-n-700">
                    {billingStrings.fieldPatient} <span className="text-danger-solid">*</span>
                  </label>
                  <Select
                    value={patientId || '__none__'}
                    onValueChange={(v) => setPatientId(v === '__none__' ? '' : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={billingStrings.fieldPatientPlaceholder} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">
                        {billingStrings.fieldPatientPlaceholder}
                      </SelectItem>
                      {patientsData?.items.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.firstName} {p.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[12.5px] font-medium text-n-700">
                    {billingStrings.fieldLocation} <span className="text-danger-solid">*</span>
                  </label>
                  <Select
                    value={locationId || '__none__'}
                    onValueChange={(v) => setLocationId(v === '__none__' ? '' : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={billingStrings.fieldLocationPlaceholder} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">
                        {billingStrings.fieldLocationPlaceholder}
                      </SelectItem>
                      {locations?.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-[12.5px] font-medium text-n-700">
                {billingStrings.fieldCurrency}
              </label>
              <div className="flex gap-2">
                {(['DOP', 'USD'] as const).map((c) => (
                  <Button
                    key={c}
                    variant={currency === c ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setCurrency(c)}
                  >
                    {c}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[12.5px] font-medium text-n-700">
                {billingStrings.fieldItems} <span className="text-danger-solid">*</span>
              </label>
              <div className="border border-n-200 rounded-sm overflow-hidden">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-n-50 text-n-600 text-left">
                      <th className="px-3 py-2 font-semibold uppercase tracking-[0.05em] w-[50%]">
                        {billingStrings.itemColDescription}
                      </th>
                      <th className="px-3 py-2 font-semibold uppercase tracking-[0.05em] w-[15%]">
                        {billingStrings.itemColQty}
                      </th>
                      <th className="px-3 py-2 font-semibold uppercase tracking-[0.05em] w-[25%]">
                        {billingStrings.itemColUnitPrice}
                      </th>
                      <th className="px-3 py-2 font-semibold uppercase tracking-[0.05em] text-right w-[10%]">
                        {billingStrings.itemColTotal}
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
                            placeholder={billingStrings.itemDescriptionPlaceholder}
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
                            <IconButton
                              icon="ph ph-x"
                              aria-label={billingStrings.removeItemLabel}
                              tone="danger"
                              size="sm"
                              onClick={() => removeItem(idx)}
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TextLink tone="primary" size="md" onClick={addItem} className="self-start">
                <i className="ph ph-plus text-[13px]" /> {billingStrings.addItemLink}
              </TextLink>
            </div>

            {(commissionPct > 0 || isEdit) && (
              <div className="bg-n-50 border border-n-200 rounded-sm p-3 flex flex-col gap-1 text-[12px] font-mono">
                <div className="flex justify-between text-n-600">
                  <span>{billingStrings.summarySubtotal}</span>
                  <span>{formatCurrency(subtotal, currency)}</span>
                </div>
                {commissionPct > 0 && (
                  <div className="flex justify-between text-n-500">
                    <span>{billingStrings.summaryCommission(commissionPct)}</span>
                    <span>− {formatCurrency(commissionAmount, currency)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-n-800 border-t border-n-200 mt-1 pt-1">
                  <span>{billingStrings.summaryNet}</span>
                  <span>
                    {formatCurrency(commissionPct > 0 ? netToDoctor : subtotal, currency)}
                  </span>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-[12.5px] font-medium text-n-700">
                {billingStrings.fieldNotes}
              </label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder={billingStrings.fieldNotesPlaceholder}
                maxLength={2000}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
              {billingStrings.cancelButton}
            </Button>
            <Button type="submit" variant="primary" disabled={!canSubmit || isPending}>
              {isPending
                ? billingStrings.savingButton
                : isEdit
                  ? billingStrings.saveButton
                  : billingStrings.createButton}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  )
}
