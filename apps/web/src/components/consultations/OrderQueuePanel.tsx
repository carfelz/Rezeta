import { useEffect, useState } from 'react'
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Button,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui'
import type { Prescription, ImagingOrder, LabOrder } from '@rezeta/shared'
import {
  useOrderQueueStore,
  type QueuedMedication,
  type QueuedImagingOrder,
  type QueuedLabOrder,
  type OrderGroup,
} from '@/store/order-queue.store'
import {
  useCreatePrescription,
  useCreateImagingOrder,
  useCreateLabOrder,
  useListPrescriptions,
  useListImagingOrders,
  useListLabOrders,
  useDeletePrescription,
  useDeleteImagingOrder,
  useDeleteLabOrder,
} from '@/hooks/consultations/use-consultations'
import { cn } from '@/lib/utils'
import { apiClient, triggerDownload } from '@/lib/api-client'

// ─── Shared helpers ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div className="text-[10.5px] font-mono uppercase tracking-[0.08em] text-n-400 px-1 mb-2">
      {children}
    </div>
  )
}

const URGENCY_LABELS: Record<string, string> = {
  routine: 'Rutina',
  urgent: 'Urgente',
  stat: 'Stat',
}

// ─── Saved prescription card (from DB) ───────────────────────────────────────

interface SavedPrescriptionCardProps {
  prescription: Prescription
  consultationId: string
  isSigned: boolean
  onDelete: (id: string) => void
  isDeleting: boolean
}

