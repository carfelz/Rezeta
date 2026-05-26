import { useState, useRef, useEffect } from 'react'
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Button,
  Caption,
  Chip,
  DashedButton,
  GroupSectionCard,
  IconButton,
  Input,
  Overline,
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
  usePatchImagingOrder,
  usePatchLabOrder,
  useRenameImagingOrderGroup,
  useRenameLabOrderGroup,
} from '@/hooks/consultations/use-consultations'
import { apiClient, triggerDownload } from '@/lib/api-client'
import { orderQueueStrings } from './strings'

// ─── Shared helpers ───────────────────────────────────────────────────────────

const URGENCY_LABELS: Record<string, string> = {
  routine: orderQueueStrings.urgencyRoutine,
  urgent: orderQueueStrings.urgencyUrgent,
  stat: orderQueueStrings.urgencyStat,
}

const URGENCY_TONES = {
  stat: 'danger',
  urgent: 'warning',
  routine: 'neutral',
} as const

function UrgencyChip({ urgency }: { urgency: keyof typeof URGENCY_TONES }): JSX.Element {
  return (
    <Chip tone={URGENCY_TONES[urgency]} size="sm" format="uppercase">
      {URGENCY_LABELS[urgency]}
    </Chip>
  )
}

function SavedChip(): JSX.Element {
  return (
    <Chip tone="success" size="md" format="sentence">
      <i className="ph ph-check text-[10px]" />
      {orderQueueStrings.savedChip}
    </Chip>
  )
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
    <div className="mb-3">
      <GroupSectionCard
        title={
          <span className="flex items-center gap-2">
            <span className="text-[12.5px] font-semibold text-n-800">
              {prescription.groupTitle ??
                orderQueueStrings.prescriptionGroupFallback(prescription.groupOrder)}
            </span>
            <SavedChip />
          </span>
        }
        headerActions={
          !isSigned ? (
            <IconButton
              icon="ph ph-trash"
              aria-label={orderQueueStrings.deletePrescriptionLabel}
              tone="danger"
              size="sm"
              disabled={isDeleting}
              onClick={() => onDelete(prescription.id)}
            />
          ) : undefined
        }
        footer={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void handleDownloadPdf()}
            disabled={downloading}
          >
            {downloading ? (
              <>
                <i className="ph ph-spinner animate-spin mr-1 text-[11px]" />
                {orderQueueStrings.downloadingPdf}
              </>
            ) : (
              <>
                <i className="ph ph-download-simple mr-1 text-[12px]" />
                {orderQueueStrings.downloadPdf}
              </>
            )}
          </Button>
        }
      >
        <div className="divide-y divide-n-100">
          {prescription.prescriptionItems.map((item) => (
            <div key={item.id} className="px-4 py-3">
              <div className="text-[13px] font-semibold text-n-800">{item.drug}</div>
              <Caption tone="muted" size="md" as="div" className="font-mono mt-1">
                {item.dose} · {item.route} · {item.frequency}
                {item.duration && ` · ${item.duration}`}
              </Caption>
              {item.notes && (
                <Caption tone="muted" size="md" as="div" className="italic mt-1">
                  {item.notes}
                </Caption>
              )}
            </div>
          ))}
          {prescription.prescriptionItems.length === 0 && (
            <Caption tone="muted" size="lg" as="p" className="italic py-3 px-4 block">
              {orderQueueStrings.noMedications}
            </Caption>
          )}
        </div>
      </GroupSectionCard>
    </div>
  )
}

// ─── Saved imaging group card ────────────────────────────────────────────────

interface SavedImagingGroupCardProps {
  groupTitle: string
  groupOrder: number
  orders: ImagingOrder[]
  consultationId: string
  isSigned: boolean
  otherGroupOrders: number[]
  onDelete: (id: string) => void
  isDeleting: boolean
}

