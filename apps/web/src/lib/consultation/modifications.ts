import type {
  ProtocolUsageModifications,
  MedicationAdded,
  ImagingOrderQueued,
  LabOrderQueued,
  ChecklistItemEvent,
  DecisionBranchSelected,
  StepEvent,
  VitalsEnteredEvent,
  NotesEditedEvent,
} from '@rezeta/shared'

export type BlockModificationEvent =
  | { type: 'step_completed'; step_id: string }
  | { type: 'checklist_item'; item_id: string; checked: boolean }
  | {
      type: 'decision_branch'
      decision_id: string
      branch_id: string
      linked_protocol_launched: boolean
    }
  | { type: 'imaging_queued'; order_id: string; study_type: string }
  | {
      type: 'medication_queued'
      block_id: string
      row_id: string
      drug: string
      dose: string
      route: string
      frequency: string
      notes?: string
    }
  | { type: 'lab_queued'; order_id: string; test_name: string }
  | { type: 'vitals_entered'; block_id: string; values: Record<string, string | number> }
  | { type: 'notes_edited'; block_id: string; length: number }

export function appendModification(
  existing: ProtocolUsageModifications,
  event: BlockModificationEvent,
  timestamp = new Date().toISOString(),
): ProtocolUsageModifications {
  switch (event.type) {
    case 'step_completed': {
      const entry: StepEvent = { step_id: event.step_id, timestamp }
      return { ...existing, steps_completed: [...(existing.steps_completed ?? []), entry] }
    }
    case 'checklist_item': {
      const entry: ChecklistItemEvent = {
        item_id: event.item_id,
        checked: event.checked,
        timestamp,
      }
      return { ...existing, checklist_items: [...(existing.checklist_items ?? []), entry] }
    }
    case 'decision_branch': {
      const entry: DecisionBranchSelected = {
        decision_id: event.decision_id,
        branch_id: event.branch_id,
        linked_protocol_launched: event.linked_protocol_launched,
        timestamp,
      }
      return { ...existing, decision_branches: [...(existing.decision_branches ?? []), entry] }
    }
    case 'imaging_queued': {
      const entry: ImagingOrderQueued = {
        order_id: event.order_id,
        study_type: event.study_type,
        timestamp,
      }
      return {
        ...existing,
        imaging_orders_queued: [...(existing.imaging_orders_queued ?? []), entry],
      }
    }
    case 'medication_queued': {
      const entry: MedicationAdded = {
        block_id: event.block_id,
        row_id: event.row_id,
        drug: event.drug,
        dose: event.dose,
        route: event.route,
        frequency: event.frequency,
        ...(event.notes ? { notes: event.notes } : {}),
        timestamp,
      }
      return { ...existing, medications_added: [...(existing.medications_added ?? []), entry] }
    }
    case 'lab_queued': {
      const entry: LabOrderQueued = {
        order_id: event.order_id,
        test_name: event.test_name,
        timestamp,
      }
      return { ...existing, lab_orders_queued: [...(existing.lab_orders_queued ?? []), entry] }
    }
    case 'vitals_entered': {
      const entry: VitalsEnteredEvent = {
        block_id: event.block_id,
        values: event.values,
        timestamp,
      }
      return { ...existing, vitals_entered: [...(existing.vitals_entered ?? []), entry] }
    }
    case 'notes_edited': {
      const entry: NotesEditedEvent = {
        block_id: event.block_id,
        length: event.length,
        timestamp,
      }
      return { ...existing, notes_edited: [...(existing.notes_edited ?? []), entry] }
    }
  }
}