function SavedPrescriptionCard({
  prescription,
  consultationId,
  isSigned,
  onDelete,
  isDeleting,
}: SavedPrescriptionCardProps): JSX.Element {
  const [downloading, setDownloading] = useState(false)

  async function handleDownloadPdf(): Promise<void> {
    setDownloading(true)
    try {
      const blob = await apiClient.download(
        `/v1/consultations/${consultationId}/prescriptions/${prescription.id}/pdf`,
      )
      triggerDownload(blob, `receta-${prescription.id}.pdf`)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="bg-n-0 border border-n-200 rounded-md overflow-hidden mb-3">
      <div className="flex items-center justify-between px-4 py-3 bg-n-25 border-b border-n-100">
        <div className="flex items-center gap-2">
          <span className="text-[12.5px] font-sans font-semibold text-n-800">
            {prescription.groupTitle ?? `Receta ${prescription.groupOrder}`}
          </span>
          <span className="text-[11px] font-mono text-success-text bg-success-bg border border-success-border rounded px-2 py-1 flex items-center gap-1">
            <i className="ph ph-check text-[10px]" />
            Guardada
          </span>
        </div>
        {!isSigned && (
          <button
            type="button"
            onClick={() => onDelete(prescription.id)}
            disabled={isDeleting}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-n-100 text-n-400 hover:text-danger-text transition-colors disabled:opacity-40"
            title="Eliminar receta"
          >
            <i className="ph ph-trash text-[12px]" />
          </button>
        )}
      </div>

      <div className="divide-y divide-n-100">
        {prescription.prescriptionItems.map((item) => (
          <div key={item.id} className="px-4 py-3">
            <div className="text-[13px] font-sans font-semibold text-n-800">{item.drug}</div>
            <div className="text-[12px] font-mono text-n-500 mt-1">
              {item.dose} · {item.route} · {item.frequency}
              {item.duration && ` · ${item.duration}`}
            </div>
            {item.notes && (
              <div className="text-[12px] font-sans text-n-500 mt-1 italic">{item.notes}</div>
            )}
          </div>
        ))}
        {prescription.prescriptionItems.length === 0 && (
          <p className="text-[12.5px] text-n-300 italic py-3 px-4">Sin medicamentos.</p>
        )}
      </div>

      <div className="px-4 py-3 border-t border-n-100 flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void handleDownloadPdf()}
          disabled={downloading}
        >
          {downloading ? (
            <>
              <i className="ph ph-spinner animate-spin mr-1 text-[11px]" />
              Descargando…
            </>
          ) : (
            <>
              <i className="ph ph-download-simple mr-1 text-[12px]" />
              Descargar PDF
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

// ─── Saved imaging group card (from DB) ──────────────────────────────────────

interface SavedImagingGroupCardProps {
  groupTitle: string
  orders: ImagingOrder[]
  isSigned: boolean
  onDelete: (id: string) => void
  isDeleting: boolean
}

function SavedImagingGroupCard({
  groupTitle,
  orders,
  isSigned,
  onDelete,
  isDeleting,
}: SavedImagingGroupCardProps): JSX.Element {
  return (
    <div className="bg-n-0 border border-n-200 rounded-md overflow-hidden mb-3">
      <div className="flex items-center justify-between px-4 py-3 bg-n-25 border-b border-n-100">
        <div className="flex items-center gap-2">
          <span className="text-[12.5px] font-sans font-semibold text-n-800">{groupTitle}</span>
          <span className="text-[11px] font-mono text-success-text bg-success-bg border border-success-border rounded px-2 py-1 flex items-center gap-1">
            <i className="ph ph-check text-[10px]" />
            Guardada
          </span>
        </div>
      </div>

      <div className="divide-y divide-n-100">
        {orders.map((order) => (
          <div key={order.id} className="flex items-start gap-3 px-4 py-3 group">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-sans font-semibold text-n-800">
                  {order.studyType}
                </span>
                <span
                  className={cn(
                    'text-[10.5px] font-mono px-2 py-px rounded border',
                    order.urgency === 'stat' &&
                      'bg-danger-bg border-danger-border text-danger-text',
                    order.urgency === 'urgent' &&
                      'bg-warning-bg border-warning-border text-warning-text',
                    order.urgency === 'routine' && 'bg-n-50 border-n-200 text-n-500',
                  )}
                >
                  {URGENCY_LABELS[order.urgency]}
                </span>
              </div>
              <div className="text-[12px] font-sans text-n-500 mt-1">{order.indication}</div>
              <div className="flex items-center gap-3 mt-1 text-[11px] font-mono text-n-400">
                {order.contrast && <span>Con contraste</span>}
                {order.fastingRequired && <span>En ayunas</span>}
              </div>
            </div>
            {!isSigned && (
              <button
                type="button"
                onClick={() => onDelete(order.id)}
                disabled={isDeleting}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-n-100 text-n-300 hover:text-danger-text transition-colors opacity-0 group-hover:opacity-100 shrink-0 mt-1 disabled:opacity-40"
                title="Eliminar"
              >
                <i className="ph ph-trash text-[11px]" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Saved lab group card (from DB) ──────────────────────────────────────────

interface SavedLabGroupCardProps {
  groupTitle: string
  orders: LabOrder[]
  isSigned: boolean
  onDelete: (id: string) => void
  isDeleting: boolean
}

function SavedLabGroupCard({
  groupTitle,
  orders,
  isSigned,
  onDelete,
  isDeleting,
}: SavedLabGroupCardProps): JSX.Element {
  return (
    <div className="bg-n-0 border border-n-200 rounded-md overflow-hidden mb-3">
      <div className="flex items-center justify-between px-4 py-3 bg-n-25 border-b border-n-100">
        <div className="flex items-center gap-2">
          <span className="text-[12.5px] font-sans font-semibold text-n-800">{groupTitle}</span>
          <span className="text-[11px] font-mono text-success-text bg-success-bg border border-success-border rounded px-2 py-1 flex items-center gap-1">
            <i className="ph ph-check text-[10px]" />
            Guardada
          </span>
        </div>
      </div>

      <div className="divide-y divide-n-100">
        {orders.map((order) => (
          <div key={order.id} className="flex items-start gap-3 px-4 py-3 group">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-sans font-semibold text-n-800">
                  {order.testName}
                </span>
                {order.testCode && (
                  <span className="text-[10.5px] font-mono text-n-400">{order.testCode}</span>
                )}
              </div>
              <div className="text-[12px] font-sans text-n-500 mt-1">{order.indication}</div>
              <div className="flex items-center gap-3 mt-1 text-[11px] font-mono text-n-400">
                <span>{URGENCY_LABELS[order.urgency]}</span>
                {order.fastingRequired && <span>En ayunas</span>}
                <span className="capitalize">{order.sampleType}</span>
              </div>
            </div>
            {!isSigned && (
              <button
                type="button"
                onClick={() => onDelete(order.id)}
                disabled={isDeleting}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-n-100 text-n-300 hover:text-danger-text transition-colors opacity-0 group-hover:opacity-100 shrink-0 mt-1 disabled:opacity-40"
                title="Eliminar"
              >
                <i className="ph ph-trash text-[11px]" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Medication queue group ───────────────────────────────────────────────────

interface MedicationGroupProps {
  group: OrderGroup
  medications: QueuedMedication[]
  consultationId: string
  onRemoveMedication: (id: string) => void
  onRemoveGroup: (id: string) => void
  isOnlyGroup: boolean
}

function MedicationGroup({
  group,
  medications,
  consultationId,
  onRemoveMedication,
  onRemoveGroup,
  isOnlyGroup,
}: MedicationGroupProps): JSX.Element {
  const createPrescription = useCreatePrescription(consultationId)

  function handleGenerate(): void {
    if (medications.length === 0) return
    createPrescription.mutate(
      {
        groupTitle: group.title,
        groupOrder: group.order,
        items: medications.map((m) => ({
          drug: m.drug,
          dose: m.dose,
          route: m.route,
          frequency: m.frequency,
          duration: m.duration,
          notes: m.notes,
          source: m.source,
        })),
      },
      {
        onSuccess: () => {
          onRemoveGroup(group.id)
        },
      },
    )
  }

  return (
    <div className="bg-n-0 border border-n-200 rounded-md overflow-hidden mb-3">
      <div className="flex items-center justify-between px-4 py-3 bg-n-25 border-b border-n-100">
        <span className="text-[12.5px] font-sans font-semibold text-n-800">{group.title}</span>
        {!isOnlyGroup && (
          <button
            type="button"
            onClick={() => onRemoveGroup(group.id)}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-n-100 text-n-400 hover:text-n-700 transition-colors"
            title="Eliminar grupo"
          >
            <i className="ph ph-x text-[12px]" />
          </button>
        )}
      </div>

      {medications.length === 0 ? (
        <div className="px-4 py-3">
          <p className="text-[12.5px] text-n-300 italic py-2 px-1">
            Sin medicamentos en este grupo.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-n-100">
          {medications.map((med) => (
            <div key={med.id} className="flex items-start gap-3 px-4 py-3 group">
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-sans font-semibold text-n-800">{med.drug}</div>
                <div className="text-[12px] font-mono text-n-500 mt-1">
                  {med.dose} · {med.route} · {med.frequency}
                  {med.duration && ` · ${med.duration}`}
                </div>
                {med.notes && (
                  <div className="text-[12px] font-sans text-n-500 mt-1 italic">{med.notes}</div>
                )}
                {med.source && (
                  <div className="text-[11px] font-mono text-p-600 mt-1 opacity-70">
                    {med.source}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => onRemoveMedication(med.id)}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-n-100 text-n-300 hover:text-n-700 transition-colors opacity-0 group-hover:opacity-100 shrink-0 mt-1"
                title="Quitar"
              >
                <i className="ph ph-x text-[11px]" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="px-4 py-3 border-t border-n-100 flex justify-end">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleGenerate}
          disabled={medications.length === 0 || createPrescription.isPending}
        >
          {createPrescription.isPending ? (
            <>
              <i className="ph ph-spinner animate-spin mr-1 text-[11px]" />
              Generando…
            </>
          ) : (
            <>
              <i className="ph ph-file-pdf mr-1 text-[12px]" />
              Generar receta
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

// ─── Imaging queue group ──────────────────────────────────────────────────────

interface ImagingGroupProps {
  group: OrderGroup
  orders: QueuedImagingOrder[]
  consultationId: string
  onRemoveOrder: (id: string) => void
  onRemoveGroup: (id: string) => void
  isOnlyGroup: boolean
}

function ImagingGroup({
  group,
  orders,
  consultationId,
  onRemoveOrder,
  onRemoveGroup,
  isOnlyGroup,
}: ImagingGroupProps): JSX.Element {
  const createImagingOrder = useCreateImagingOrder(consultationId)

  function handleGenerate(): void {
    if (orders.length === 0) return
    createImagingOrder.mutate(
      {
        groupTitle: group.title,
        groupOrder: group.order,
        orders: orders.map((o) => ({
          study_type: o.study_type,
          indication: o.indication,
          urgency: o.urgency,
          contrast: o.contrast,
          fasting_required: o.fasting_required,
          special_instructions: o.special_instructions,
          source: o.source,
        })),
      },
      { onSuccess: () => onRemoveGroup(group.id) },
    )
  }

  return (
    <div className="bg-n-0 border border-n-200 rounded-md overflow-hidden mb-3">
      <div className="flex items-center justify-between px-4 py-3 bg-n-25 border-b border-n-100">
        <span className="text-[12.5px] font-sans font-semibold text-n-800">{group.title}</span>
        {!isOnlyGroup && (
          <button
            type="button"
            onClick={() => onRemoveGroup(group.id)}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-n-100 text-n-400 hover:text-n-700 transition-colors"
          >
            <i className="ph ph-x text-[12px]" />
          </button>
        )}
      </div>

      {orders.length === 0 ? (
        <div className="px-4 py-3">
          <p className="text-[12.5px] text-n-300 italic py-2 px-1">Sin estudios en este grupo.</p>
        </div>
      ) : (
        <div className="divide-y divide-n-100">
          {orders.map((order) => (
            <div key={order.id} className="flex items-start gap-3 px-4 py-3 group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-sans font-semibold text-n-800">
                    {order.study_type}
                  </span>
                  <span
                    className={cn(
                      'text-[10.5px] font-mono px-2 py-px rounded border',
                      order.urgency === 'stat' &&
                        'bg-danger-bg border-danger-border text-danger-text',
                      order.urgency === 'urgent' &&
                        'bg-warning-bg border-warning-border text-warning-text',
                      order.urgency === 'routine' && 'bg-n-50 border-n-200 text-n-500',
                    )}
                  >
                    {URGENCY_LABELS[order.urgency]}
                  </span>
                </div>
                <div className="text-[12px] font-sans text-n-500 mt-1">{order.indication}</div>
                <div className="flex items-center gap-3 mt-1 text-[11px] font-mono text-n-400">
                  {order.contrast && <span>Con contraste</span>}
                  {order.fasting_required && <span>En ayunas</span>}
                  {order.special_instructions && (
                    <span className="italic">{order.special_instructions}</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRemoveOrder(order.id)}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-n-100 text-n-300 hover:text-n-700 transition-colors opacity-0 group-hover:opacity-100 shrink-0 mt-1"
              >
                <i className="ph ph-x text-[11px]" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="px-4 py-3 border-t border-n-100 flex justify-end">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleGenerate}
          disabled={orders.length === 0 || createImagingOrder.isPending}
        >
          {createImagingOrder.isPending ? (
            <>
              <i className="ph ph-spinner animate-spin mr-1 text-[11px]" />
              Generando…
            </>
          ) : (
            <>
              <i className="ph ph-file-pdf mr-1 text-[12px]" />
              Generar orden
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

// ─── Lab queue group ──────────────────────────────────────────────────────────

interface LabGroupProps {
  group: OrderGroup
  orders: QueuedLabOrder[]
  consultationId: string
  onRemoveOrder: (id: string) => void
  onRemoveGroup: (id: string) => void
  isOnlyGroup: boolean
}

function LabGroup({
  group,
  orders,
  consultationId,
  onRemoveOrder,
  onRemoveGroup,
  isOnlyGroup,
}: LabGroupProps): JSX.Element {
  const createLabOrder = useCreateLabOrder(consultationId)

  function handleGenerate(): void {
    if (orders.length === 0) return
    createLabOrder.mutate(
      {
        groupTitle: group.title,
        groupOrder: group.order,
        orders: orders.map((o) => ({
          test_name: o.test_name,
          test_code: o.test_code,
          indication: o.indication,
          urgency: o.urgency,
          fasting_required: o.fasting_required,
          sample_type: o.sample_type,
          special_instructions: o.special_instructions,
          source: o.source,
        })),
      },
      { onSuccess: () => onRemoveGroup(group.id) },
    )
  }

  return (
    <div className="bg-n-0 border border-n-200 rounded-md overflow-hidden mb-3">
      <div className="flex items-center justify-between px-4 py-3 bg-n-25 border-b border-n-100">
        <span className="text-[12.5px] font-sans font-semibold text-n-800">{group.title}</span>
        {!isOnlyGroup && (
          <button
            type="button"
            onClick={() => onRemoveGroup(group.id)}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-n-100 text-n-400 hover:text-n-700 transition-colors"
          >
            <i className="ph ph-x text-[12px]" />
          </button>
        )}
      </div>

      {orders.length === 0 ? (
        <div className="px-4 py-3">
          <p className="text-[12.5px] text-n-300 italic py-2 px-1">Sin estudios en este grupo.</p>
        </div>
      ) : (
        <div className="divide-y divide-n-100">
          {orders.map((order) => (
            <div key={order.id} className="flex items-start gap-3 px-4 py-3 group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-sans font-semibold text-n-800">
                    {order.test_name}
                  </span>
                  {order.test_code && (
                    <span className="text-[10.5px] font-mono text-n-400">{order.test_code}</span>
                  )}
                </div>
                <div className="text-[12px] font-sans text-n-500 mt-1">{order.indication}</div>
                <div className="flex items-center gap-3 mt-1 text-[11px] font-mono text-n-400">
                  <span>{URGENCY_LABELS[order.urgency]}</span>
                  {order.fasting_required && <span>En ayunas</span>}
                  {order.special_instructions && (
                    <span className="italic">{order.special_instructions}</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRemoveOrder(order.id)}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-n-100 text-n-300 hover:text-n-700 transition-colors opacity-0 group-hover:opacity-100 shrink-0 mt-1"
              >
                <i className="ph ph-x text-[11px]" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="px-4 py-3 border-t border-n-100 flex justify-end">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleGenerate}
          disabled={orders.length === 0 || createLabOrder.isPending}
        >
          {createLabOrder.isPending ? (
            <>
              <i className="ph ph-spinner animate-spin mr-1 text-[11px]" />
              Generando…
            </>
          ) : (
            <>
              <i className="ph ph-file-pdf mr-1 text-[12px]" />
              Generar laboratorio
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

// ─── Add medication form ──────────────────────────────────────────────────────

interface AddMedicationFormProps {
  groups: OrderGroup[]
  onAdd: (med: Omit<QueuedMedication, 'id' | 'groupId'>, groupId?: string) => void
}

function AddMedicationForm({ groups, onAdd }: AddMedicationFormProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const [drug, setDrug] = useState('')
  const [dose, setDose] = useState('')
  const [route, setRoute] = useState('')
  const [frequency, setFrequency] = useState('')
  const [duration, setDuration] = useState('')
  const [notes, setNotes] = useState('')
  const [groupId, setGroupId] = useState(groups[0]?.id ?? '')

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 w-full py-2 text-[12.5px] font-sans text-n-500 hover:text-n-800 border border-dashed border-n-300 rounded-sm hover:border-n-400 transition-colors bg-n-0 justify-center"
      >
        <i className="ph ph-plus text-[12px]" />
        Añadir medicamento
      </button>
    )
  }

  function handleSubmit(): void {
    if (!drug.trim() || !dose.trim() || !route.trim() || !frequency.trim()) return
    onAdd(
      {
        drug: drug.trim(),
        dose: dose.trim(),
        route: route.trim(),
        frequency: frequency.trim(),
        duration: duration.trim(),
        ...(notes.trim() && { notes: notes.trim() }),
      },
      groupId || undefined,
    )
    setDrug('')
    setDose('')
    setRoute('')
    setFrequency('')
    setDuration('')
    setNotes('')
    setOpen(false)
  }

  const inputClass =
    'w-full h-[32px] px-3 text-[12.5px] font-sans border border-n-300 rounded-sm focus:border-p-500 focus:outline-none bg-n-0 text-n-700 placeholder:text-n-300'

  return (
    <div className="bg-n-0 border border-n-200 rounded-md p-4 mb-3">
      <div className="text-[11.5px] font-mono uppercase tracking-[0.06em] text-n-500 mb-3">
        Nuevo medicamento
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="col-span-2">
          <input
            className={inputClass}
            placeholder="Medicamento *"
            value={drug}
            onChange={(e) => setDrug(e.target.value)}
          />
        </div>
        <input
          className={inputClass}
          placeholder="Dosis *"
          value={dose}
          onChange={(e) => setDose(e.target.value)}
        />
        <input
          className={inputClass}
          placeholder="Vía *"
          value={route}
          onChange={(e) => setRoute(e.target.value)}
        />
        <input
          className={inputClass}
          placeholder="Frecuencia *"
          value={frequency}
          onChange={(e) => setFrequency(e.target.value)}
        />
        <input
          className={inputClass}
          placeholder="Duración"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
        />
        <div className="col-span-2">
          <input
            className={inputClass}
            placeholder="Notas (opcional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        {groups.length > 1 && (
          <div className="col-span-2">
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger className="h-[32px] text-[12.5px]">
                <SelectValue placeholder="Receta…" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <div className="flex items-center justify-end gap-2 mt-3">
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleSubmit}
          disabled={!drug.trim() || !dose.trim() || !route.trim() || !frequency.trim()}
        >
          Añadir
        </Button>
      </div>
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

interface OrderQueuePanelProps {
  consultationId: string
  isSigned: boolean
}

export function OrderQueuePanel({ consultationId, isSigned }: OrderQueuePanelProps): JSX.Element {
  const {
    activeTab,
    setActiveTab,
    medicationGroups,
    medications,
    imagingGroups,
    imagingOrders,
    labGroups,
    labOrders,
    addMedicationGroup,
    removeMedicationGroup,
    queueMedication,
    removeMedication,
    addImagingGroup,
    removeImagingGroup,
    removeImagingOrder,
    addLabGroup,
    removeLabGroup,
    removeLabOrder,
    reset,
  } = useOrderQueueStore()

  // Reset the local queue whenever the consultation changes
  useEffect(() => {
    reset()
  }, [consultationId, reset])

  // Load saved records from backend
  const savedPrescriptions = useListPrescriptions(consultationId)
  const savedImagingOrders = useListImagingOrders(consultationId)
  const savedLabOrders = useListLabOrders(consultationId)

  const deletePrescription = useDeletePrescription(consultationId)
  const deleteImagingOrder = useDeleteImagingOrder(consultationId)
  const deleteLabOrder = useDeleteLabOrder(consultationId)

  // Group saved imaging orders by groupTitle/groupOrder
  const imagingGroups_saved = (savedImagingOrders.data ?? []).reduce<
    { key: string; title: string; orders: ImagingOrder[] }[]
  >((acc, order) => {
    const key = `${order.groupOrder}-${order.groupTitle ?? ''}`
    const existing = acc.find((g) => g.key === key)
    if (existing) {
      existing.orders.push(order)
    } else {
      acc.push({
        key,
        title: order.groupTitle ?? `Orden ${order.groupOrder}`,
        orders: [order],
      })
    }
    return acc
  }, [])

  // Group saved lab orders similarly
  const labGroups_saved = (savedLabOrders.data ?? []).reduce<
    { key: string; title: string; orders: LabOrder[] }[]
  >((acc, order) => {
    const key = `${order.groupOrder}-${order.groupTitle ?? ''}`
    const existing = acc.find((g) => g.key === key)
    if (existing) {
      existing.orders.push(order)
    } else {
      acc.push({
        key,
        title: order.groupTitle ?? `Laboratorio ${order.groupOrder}`,
        orders: [order],
      })
    }
    return acc
  }, [])

  const savedRxCount = savedPrescriptions.data?.length ?? 0
  const savedImgCount = savedImagingOrders.data?.length ?? 0
  const savedLabCount = savedLabOrders.data?.length ?? 0

  const totalMeds = medications.length + savedRxCount
  const totalImaging = imagingOrders.length + savedImgCount
  const totalLabs = labOrders.length + savedLabCount

  return (
    <div className="bg-n-0 border border-n-200 rounded-md overflow-hidden">
      <div className="px-5 py-4 border-b border-n-100 flex items-center gap-2">
        <i className="ph ph-prescription text-[16px] text-p-500" />
        <h3 className="text-[13.5px] font-sans font-semibold text-n-800">Órdenes médicas</h3>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="px-2">
          <TabsTrigger value="medications" className="text-[12.5px] px-3 py-3">
            Medicamentos
            {totalMeds > 0 && (
              <span className="ml-2 font-mono text-[11px] text-p-600 bg-p-50 border border-p-100 rounded px-2">
                {totalMeds}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="imaging" className="text-[12.5px] px-3 py-3">
            Imagen
            {totalImaging > 0 && (
              <span className="ml-2 font-mono text-[11px] text-p-600 bg-p-50 border border-p-100 rounded px-2">
                {totalImaging}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="labs" className="text-[12.5px] px-3 py-3">
            Laboratorio
            {totalLabs > 0 && (
              <span className="ml-2 font-mono text-[11px] text-p-600 bg-p-50 border border-p-100 rounded px-2">
                {totalLabs}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Medications tab ── */}
        <TabsContent value="medications" className="p-4">
          {/* Saved prescriptions from DB */}
          {(savedPrescriptions.data ?? []).length > 0 && (
            <>
              {savedRxCount > 0 && !isSigned && medications.length > 0 && (
                <SectionLabel>Generadas</SectionLabel>
              )}
              {(savedPrescriptions.data ?? []).map((rx) => (
                <SavedPrescriptionCard
                  key={rx.id}
                  prescription={rx}
                  consultationId={consultationId}
                  isSigned={isSigned}
                  onDelete={(id) => deletePrescription.mutate(id)}
                  isDeleting={deletePrescription.isPending}
                />
              ))}
            </>
          )}

          {/* Queue (only when not signed) */}
          {!isSigned && (
            <>
              {savedRxCount > 0 && medications.length > 0 && <SectionLabel>En cola</SectionLabel>}
              {medicationGroups.map((group) => (
                <MedicationGroup
                  key={group.id}
                  group={group}
                  medications={medications.filter((m) => m.groupId === group.id)}
                  consultationId={consultationId}
                  onRemoveMedication={removeMedication}
                  onRemoveGroup={removeMedicationGroup}
                  isOnlyGroup={medicationGroups.length === 1}
                />
              ))}
              <div className="flex flex-col gap-2 mt-1">
                <AddMedicationForm groups={medicationGroups} onAdd={queueMedication} />
                <button
                  type="button"
                  onClick={() => addMedicationGroup()}
                  className="flex items-center gap-2 w-full py-2 text-[12px] font-sans text-n-400 hover:text-n-700 border border-n-100 rounded-sm hover:border-n-200 transition-colors bg-transparent justify-center"
                >
                  <i className="ph ph-plus text-[11px]" />
                  Nueva receta
                </button>
              </div>
            </>
          )}

          {/* Empty state when signed with no prescriptions */}
          {isSigned && savedRxCount === 0 && (
            <p className="text-[12.5px] text-n-400 py-2 px-1">Sin recetas en esta consulta.</p>
          )}
        </TabsContent>

        {/* ── Imaging tab ── */}
        <TabsContent value="imaging" className="p-4">
          {/* Saved imaging orders from DB */}
          {imagingGroups_saved.length > 0 && (
            <>
              {!isSigned && imagingOrders.length > 0 && <SectionLabel>Generadas</SectionLabel>}
              {imagingGroups_saved.map((g) => (
                <SavedImagingGroupCard
                  key={g.key}
                  groupTitle={g.title}
                  orders={g.orders}
                  isSigned={isSigned}
                  onDelete={(id) => deleteImagingOrder.mutate(id)}
                  isDeleting={deleteImagingOrder.isPending}
                />
              ))}
            </>
          )}

          {/* Queue (only when not signed) */}
          {!isSigned && (
            <>
              {imagingGroups_saved.length > 0 && imagingOrders.length > 0 && (
                <SectionLabel>En cola</SectionLabel>
              )}
              {imagingGroups.map((group) => (
                <ImagingGroup
                  key={group.id}
                  group={group}
                  orders={imagingOrders.filter((o) => o.groupId === group.id)}
                  consultationId={consultationId}
                  onRemoveOrder={removeImagingOrder}
                  onRemoveGroup={removeImagingGroup}
                  isOnlyGroup={imagingGroups.length === 1}
                />
              ))}
              <button
                type="button"
                onClick={() => addImagingGroup()}
                className="flex items-center gap-2 w-full py-2 text-[12px] font-sans text-n-400 hover:text-n-700 border border-n-100 rounded-sm hover:border-n-200 transition-colors bg-transparent justify-center"
              >
                <i className="ph ph-plus text-[11px]" />
                Nueva orden de imagen
              </button>
            </>
          )}

          {/* Empty state when signed */}
          {isSigned && imagingGroups_saved.length === 0 && (
            <p className="text-[12.5px] text-n-400 py-2 px-1">
              Sin órdenes de imagen en esta consulta.
            </p>
          )}
        </TabsContent>

        {/* ── Labs tab ── */}
        <TabsContent value="labs" className="p-4">
          {/* Saved lab orders from DB */}
          {labGroups_saved.length > 0 && (
            <>
              {!isSigned && labOrders.length > 0 && <SectionLabel>Generadas</SectionLabel>}
              {labGroups_saved.map((g) => (
                <SavedLabGroupCard
                  key={g.key}
                  groupTitle={g.title}
                  orders={g.orders}
                  isSigned={isSigned}
                  onDelete={(id) => deleteLabOrder.mutate(id)}
                  isDeleting={deleteLabOrder.isPending}
                />
              ))}
            </>
          )}

          {/* Queue (only when not signed) */}
          {!isSigned && (
            <>
              {labGroups_saved.length > 0 && labOrders.length > 0 && (
                <SectionLabel>En cola</SectionLabel>
              )}
              {labGroups.map((group) => (
                <LabGroup
                  key={group.id}
                  group={group}
                  orders={labOrders.filter((o) => o.groupId === group.id)}
                  consultationId={consultationId}
                  onRemoveOrder={removeLabOrder}
                  onRemoveGroup={removeLabGroup}
                  isOnlyGroup={labGroups.length === 1}
                />
              ))}
              <button
                type="button"
                onClick={() => addLabGroup()}
                className="flex items-center gap-2 w-full py-2 text-[12px] font-sans text-n-400 hover:text-n-700 border border-n-100 rounded-sm hover:border-n-200 transition-colors bg-transparent justify-center"
              >
                <i className="ph ph-plus text-[11px]" />
                Nuevo laboratorio
              </button>
            </>
          )}

          {/* Empty state when signed */}
          {isSigned && labGroups_saved.length === 0 && (
            <p className="text-[12.5px] text-n-400 py-2 px-1">
              Sin órdenes de laboratorio en esta consulta.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