function SavedImagingGroupCard({
  groupTitle,
  groupOrder,
  orders,
  consultationId,
  isSigned,
  otherGroupOrders,
  onDelete,
  isDeleting,
}: SavedImagingGroupCardProps): JSX.Element {
  const [downloading, setDownloading] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(groupTitle)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const rename = useRenameImagingOrderGroup(consultationId)
  const patch = usePatchImagingOrder(consultationId)

  useEffect(() => {
    if (renaming) renameInputRef.current?.focus()
  }, [renaming])

  async function handleDownloadPdf(): Promise<void> {
    setDownloading(true)
    try {
      const blob = await apiClient.download(
        `/v1/consultations/${consultationId}/imaging-orders/group-pdf?groupOrder=${groupOrder}`,
      )
      triggerDownload(blob, `imagenes-g${groupOrder}.pdf`)
    } finally {
      setDownloading(false)
    }
  }

  function handleRenameSubmit(): void {
    rename.mutate({ groupOrder, dto: { groupTitle: renameValue || null } })
    setRenaming(false)
  }

  return (
    <div className="mb-3">
      <GroupSectionCard
        title={
          renaming ? (
            <div className="flex items-center gap-2">
              <Input
                ref={renameInputRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameSubmit()
                  if (e.key === 'Escape') setRenaming(false)
                }}
                className="h-6 text-[12px] py-0 px-2 w-36"
              />
              <Button variant="ghost" size="sm" onClick={handleRenameSubmit}>
                {orderQueueStrings.renameGroupSave}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setRenaming(false)}>
                {orderQueueStrings.renameGroupCancel}
              </Button>
            </div>
          ) : (
            <span className="flex items-center gap-2">
              <span className="text-[12.5px] font-semibold text-n-800">{groupTitle}</span>
              <SavedChip />
              {!isSigned && (
                <IconButton
                  icon="ph ph-pencil"
                  aria-label="Renombrar grupo"
                  tone="muted"
                  size="sm"
                  onClick={() => {
                    setRenameValue(groupTitle)
                    setRenaming(true)
                  }}
                />
              )}
            </span>
          )
        }
        footer={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void handleDownloadPdf()}
            disabled={downloading}
          >
            {downloading ? (
              <>
                <i className="ph ph-spinner animate-spin mr-1 text-[11px]" />
                {orderQueueStrings.downloadingImagingPdf}
              </>
            ) : (
              <>
                <i className="ph ph-file-pdf mr-1 text-[12px]" />
                {orderQueueStrings.downloadImagingPdf}
              </>
            )}
          </Button>
        }
      >
        <div className="divide-y divide-n-100">
          {orders.flatMap((order) =>
            order.items.map((item) => (
              <div key={item.id} className="flex items-start gap-3 px-4 py-3 group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-n-800">{item.studyType}</span>
                    <UrgencyChip urgency={item.urgency} />
                  </div>
                  <Caption tone="muted" size="md" as="div" className="mt-1">
                    {item.indication}
                  </Caption>
                  <div className="flex items-center gap-3 mt-1">
                    {item.contrast && (
                      <Caption tone="muted" size="xs" className="font-mono">
                        {orderQueueStrings.withContrast}
                      </Caption>
                    )}
                    {item.fastingRequired && (
                      <Caption tone="muted" size="xs" className="font-mono">
                        {orderQueueStrings.fastingRequired}
                      </Caption>
                    )}
                  </div>
                </div>
                {!isSigned && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 mt-1">
                    {otherGroupOrders.length > 0 && (
                      <Select
                        onValueChange={(val) =>
                          patch.mutate({ orderId: order.id, dto: { groupOrder: Number(val) } })
                        }
                      >
                        <SelectTrigger className="h-6 w-auto text-[11px] px-2 border-none shadow-none">
                          <SelectValue placeholder={orderQueueStrings.moveToGroup} />
                        </SelectTrigger>
                        <SelectContent>
                          {otherGroupOrders.map((g) => (
                            <SelectItem key={g} value={String(g)}>
                              {orderQueueStrings.moveToGroupLabel(g)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <IconButton
                      icon="ph ph-trash"
                      aria-label={orderQueueStrings.deleteOrderLabel}
                      tone="danger"
                      size="sm"
                      disabled={isDeleting}
                      onClick={() => onDelete(order.id)}
                    />
                  </div>
                )}
              </div>
            )),
          )}
        </div>
      </GroupSectionCard>
    </div>
  )
}

// ─── Saved lab group card ────────────────────────────────────────────────────

interface SavedLabGroupCardProps {
  groupTitle: string
  groupOrder: number
  orders: LabOrder[]
  consultationId: string
  isSigned: boolean
  otherGroupOrders: number[]
  onDelete: (id: string) => void
  isDeleting: boolean
}

function SavedLabGroupCard({
  groupTitle,
  groupOrder,
  orders,
  consultationId,
  isSigned,
  otherGroupOrders,
  onDelete,
  isDeleting,
}: SavedLabGroupCardProps): JSX.Element {
  const [downloading, setDownloading] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(groupTitle)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const rename = useRenameLabOrderGroup(consultationId)
  const patch = usePatchLabOrder(consultationId)

  useEffect(() => {
    if (renaming) renameInputRef.current?.focus()
  }, [renaming])

  async function handleDownloadPdf(): Promise<void> {
    setDownloading(true)
    try {
      const blob = await apiClient.download(
        `/v1/consultations/${consultationId}/lab-orders/group-pdf?groupOrder=${groupOrder}`,
      )
      triggerDownload(blob, `laboratorio-g${groupOrder}.pdf`)
    } finally {
      setDownloading(false)
    }
  }

  function handleRenameSubmit(): void {
    rename.mutate({ groupOrder, dto: { groupTitle: renameValue || null } })
    setRenaming(false)
  }

  return (
    <div className="mb-3">
      <GroupSectionCard
        title={
          renaming ? (
            <div className="flex items-center gap-2">
              <Input
                ref={renameInputRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameSubmit()
                  if (e.key === 'Escape') setRenaming(false)
                }}
                className="h-6 text-[12px] py-0 px-2 w-36"
              />
              <Button variant="ghost" size="sm" onClick={handleRenameSubmit}>
                {orderQueueStrings.renameGroupSave}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setRenaming(false)}>
                {orderQueueStrings.renameGroupCancel}
              </Button>
            </div>
          ) : (
            <span className="flex items-center gap-2">
              <span className="text-[12.5px] font-semibold text-n-800">{groupTitle}</span>
              <SavedChip />
              {!isSigned && (
                <IconButton
                  icon="ph ph-pencil"
                  aria-label="Renombrar grupo"
                  tone="muted"
                  size="sm"
                  onClick={() => {
                    setRenameValue(groupTitle)
                    setRenaming(true)
                  }}
                />
              )}
            </span>
          )
        }
        footer={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void handleDownloadPdf()}
            disabled={downloading}
          >
            {downloading ? (
              <>
                <i className="ph ph-spinner animate-spin mr-1 text-[11px]" />
                {orderQueueStrings.downloadingImagingPdf}
              </>
            ) : (
              <>
                <i className="ph ph-file-pdf mr-1 text-[12px]" />
                {orderQueueStrings.downloadLabPdf}
              </>
            )}
          </Button>
        }
      >
        <div className="divide-y divide-n-100">
          {orders.flatMap((order) =>
            order.items.map((item) => (
              <div key={item.id} className="flex items-start gap-3 px-4 py-3 group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-n-800">{item.testName}</span>
                  </div>
                  <Caption tone="muted" size="md" as="div" className="mt-1">
                    {item.indication}
                  </Caption>
                  <div className="flex items-center gap-3 mt-1">
                    <Caption tone="muted" size="xs" className="font-mono">
                      {URGENCY_LABELS[item.urgency]}
                    </Caption>
                    {item.fastingRequired && (
                      <Caption tone="muted" size="xs" className="font-mono">
                        {orderQueueStrings.fastingRequired}
                      </Caption>
                    )}
                    <Caption tone="muted" size="xs" className="font-mono capitalize">
                      {item.sampleType}
                    </Caption>
                  </div>
                </div>
                {!isSigned && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 mt-1">
                    {otherGroupOrders.length > 0 && (
                      <Select
                        onValueChange={(val) =>
                          patch.mutate({ orderId: order.id, dto: { groupOrder: Number(val) } })
                        }
                      >
                        <SelectTrigger className="h-6 w-auto text-[11px] px-2 border-none shadow-none">
                          <SelectValue placeholder={orderQueueStrings.moveToGroup} />
                        </SelectTrigger>
                        <SelectContent>
                          {otherGroupOrders.map((g) => (
                            <SelectItem key={g} value={String(g)}>
                              {orderQueueStrings.moveToGroupLabel(g)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <IconButton
                      icon="ph ph-trash"
                      aria-label={orderQueueStrings.deleteOrderLabel}
                      tone="danger"
                      size="sm"
                      disabled={isDeleting}
                      onClick={() => onDelete(order.id)}
                    />
                  </div>
                )}
              </div>
            )),
          )}
        </div>
      </GroupSectionCard>
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
      { onSuccess: () => onRemoveGroup(group.id) },
    )
  }

  // D8: flat medication list — display "Medicamentos N" instead of the group's
  // stored title (e.g. "Receta"). The group's title persists as the receta's
  // PDF title; multi-receta UI is removed but the data model is unchanged.
  const displayTitle = isOnlyGroup
    ? `${orderQueueStrings.tabMedications} ${medications.length}`
    : group.title

  return (
    <div className="mb-3">
      <GroupSectionCard
        title={displayTitle}
        headerActions={
          !isOnlyGroup ? (
            <IconButton
              icon="ph ph-x"
              aria-label={orderQueueStrings.deleteGroupLabel}
              tone="muted"
              size="sm"
              onClick={() => onRemoveGroup(group.id)}
            />
          ) : undefined
        }
        footer={
          <Button
            variant="secondary"
            size="sm"
            onClick={handleGenerate}
            disabled={medications.length === 0 || createPrescription.isPending}
          >
            {createPrescription.isPending ? (
              <>
                <i className="ph ph-spinner animate-spin mr-1 text-[11px]" />
                {orderQueueStrings.generatingPdf}
              </>
            ) : (
              <>
                <i className="ph ph-file-pdf mr-1 text-[12px]" />
                {orderQueueStrings.generatePrescription}
              </>
            )}
          </Button>
        }
      >
        {medications.length === 0 ? (
          <div className="px-4 py-3">
            <Caption tone="muted" size="lg" as="p" className="italic py-2 px-1 block">
              {orderQueueStrings.noMedicationsInGroup}
            </Caption>
          </div>
        ) : (
          <div className="divide-y divide-n-100">
            {medications.map((med) => (
              <div key={med.id} className="flex items-start gap-3 px-4 py-3 group">
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-n-800">{med.drug}</div>
                  <Caption tone="muted" size="md" as="div" className="font-mono mt-1">
                    {med.dose} · {med.route} · {med.frequency}
                    {med.duration && ` · ${med.duration}`}
                  </Caption>
                  {med.notes && (
                    <Caption tone="muted" size="md" as="div" className="italic mt-1">
                      {med.notes}
                    </Caption>
                  )}
                  {med.source && (
                    <Caption
                      tone="primary"
                      size="xs"
                      as="div"
                      className="font-mono mt-1 opacity-70"
                    >
                      {med.source}
                    </Caption>
                  )}
                </div>
                <IconButton
                  icon="ph ph-x"
                  aria-label={orderQueueStrings.removeMedicationLabel}
                  tone="muted"
                  size="sm"
                  onClick={() => onRemoveMedication(med.id)}
                  className="opacity-0 group-hover:opacity-100 mt-1"
                />
              </div>
            ))}
          </div>
        )}
      </GroupSectionCard>
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
        items: orders.map((o) => ({
          studyType: o.study_type,
          indication: o.indication,
          urgency: o.urgency,
          contrast: o.contrast,
          fastingRequired: o.fasting_required,
          ...(o.special_instructions ? { specialInstructions: o.special_instructions } : {}),
          ...(o.source ? { source: o.source } : {}),
        })),
      },
      { onSuccess: () => onRemoveGroup(group.id) },
    )
  }

  return (
    <div className="mb-3">
      <GroupSectionCard
        title={group.title}
        headerActions={
          !isOnlyGroup ? (
            <IconButton
              icon="ph ph-x"
              aria-label={orderQueueStrings.deleteGroupLabel}
              tone="muted"
              size="sm"
              onClick={() => onRemoveGroup(group.id)}
            />
          ) : undefined
        }
        footer={
          <Button
            variant="secondary"
            size="sm"
            onClick={handleGenerate}
            disabled={orders.length === 0 || createImagingOrder.isPending}
          >
            {createImagingOrder.isPending ? (
              <>
                <i className="ph ph-spinner animate-spin mr-1 text-[11px]" />
                {orderQueueStrings.generatingPdf}
              </>
            ) : (
              <>
                <i className="ph ph-file-pdf mr-1 text-[12px]" />
                {orderQueueStrings.generateImaging}
              </>
            )}
          </Button>
        }
      >
        {orders.length === 0 ? (
          <div className="px-4 py-3">
            <Caption tone="muted" size="lg" as="p" className="italic py-2 px-1 block">
              {orderQueueStrings.noImageStudiesInGroup}
            </Caption>
          </div>
        ) : (
          <div className="divide-y divide-n-100">
            {orders.map((order) => (
              <div key={order.id} className="flex items-start gap-3 px-4 py-3 group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-n-800">{order.study_type}</span>
                    <UrgencyChip urgency={order.urgency} />
                  </div>
                  <Caption tone="muted" size="md" as="div" className="mt-1">
                    {order.indication}
                  </Caption>
                  <div className="flex items-center gap-3 mt-1">
                    {order.contrast && (
                      <Caption tone="muted" size="xs" className="font-mono">
                        {orderQueueStrings.withContrast}
                      </Caption>
                    )}
                    {order.fasting_required && (
                      <Caption tone="muted" size="xs" className="font-mono">
                        {orderQueueStrings.fastingRequired}
                      </Caption>
                    )}
                    {order.special_instructions && (
                      <Caption tone="muted" size="xs" className="italic">
                        {order.special_instructions}
                      </Caption>
                    )}
                  </div>
                </div>
                <IconButton
                  icon="ph ph-x"
                  aria-label={orderQueueStrings.removeStudyLabel}
                  tone="muted"
                  size="sm"
                  onClick={() => onRemoveOrder(order.id)}
                  className="opacity-0 group-hover:opacity-100 mt-1"
                />
              </div>
            ))}
          </div>
        )}
      </GroupSectionCard>
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
        items: orders.map((o) => ({
          testName: o.test_name,
          indication: o.indication,
          urgency: o.urgency,
          fastingRequired: o.fasting_required,
          sampleType: o.sample_type === 'other' ? 'other' : o.sample_type,
          ...(o.special_instructions ? { specialInstructions: o.special_instructions } : {}),
          ...(o.source ? { source: o.source } : {}),
        })),
      },
      { onSuccess: () => onRemoveGroup(group.id) },
    )
  }

  return (
    <div className="mb-3">
      <GroupSectionCard
        title={group.title}
        headerActions={
          !isOnlyGroup ? (
            <IconButton
              icon="ph ph-x"
              aria-label={orderQueueStrings.deleteGroupLabel}
              tone="muted"
              size="sm"
              onClick={() => onRemoveGroup(group.id)}
            />
          ) : undefined
        }
        footer={
          <Button
            variant="secondary"
            size="sm"
            onClick={handleGenerate}
            disabled={orders.length === 0 || createLabOrder.isPending}
          >
            {createLabOrder.isPending ? (
              <>
                <i className="ph ph-spinner animate-spin mr-1 text-[11px]" />
                {orderQueueStrings.generatingPdf}
              </>
            ) : (
              <>
                <i className="ph ph-file-pdf mr-1 text-[12px]" />
                {orderQueueStrings.generateLab}
              </>
            )}
          </Button>
        }
      >
        {orders.length === 0 ? (
          <div className="px-4 py-3">
            <Caption tone="muted" size="lg" as="p" className="italic py-2 px-1 block">
              {orderQueueStrings.noImageStudiesInGroup}
            </Caption>
          </div>
        ) : (
          <div className="divide-y divide-n-100">
            {orders.map((order) => (
              <div key={order.id} className="flex items-start gap-3 px-4 py-3 group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-n-800">{order.test_name}</span>
                    {order.test_code && (
                      <Caption tone="muted" size="xs" className="font-mono">
                        {order.test_code}
                      </Caption>
                    )}
                  </div>
                  <Caption tone="muted" size="md" as="div" className="mt-1">
                    {order.indication}
                  </Caption>
                  <div className="flex items-center gap-3 mt-1">
                    <Caption tone="muted" size="xs" className="font-mono">
                      {URGENCY_LABELS[order.urgency]}
                    </Caption>
                    {order.fasting_required && (
                      <Caption tone="muted" size="xs" className="font-mono">
                        {orderQueueStrings.fastingRequired}
                      </Caption>
                    )}
                    {order.special_instructions && (
                      <Caption tone="muted" size="xs" className="italic">
                        {order.special_instructions}
                      </Caption>
                    )}
                  </div>
                </div>
                <IconButton
                  icon="ph ph-x"
                  aria-label={orderQueueStrings.removeStudyLabel}
                  tone="muted"
                  size="sm"
                  onClick={() => onRemoveOrder(order.id)}
                  className="opacity-0 group-hover:opacity-100 mt-1"
                />
              </div>
            ))}
          </div>
        )}
      </GroupSectionCard>
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
      <DashedButton tone="neutral" size="sm" onClick={() => setOpen(true)}>
        <i className="ph ph-plus text-[12px]" />
        {orderQueueStrings.addMedicationButton}
      </DashedButton>
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

  return (
    <div className="bg-n-0 border border-n-200 rounded-md p-4 mb-3">
      <Overline tone="muted" size="lg" className="mb-3">
        {orderQueueStrings.newMedicationTitle}
      </Overline>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="col-span-2">
          <Input
            placeholder={orderQueueStrings.drugPlaceholder}
            value={drug}
            onChange={(e) => setDrug(e.target.value)}
          />
        </div>
        <Input
          placeholder={orderQueueStrings.dosePlaceholder}
          value={dose}
          onChange={(e) => setDose(e.target.value)}
        />
        <Input
          placeholder={orderQueueStrings.routePlaceholder}
          value={route}
          onChange={(e) => setRoute(e.target.value)}
        />
        <Input
          placeholder={orderQueueStrings.frequencyPlaceholder}
          value={frequency}
          onChange={(e) => setFrequency(e.target.value)}
        />
        <Input
          placeholder={orderQueueStrings.durationPlaceholder}
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
        />
        <div className="col-span-2">
          <Input
            placeholder={orderQueueStrings.notesPlaceholder}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        {groups.length > 1 && (
          <div className="col-span-2">
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger>
                <SelectValue placeholder={orderQueueStrings.prescriptionSelectPlaceholder} />
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
          {orderQueueStrings.cancelButton}
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleSubmit}
          disabled={!drug.trim() || !dose.trim() || !route.trim() || !frequency.trim()}
        >
          {orderQueueStrings.addButton}
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

  const savedPrescriptions = useListPrescriptions(consultationId)
  const savedImagingOrders = useListImagingOrders(consultationId)
  const savedLabOrders = useListLabOrders(consultationId)

  const deletePrescription = useDeletePrescription(consultationId)
  const deleteImagingOrder = useDeleteImagingOrder(consultationId)
  const deleteLabOrder = useDeleteLabOrder(consultationId)

  const imagingGroups_saved = (savedImagingOrders.data ?? []).reduce<
    { key: string; title: string; groupOrder: number; orders: ImagingOrder[] }[]
  >((acc, order) => {
    const key = `${order.groupOrder}-${order.groupTitle ?? ''}`
    const existing = acc.find((g) => g.key === key)
    if (existing) {
      existing.orders.push(order)
    } else {
      acc.push({
        key,
        title: order.groupTitle ?? orderQueueStrings.imagingGroupFallback(order.groupOrder),
        groupOrder: order.groupOrder,
        orders: [order],
      })
    }
    return acc
  }, [])

  const labGroups_saved = (savedLabOrders.data ?? []).reduce<
    { key: string; title: string; groupOrder: number; orders: LabOrder[] }[]
  >((acc, order) => {
    const key = `${order.groupOrder}-${order.groupTitle ?? ''}`
    const existing = acc.find((g) => g.key === key)
    if (existing) {
      existing.orders.push(order)
    } else {
      acc.push({
        key,
        title: order.groupTitle ?? orderQueueStrings.labGroupFallback(order.groupOrder),
        groupOrder: order.groupOrder,
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
        <h3 className="text-[13.5px] font-semibold text-n-800">{orderQueueStrings.panelTitle}</h3>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="px-2">
          <TabRailTrigger
            value="medications"
            label={orderQueueStrings.tabMedications}
            count={totalMeds}
          />
          <TabRailTrigger
            value="imaging"
            label={orderQueueStrings.tabImaging}
            count={totalImaging}
          />
          <TabRailTrigger value="labs" label={orderQueueStrings.tabLabs} count={totalLabs} />
        </TabsList>

        <TabsContent value="medications" className="p-4">
          {(savedPrescriptions.data ?? []).length > 0 && (
            <>
              {savedRxCount > 0 && !isSigned && medications.length > 0 && (
                <Overline tone="neutral" size="sm" className="px-1 mb-2">
                  {orderQueueStrings.generatedLabel}
                </Overline>
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

          {!isSigned && (
            <>
              {savedRxCount > 0 && medications.length > 0 && (
                <Overline tone="neutral" size="sm" className="px-1 mb-2">
                  {orderQueueStrings.queuedLabel}
                </Overline>
              )}
              {medicationGroups.map((group) => {
                const groupMeds = medications.filter((m) => m.groupId === group.id)
                const isOnlyGroup = medicationGroups.length === 1
                // hide the empty single-group card so the tab starts clean
                if (isOnlyGroup && groupMeds.length === 0) return null
                return (
                  <MedicationGroup
                    key={group.id}
                    group={group}
                    medications={groupMeds}
                    consultationId={consultationId}
                    onRemoveMedication={removeMedication}
                    onRemoveGroup={removeMedicationGroup}
                    isOnlyGroup={isOnlyGroup}
                  />
                )
              })}
              <div className="flex flex-col gap-2 mt-1">
                <AddMedicationForm groups={medicationGroups} onAdd={queueMedication} />
              </div>
            </>
          )}

          {isSigned && savedRxCount === 0 && (
            <Caption tone="muted" size="lg" as="p" className="py-2 px-1 block">
              {orderQueueStrings.noRxSigned}
            </Caption>
          )}
        </TabsContent>

        <TabsContent value="imaging" className="p-4">
          {imagingGroups_saved.length > 0 && (
            <>
              {!isSigned && imagingOrders.length > 0 && (
                <Overline tone="neutral" size="sm" className="px-1 mb-2">
                  {orderQueueStrings.generatedLabel}
                </Overline>
              )}
              {imagingGroups_saved.map((g) => (
                <SavedImagingGroupCard
                  key={g.key}
                  groupTitle={g.title}
                  groupOrder={g.groupOrder}
                  orders={g.orders}
                  consultationId={consultationId}
                  isSigned={isSigned}
                  otherGroupOrders={imagingGroups_saved
                    .filter((other) => other.groupOrder !== g.groupOrder)
                    .map((other) => other.groupOrder)}
                  onDelete={(id) => deleteImagingOrder.mutate(id)}
                  isDeleting={deleteImagingOrder.isPending}
                />
              ))}
            </>
          )}

          {!isSigned && (
            <>
              {imagingGroups_saved.length > 0 && imagingOrders.length > 0 && (
                <Overline tone="neutral" size="sm" className="px-1 mb-2">
                  {orderQueueStrings.queuedLabel}
                </Overline>
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
              <DashedButton tone="subtle" size="sm" onClick={() => addImagingGroup()}>
                <i className="ph ph-plus text-[11px]" />
                {orderQueueStrings.newImagingOrder}
              </DashedButton>
            </>
          )}

          {isSigned && imagingGroups_saved.length === 0 && (
            <Caption tone="muted" size="lg" as="p" className="py-2 px-1 block">
              {orderQueueStrings.noImagingSigned}
            </Caption>
          )}
        </TabsContent>

        <TabsContent value="labs" className="p-4">
          {labGroups_saved.length > 0 && (
            <>
              {!isSigned && labOrders.length > 0 && (
                <Overline tone="neutral" size="sm" className="px-1 mb-2">
                  {orderQueueStrings.generatedLabel}
                </Overline>
              )}
              {labGroups_saved.map((g) => (
                <SavedLabGroupCard
                  key={g.key}
                  groupTitle={g.title}
                  groupOrder={g.groupOrder}
                  orders={g.orders}
                  consultationId={consultationId}
                  isSigned={isSigned}
                  otherGroupOrders={labGroups_saved
                    .filter((other) => other.groupOrder !== g.groupOrder)
                    .map((other) => other.groupOrder)}
                  onDelete={(id) => deleteLabOrder.mutate(id)}
                  isDeleting={deleteLabOrder.isPending}
                />
              ))}
            </>
          )}

          {!isSigned && (
            <>
              {labGroups_saved.length > 0 && labOrders.length > 0 && (
                <Overline tone="neutral" size="sm" className="px-1 mb-2">
                  {orderQueueStrings.queuedLabel}
                </Overline>
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
              <DashedButton tone="subtle" size="sm" onClick={() => addLabGroup()}>
                <i className="ph ph-plus text-[11px]" />
                {orderQueueStrings.newLabOrder}
              </DashedButton>
            </>
          )}

          {isSigned && labGroups_saved.length === 0 && (
            <Caption tone="muted" size="lg" as="p" className="py-2 px-1 block">
              {orderQueueStrings.noLabsSigned}
            </Caption>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function TabRailTrigger({
  value,
  label,
  count,
}: {
  value: string
  label: string
  count: number
}): JSX.Element {
  return (
    <TabsTrigger value={value} className="text-[12.5px] px-3 py-3">
      {label}
      {count > 0 && (
        <Chip tone="primarySolid" size="md" className="ml-2">
          {count}
        </Chip>
      )}
    </TabsTrigger>
  )
}
