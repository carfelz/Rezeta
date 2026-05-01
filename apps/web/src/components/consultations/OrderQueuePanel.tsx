import { useState } from 'react'
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
} from '@/hooks/consultations/use-consultations'
import { cn } from '@/lib/utils'

// ─── Shared helpers ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div className="text-[10.5px] font-mono uppercase tracking-[0.08em] text-n-400 px-1 mb-2">
      {children}
    </div>
  )
}

function EmptyGroupMessage(): JSX.Element {
  return (
    <p className="text-[12.5px] text-n-300 italic py-2 px-1">Sin medicamentos en este grupo.</p>
  )
}

// ─── Medication group ─────────────────────────────────────────────────────────

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
  const [generated, setGenerated] = useState(false)

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
      { onSuccess: () => setGenerated(true) },
    )
  }

  return (
    <div className="bg-n-0 border border-n-200 rounded-md overflow-hidden mb-3">
      <div className="flex items-center justify-between px-4 py-2.5 bg-n-25 border-b border-n-100">
        <span className="text-[12.5px] font-sans font-semibold text-n-800">{group.title}</span>
        <div className="flex items-center gap-1.5">
          {generated && (
            <span className="text-[11px] font-mono text-success-text bg-success-bg border border-success-border rounded px-2 py-0.5 flex items-center gap-1">
              <i className="ph ph-check text-[10px]" />
              Generado
            </span>
          )}
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
      </div>

      {medications.length === 0 ? (
        <div className="px-4 py-3">
          <EmptyGroupMessage />
        </div>
      ) : (
        <div className="divide-y divide-n-100">
          {medications.map((med) => (
            <div key={med.id} className="flex items-start gap-3 px-4 py-3 group">
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-sans font-semibold text-n-800">{med.drug}</div>
                <div className="text-[12px] font-mono text-n-500 mt-0.5">
                  {med.dose} · {med.route} · {med.frequency}
                  {med.duration && ` · ${med.duration}`}
                </div>
                {med.notes && (
                  <div className="text-[12px] font-sans text-n-500 mt-0.5 italic">{med.notes}</div>
                )}
                {med.source && (
                  <div className="text-[11px] font-mono text-p-600 mt-0.5 opacity-70">
                    {med.source}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => onRemoveMedication(med.id)}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-n-100 text-n-300 hover:text-n-700 transition-colors opacity-0 group-hover:opacity-100 shrink-0 mt-0.5"
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
          disabled={medications.length === 0 || createPrescription.isPending || generated}
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

// ─── Imaging group ────────────────────────────────────────────────────────────

interface ImagingGroupProps {
  group: OrderGroup
  orders: QueuedImagingOrder[]
  consultationId: string
  onRemoveOrder: (id: string) => void
  onRemoveGroup: (id: string) => void
  isOnlyGroup: boolean
}

const URGENCY_LABELS: Record<string, string> = {
  routine: 'Rutina',
  urgent: 'Urgente',
  stat: 'Stat',
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
  const [generated, setGenerated] = useState(false)

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
      { onSuccess: () => setGenerated(true) },
    )
  }

  return (
    <div className="bg-n-0 border border-n-200 rounded-md overflow-hidden mb-3">
      <div className="flex items-center justify-between px-4 py-2.5 bg-n-25 border-b border-n-100">
        <span className="text-[12.5px] font-sans font-semibold text-n-800">{group.title}</span>
        <div className="flex items-center gap-1.5">
          {generated && (
            <span className="text-[11px] font-mono text-success-text bg-success-bg border border-success-border rounded px-2 py-0.5 flex items-center gap-1">
              <i className="ph ph-check text-[10px]" />
              Generado
            </span>
          )}
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
                      'text-[10.5px] font-mono px-1.5 py-px rounded border',
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
                <div className="text-[12px] font-sans text-n-500 mt-0.5">{order.indication}</div>
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
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-n-100 text-n-300 hover:text-n-700 transition-colors opacity-0 group-hover:opacity-100 shrink-0 mt-0.5"
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
          disabled={orders.length === 0 || createImagingOrder.isPending || generated}
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

// ─── Lab group ────────────────────────────────────────────────────────────────

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
  const [generated, setGenerated] = useState(false)

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
      { onSuccess: () => setGenerated(true) },
    )
  }

  return (
    <div className="bg-n-0 border border-n-200 rounded-md overflow-hidden mb-3">
      <div className="flex items-center justify-between px-4 py-2.5 bg-n-25 border-b border-n-100">
        <span className="text-[12.5px] font-sans font-semibold text-n-800">{group.title}</span>
        <div className="flex items-center gap-1.5">
          {generated && (
            <span className="text-[11px] font-mono text-success-text bg-success-bg border border-success-border rounded px-2 py-0.5 flex items-center gap-1">
              <i className="ph ph-check text-[10px]" />
              Generado
            </span>
          )}
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
      </div>

      {orders.length === 0 ? (
        <div className="px-4 py-3">
          <p className="text-[12.5px] text-n-300 italic py-2 px-1">
            Sin pruebas en este laboratorio.
          </p>
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
                    <span className="text-[10.5px] font-mono text-n-400 bg-n-50 border border-n-200 rounded px-1.5 py-px">
                      {order.test_code}
                    </span>
                  )}
                  <span
                    className={cn(
                      'text-[10.5px] font-mono px-1.5 py-px rounded border',
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
                <div className="text-[12px] font-sans text-n-500 mt-0.5">{order.indication}</div>
                <div className="flex items-center gap-3 mt-1 text-[11px] font-mono text-n-400">
                  <span>{order.sample_type}</span>
                  {order.fasting_required && <span>En ayunas</span>}
                  {order.special_instructions && (
                    <span className="italic">{order.special_instructions}</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRemoveOrder(order.id)}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-n-100 text-n-300 hover:text-n-700 transition-colors opacity-0 group-hover:opacity-100 shrink-0 mt-0.5"
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
          disabled={orders.length === 0 || createLabOrder.isPending || generated}
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
    'w-full h-[32px] px-2.5 text-[12.5px] font-sans border border-n-300 rounded-sm focus:border-p-500 focus:outline-none bg-n-0 text-n-700 placeholder:text-n-300'

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
}

export function OrderQueuePanel({ consultationId }: OrderQueuePanelProps): JSX.Element {
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
  } = useOrderQueueStore()

  const totalMeds = medications.length
  const totalImaging = imagingOrders.length
  const totalLabs = labOrders.length

  return (
    <div className="bg-n-0 border border-n-200 rounded-md overflow-hidden">
      <div className="px-5 py-3.5 border-b border-n-100 flex items-center gap-2">
        <i className="ph ph-prescription text-[16px] text-p-500" />
        <h3 className="text-[13.5px] font-sans font-semibold text-n-800">Órdenes médicas</h3>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="px-2">
          <TabsTrigger value="medications" className="text-[12.5px] px-3 py-2.5">
            Medicamentos
            {totalMeds > 0 && (
              <span className="ml-1.5 font-mono text-[11px] text-p-600 bg-p-50 border border-p-100 rounded px-1.5">
                {totalMeds}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="imaging" className="text-[12.5px] px-3 py-2.5">
            Imagen
            {totalImaging > 0 && (
              <span className="ml-1.5 font-mono text-[11px] text-p-600 bg-p-50 border border-p-100 rounded px-1.5">
                {totalImaging}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="labs" className="text-[12.5px] px-3 py-2.5">
            Laboratorio
            {totalLabs > 0 && (
              <span className="ml-1.5 font-mono text-[11px] text-p-600 bg-p-50 border border-p-100 rounded px-1.5">
                {totalLabs}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Medications tab ── */}
        <TabsContent value="medications" className="p-4">
          {medicationGroups.length > 1 && <SectionLabel>Recetas</SectionLabel>}
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
        </TabsContent>

        {/* ── Imaging tab ── */}
        <TabsContent value="imaging" className="p-4">
          {imagingGroups.length > 1 && <SectionLabel>Órdenes de imagen</SectionLabel>}
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
        </TabsContent>

        {/* ── Labs tab ── */}
        <TabsContent value="labs" className="p-4">
          {labGroups.length > 1 && <SectionLabel>Órdenes de laboratorio</SectionLabel>}
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
        </TabsContent>
      </Tabs>
    </div>
  )
}
