import { z } from 'zod'

export const VitalsSchema = z.object({
  bloodPressureSystolic: z.number().int().min(0).max(300).optional(),
  bloodPressureDiastolic: z.number().int().min(0).max(200).optional(),
  heartRate: z.number().int().min(0).max(300).optional(),
  respiratoryRate: z.number().int().min(0).max(100).optional(),
  temperatureCelsius: z.number().min(25).max(45).optional(),
  oxygenSaturation: z.number().min(0).max(100).optional(),
  weightKg: z.number().min(0).max(500).optional(),
  heightCm: z.number().min(0).max(300).optional(),
})

export const CreateConsultationSchema = z.object({
  patientId: z.string().uuid(),
  locationId: z.string().uuid(),
  appointmentId: z.string().uuid().nullable().optional(),
  chiefComplaint: z.string().max(500).nullable().optional(),
  subjective: z.string().max(5000).nullable().optional(),
  objective: z.string().max(5000).nullable().optional(),
  assessment: z.string().max(5000).nullable().optional(),
  plan: z.string().max(5000).nullable().optional(),
  vitals: VitalsSchema.nullable().optional(),
  diagnoses: z.array(z.string().max(200)).default([]),
})

export const UpdateConsultationSchema = CreateConsultationSchema.partial()

export const AmendConsultationSchema = z.object({
  reason: z.string().min(10).max(1000),
  chiefComplaint: z.string().max(500).optional(),
  subjective: z.string().max(5000).optional(),
  objective: z.string().max(5000).optional(),
  assessment: z.string().max(5000).optional(),
  plan: z.string().max(5000).optional(),
  vitals: VitalsSchema.optional(),
  diagnoses: z.array(z.string().max(200)).optional(),
})

export type CreateConsultationDto = z.infer<typeof CreateConsultationSchema>
export type UpdateConsultationDto = z.infer<typeof UpdateConsultationSchema>
export type AmendConsultationDto = z.infer<typeof AmendConsultationSchema>

export const AddProtocolUsageSchema = z.object({
  protocolId: z.string().uuid(),
  parentUsageId: z.string().uuid().optional(),
  triggerBlockId: z.string().max(100).optional(),
})

export const UpdateCheckedStateSchema = z.object({
  checkedState: z.record(z.string(), z.boolean()),
  completedAt: z.string().datetime().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

const ProtocolContentSchema = z.object({
  version: z.string(),
  template_version: z.string().optional(),
  blocks: z.array(z.record(z.string(), z.unknown())),
})

const ModificationsSchema = z.object({
  medication_changes: z.array(z.record(z.string(), z.unknown())).optional(),
  medications_added: z.array(z.record(z.string(), z.unknown())).optional(),
  medications_removed: z.array(z.record(z.string(), z.unknown())).optional(),
  steps_completed: z.array(z.record(z.string(), z.unknown())).optional(),
  steps_skipped: z.array(z.record(z.string(), z.unknown())).optional(),
  checklist_items: z.array(z.record(z.string(), z.unknown())).optional(),
  decision_branches: z.array(z.record(z.string(), z.unknown())).optional(),
  imaging_orders_queued: z.array(z.record(z.string(), z.unknown())).optional(),
  imaging_orders_modified: z.array(z.record(z.string(), z.unknown())).optional(),
  imaging_orders_removed: z.array(z.record(z.string(), z.unknown())).optional(),
  lab_orders_queued: z.array(z.record(z.string(), z.unknown())).optional(),
  lab_orders_modified: z.array(z.record(z.string(), z.unknown())).optional(),
  lab_orders_removed: z.array(z.record(z.string(), z.unknown())).optional(),
  text_blocks_edited: z.array(z.record(z.string(), z.unknown())).optional(),
})

export const UpdateProtocolUsageSchema = z.object({
  content: ProtocolContentSchema.optional(),
  modifications: ModificationsSchema.optional(),
  modificationSummary: z.string().max(500).nullable().optional(),
  status: z.enum(['in_progress', 'completed', 'abandoned']).optional(),
  checkedState: z.record(z.string(), z.boolean()).optional(),
  completedAt: z.string().datetime().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

const PrescriptionItemSchema = z.object({
  drug: z.string().min(1).max(300),
  dose: z.string().min(1).max(200),
  route: z.string().min(1).max(100),
  frequency: z.string().min(1).max(200),
  duration: z.string().min(1).max(200),
  notes: z.string().max(2000).optional(),
  source: z.string().max(200).optional(),
})

export const CreatePrescriptionGroupSchema = z.object({
  groupTitle: z.string().max(200).nullable().optional(),
  groupOrder: z.number().int().min(1).default(1),
  items: z
    .array(PrescriptionItemSchema)
    .refine((arr) => arr.length >= 1, 'At least one item is required'),
})

const ImagingOrderItemSchema = z.object({
  study_type: z.string().min(1).max(300),
  indication: z.string().min(1).max(500),
  urgency: z.enum(['routine', 'urgent', 'stat']).default('routine'),
  contrast: z.boolean().default(false),
  fasting_required: z.boolean().default(false),
  special_instructions: z.string().max(2000).optional(),
  source: z.string().max(200).optional(),
})

export const CreateImagingOrderGroupSchema = z.object({
  groupTitle: z.string().max(200).nullable().optional(),
  groupOrder: z.number().int().min(1).default(1),
  orders: z
    .array(ImagingOrderItemSchema)
    .refine((arr) => arr.length >= 1, 'At least one order is required'),
})

const LabOrderItemSchema = z.object({
  test_name: z.string().min(1).max(300),
  test_code: z.string().max(50).optional(),
  indication: z.string().min(1).max(500),
  urgency: z.enum(['routine', 'urgent', 'stat']).default('routine'),
  fasting_required: z.boolean().default(false),
  sample_type: z.enum(['blood', 'urine', 'stool', 'other']),
  special_instructions: z.string().max(2000).optional(),
  source: z.string().max(200).optional(),
})

export const CreateLabOrderGroupSchema = z.object({
  groupTitle: z.string().max(200).nullable().optional(),
  groupOrder: z.number().int().min(1).default(1),
  orders: z
    .array(LabOrderItemSchema)
    .refine((arr) => arr.length >= 1, 'At least one order is required'),
})

export const GenerateAllOrdersSchema = z.object({
  prescriptions: z.array(CreatePrescriptionGroupSchema).default([]),
  imagingOrders: z.array(CreateImagingOrderGroupSchema).default([]),
  labOrders: z.array(CreateLabOrderGroupSchema).default([]),
})

export type AddProtocolUsageDto = z.infer<typeof AddProtocolUsageSchema>
export type UpdateCheckedStateDto = z.infer<typeof UpdateCheckedStateSchema>
export type UpdateProtocolUsageDto = z.infer<typeof UpdateProtocolUsageSchema>
export type CreatePrescriptionGroupDto = z.infer<typeof CreatePrescriptionGroupSchema>
export type CreateImagingOrderGroupDto = z.infer<typeof CreateImagingOrderGroupSchema>
export type CreateLabOrderGroupDto = z.infer<typeof CreateLabOrderGroupSchema>
export type GenerateAllOrdersDto = z.infer<typeof GenerateAllOrdersSchema>
