import { create } from 'zustand'

export type OrderTab = 'medications' | 'imaging' | 'labs'

export interface QueuedMedication {
  id: string
  drug: string
  dose: string
  route: string
  frequency: string
  duration: string
  notes?: string
  source?: string
  groupId: string
}

export interface QueuedImagingOrder {
  id: string
  study_type: string
  indication: string
  urgency: 'routine' | 'urgent' | 'stat'
  contrast: boolean
  fasting_required: boolean
  special_instructions?: string
  source?: string
  groupId: string
}

export interface QueuedLabOrder {
  id: string
  test_name: string
  test_code?: string
  indication: string
  urgency: 'routine' | 'urgent' | 'stat'
  fasting_required: boolean
  sample_type: 'blood' | 'urine' | 'stool' | 'other'
  special_instructions?: string
  source?: string
  groupId: string
}

export interface OrderGroup {
  id: string
  title: string
  order: number
  /**
   * Per-instance idempotency key sent to the API as `clientRequestId`. Unlike
   * `id` (a stable display id used only for local grouping — e.g. the default
   * medication group always uses `'default-rx'`), `requestId` is regenerated
   * every time a group instance is created so a retried flush POST is
   * recognized server-side as the same request.
   */
  requestId: string
}

interface OrderQueueState {
  activeTab: OrderTab
  medicationGroups: OrderGroup[]
  medications: QueuedMedication[]
  imagingGroups: OrderGroup[]
  imagingOrders: QueuedImagingOrder[]
  labGroups: OrderGroup[]
  labOrders: QueuedLabOrder[]

  setActiveTab: (tab: OrderTab) => void

  // Medication actions
  addMedicationGroup: (title?: string) => string
  removeMedicationGroup: (groupId: string) => void
  queueMedication: (med: Omit<QueuedMedication, 'id' | 'groupId'>, groupId?: string) => void
  removeMedication: (id: string) => void
  updateMedication: (id: string, updates: Partial<QueuedMedication>) => void

  // Imaging actions
  addImagingGroup: (title?: string) => string
  removeImagingGroup: (groupId: string) => void
  queueImagingOrder: (order: Omit<QueuedImagingOrder, 'id' | 'groupId'>, groupId?: string) => void
  removeImagingOrder: (id: string) => void

  // Lab actions
  addLabGroup: (title?: string) => string
  removeLabGroup: (groupId: string) => void
  queueLabOrder: (order: Omit<QueuedLabOrder, 'id' | 'groupId'>, groupId?: string) => void
  removeLabOrder: (id: string) => void

  reset: () => void
  restoreSnapshot: (snapshot: {
    medicationGroups: Array<Partial<Pick<OrderGroup, 'requestId'>> & Omit<OrderGroup, 'requestId'>>
    medications: QueuedMedication[]
    imagingGroups: Array<Partial<Pick<OrderGroup, 'requestId'>> & Omit<OrderGroup, 'requestId'>>
    imagingOrders: QueuedImagingOrder[]
    labGroups: Array<Partial<Pick<OrderGroup, 'requestId'>> & Omit<OrderGroup, 'requestId'>>
    labOrders: QueuedLabOrder[]
  }) => void
}

function makeId(): string {
  return Math.random().toString(36).slice(2)
}

/** Backfills a fresh requestId for groups restored from a pre-idempotency localStorage snapshot. */
function withRequestId(
  groups: Array<Partial<Pick<OrderGroup, 'requestId'>> & Omit<OrderGroup, 'requestId'>>,
): OrderGroup[] {
  return groups.map((g) => ({ ...g, requestId: g.requestId ?? crypto.randomUUID() }))
}

function makeDefaultMedicationGroup(): OrderGroup {
  return { id: 'default-rx', title: 'Receta', order: 1, requestId: crypto.randomUUID() }
}

function makeDefaultImagingGroup(): OrderGroup {
  return { id: 'default-img', title: 'Orden 1', order: 1, requestId: crypto.randomUUID() }
}

function makeDefaultLabGroup(): OrderGroup {
  return { id: 'default-lab', title: 'Laboratorio 1', order: 1, requestId: crypto.randomUUID() }
}

// Every group in this default id/title/order set is re-derived fresh (via the
// make* factories) on each call — including on `reset()` — so its requestId
// is never reused across store instances or consultations.
function makeInitialState(): Omit<
  OrderQueueState,
  | 'setActiveTab'
  | 'addMedicationGroup'
  | 'removeMedicationGroup'
  | 'queueMedication'
  | 'removeMedication'
  | 'updateMedication'
  | 'addImagingGroup'
  | 'removeImagingGroup'
  | 'queueImagingOrder'
  | 'removeImagingOrder'
  | 'addLabGroup'
  | 'removeLabGroup'
  | 'queueLabOrder'
  | 'removeLabOrder'
  | 'reset'
  | 'restoreSnapshot'
