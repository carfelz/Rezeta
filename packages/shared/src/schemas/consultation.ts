import { z } from 'zod'
import { HistoriaMappingSchema } from './protocol.js'

export const CreateConsultationSchema = z.object({
  patientId: z.string().uuid(),
  locationId: z.string().uuid(),
  appointmentId: z.string().uuid().nullable().optional(),
})

export const AddProtocolUsageSchema = z.object({
  protocolId: z.string().uuid(),
  parentUsageId: z.string().uuid().optional(),
  triggerBlockId: z.string().max(100).optional(),
})

const ProtocolContentSchema = z.object({
  version: z.string(),
  template_version: z.string().optional(),
  blocks: z.array(z.record(z.string(), z.unknown())),
  historia_mapping: HistoriaMappingSchema.optional(),
})

const StepEventSchema = z.object({
  step_id: z.string().min(1).max(200),
  timestamp: z.string().datetime(),
  reason: z.string().min(1).max(500).optional(),
})

const VitalsEnteredEventSchema = z
  .object({
    block_id: z.string().min(1).max(200),
    values: z.record(z.string(), z.union([z.string(), z.number()])),
    timestamp: z.string().datetime(),
  })
  .passthrough()

const NotesEditedEventSchema = z
  .object({
    block_id: z.string().min(1).max(200),
    length: z.number().int().min(0),
    timestamp: z.string().datetime(),
  })
  .passthrough()

const ModificationsSchema = z.object({
  steps_completed: z.array(StepEventSchema).optional(),
  steps_skipped: z.array(StepEventSchema).optional(),
  checklist_items: z.array(z.record(z.string(), z.unknown())).optional(),
  decision_branches: z.array(z.record(z.string(), z.unknown())).optional(),
  vitals_entered: z.array(VitalsEnteredEventSchema).optional(),
  notes_edited: z.array(NotesEditedEventSchema).optional(),
  medication_changes: z.array(z.record(z.string(), z.unknown())).optional(),
  imaging_orders_queued: z.array(z.record(z.string(), z.unknown())).optional(),
  lab_orders_queued: z.array(z.record(z.string(), z.unknown())).optional(),
})

export const UpdateProtocolUsageSchema = z.object({
  content: ProtocolContentSchema.optional(),
  modifications: ModificationsSchema.optional(),
  modificationSummary: z.string().max(500).nullable().optional(),
  status: z.enum(['in_progress', 'completed', 'abandoned']).optional(),
  completedAt: z.string().datetime().nullable().optional(),
  /**
   * Optimistic-concurrency precondition: the `contentUpdatedAt` the client
   * last saw for this usage. Only checked when `content` is also present —
   * sent alongside a full content replace so a stale tab can't silently
   * clobber a newer write from another session. Deliberately compares
   * against `contentUpdatedAt`, not the row-level `updatedAt`, so a benign
   * modification-only event (checklist tick, skip, off-note) never falsely
   * flags a content write as stale.
   */
  expectedContentUpdatedAt: z.string().datetime().optional(),
})

export const AmendConsultationSchema = z.object({
  reason: z.string().min(10).max(1000),
  amendment_content: z.record(z.string(), z.unknown()).optional(),
})

const PrescriptionItemSchema = z.object({
  drug: z.string().min(1).max(300),
  dose: z.string().min(1).max(200),
  route: z.string().min(1).max(100),
  frequency: z.string().min(1).max(200),
  duration: z.string().max(200).default(''),
  notes: z.string().max(2000).optional(),
  source: z.string().max(200).optional(),
})

export const CreatePrescriptionGroupSchema = z.object({
  groupTitle: z.string().max(200).nullable().optional(),
  groupOrder: z.number().int().min(1).default(1),
  clientRequestId: z.string().min(8).max(64).optional(),
  items: z.array(PrescriptionItemSchema).min(1),
})

export const UpdatePrescriptionGroupSchema = z.object({
  groupTitle: z.string().max(200).nullable().optional(),
  groupOrder: z.number().int().min(1).optional(),
  items: z.array(PrescriptionItemSchema).optional(),
})

const ImagingOrderItemSchema = z.object({
  studyType: z.string().min(1).max(300),
  indication: z.string().min(1).max(500),
  urgency: z.enum(['routine', 'urgent', 'stat']).default('routine'),
  contrast: z.boolean().default(false),
  fastingRequired: z.boolean().default(false),
  specialInstructions: z.string().max(2000).optional(),
  source: z.string().max(200).optional(),
})

export const CreateImagingOrderGroupSchema = z.object({
  groupTitle: z.string().max(200).nullable().optional(),
  groupOrder: z.number().int().min(1).default(1),
  clientRequestId: z.string().min(8).max(64).optional(),
  items: z.array(ImagingOrderItemSchema).min(1),
})

export const UpdateImagingOrderGroupSchema = z.object({
  groupTitle: z.string().max(200).nullable().optional(),
  groupOrder: z.number().int().min(1).optional(),
  items: z.array(ImagingOrderItemSchema).optional(),
})

const LabOrderItemSchema = z.object({
  testName: z.string().min(1).max(300),
  indication: z.string().min(1).max(500),
  urgency: z.enum(['routine', 'urgent', 'stat']).default('routine'),
  fastingRequired: z.boolean().default(false),
  sampleType: z.enum(['blood', 'urine', 'stool', 'csf', 'other']).default('blood'),
  specialInstructions: z.string().max(2000).optional(),
  source: z.string().max(200).optional(),
})

export const CreateLabOrderGroupSchema = z.object({
  groupTitle: z.string().max(200).nullable().optional(),
  groupOrder: z.number().int().min(1).default(1),
  clientRequestId: z.string().min(8).max(64).optional(),
  items: z.array(LabOrderItemSchema).min(1),
})

export const UpdateLabOrderGroupSchema = z.object({
  groupTitle: z.string().max(200).nullable().optional(),
  groupOrder: z.number().int().min(1).optional(),
  items: z.array(LabOrderItemSchema).optional(),
})

export type CreateConsultationDto = z.infer<typeof CreateConsultationSchema>
export type AmendConsultationDto = z.infer<typeof AmendConsultationSchema>
export type AddProtocolUsageDto = z.infer<typeof AddProtocolUsageSchema>
export type UpdateProtocolUsageDto = z.infer<typeof UpdateProtocolUsageSchema>
export type CreatePrescriptionGroupDto = z.infer<typeof CreatePrescriptionGroupSchema>
export type UpdatePrescriptionGroupDto = z.infer<typeof UpdatePrescriptionGroupSchema>
export type CreateImagingOrderGroupDto = z.infer<typeof CreateImagingOrderGroupSchema>
export type UpdateImagingOrderGroupDto = z.infer<typeof UpdateImagingOrderGroupSchema>
export type CreateLabOrderGroupDto = z.infer<typeof CreateLabOrderGroupSchema>
export type UpdateLabOrderGroupDto = z.infer<typeof UpdateLabOrderGroupSchema>