> {
  return {
    activeTab: 'medications',
    medicationGroups: [makeDefaultMedicationGroup()],
    medications: [],
    imagingGroups: [makeDefaultImagingGroup()],
    imagingOrders: [],
    labGroups: [makeDefaultLabGroup()],
    labOrders: [],
  }
}

export const useOrderQueueStore = create<OrderQueueState>((set, get) => ({
  ...makeInitialState(),

  setActiveTab: (tab) => set({ activeTab: tab }),

  // ── Medications ──────────────────────────────────────────────────────────

  addMedicationGroup: (title) => {
    const id = makeId()
    set((s) => ({
      medicationGroups: [
        ...s.medicationGroups,
        {
          id,
          title: title ?? `Receta ${s.medicationGroups.length + 1}`,
          order: s.medicationGroups.length + 1,
          requestId: crypto.randomUUID(),
        },
      ],
    }))
    return id
  },

  removeMedicationGroup: (groupId) =>
    set((s) => ({
      medicationGroups: s.medicationGroups.filter((g) => g.id !== groupId),
      medications: s.medications.filter((m) => m.groupId !== groupId),
    })),

  queueMedication: (med, groupId) => {
    const targetGroupId = groupId ?? get().medicationGroups[0]?.id ?? 'default-rx'
    set((s) => ({
      medications: [...s.medications, { ...med, id: makeId(), groupId: targetGroupId }],
      activeTab: 'medications',
    }))
  },

  removeMedication: (id) => set((s) => ({ medications: s.medications.filter((m) => m.id !== id) })),

  updateMedication: (id, updates) =>
    set((s) => ({
      medications: s.medications.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    })),

  // ── Imaging ──────────────────────────────────────────────────────────────

  addImagingGroup: (title) => {
    const id = makeId()
    set((s) => ({
      imagingGroups: [
        ...s.imagingGroups,
        {
          id,
          title: title ?? `Orden ${s.imagingGroups.length + 1}`,
          order: s.imagingGroups.length + 1,
          requestId: crypto.randomUUID(),
        },
      ],
    }))
    return id
  },

  removeImagingGroup: (groupId) =>
    set((s) => ({
      imagingGroups: s.imagingGroups.filter((g) => g.id !== groupId),
      imagingOrders: s.imagingOrders.filter((o) => o.groupId !== groupId),
    })),

  queueImagingOrder: (order, groupId) => {
    const targetGroupId = groupId ?? get().imagingGroups[0]?.id ?? 'default-img'
    set((s) => ({
      imagingOrders: [...s.imagingOrders, { ...order, id: makeId(), groupId: targetGroupId }],
      activeTab: 'imaging',
    }))
  },

  removeImagingOrder: (id) =>
    set((s) => ({ imagingOrders: s.imagingOrders.filter((o) => o.id !== id) })),

  // ── Labs ──────────────────────────────────────────────────────────────────

  addLabGroup: (title) => {
    const id = makeId()
    set((s) => ({
      labGroups: [
        ...s.labGroups,
        {
          id,
          title: title ?? `Laboratorio ${s.labGroups.length + 1}`,
          order: s.labGroups.length + 1,
          requestId: crypto.randomUUID(),
        },
      ],
    }))
    return id
  },

  removeLabGroup: (groupId) =>
    set((s) => ({
      labGroups: s.labGroups.filter((g) => g.id !== groupId),
      labOrders: s.labOrders.filter((o) => o.groupId !== groupId),
    })),

  queueLabOrder: (order, groupId) => {
    const targetGroupId = groupId ?? get().labGroups[0]?.id ?? 'default-lab'
    set((s) => ({
      labOrders: [...s.labOrders, { ...order, id: makeId(), groupId: targetGroupId }],
      activeTab: 'labs',
    }))
  },

  removeLabOrder: (id) => set((s) => ({ labOrders: s.labOrders.filter((o) => o.id !== id) })),

  reset: () => set(makeInitialState()),

  restoreSnapshot: (snapshot) =>
    set({
      medicationGroups: withRequestId(snapshot.medicationGroups),
      medications: snapshot.medications,
      imagingGroups: withRequestId(snapshot.imagingGroups),
      imagingOrders: snapshot.imagingOrders,
      labGroups: withRequestId(snapshot.labGroups),
      labOrders: snapshot.labOrders,
    }),
}))
