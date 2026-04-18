import { z } from 'zod'

export const AlertSeveritySchema = z.enum(['info', 'warning', 'danger', 'success'])

export const ChecklistItemSchema = z.object({
  id: z.string(),
  text: z.string().min(1),
  critical: z.boolean().optional(),
})

export const StepSchema = z.object({
  id: z.string(),
  order: z.number().int().positive(),
  title: z.string().min(1),
  detail: z.string().optional(),
})

export const DecisionBranchSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  action: z.string().min(1),
})

export const DosageRowSchema = z.object({
  id: z.string(),
  drug: z.string().min(1),
  dose: z.string().min(1),
  route: z.string().min(1),
  frequency: z.string().min(1),
  notes: z.string(),
})

const BaseBlockSchema = z.object({ id: z.string() })

export const ProtocolBlockSchema: z.ZodType<unknown> = z.lazy(() =>
  z.discriminatedUnion('type', [
    BaseBlockSchema.extend({
      type: z.literal('section'),
      title: z.string().min(1),
      description: z.string().optional(),
      collapsed_by_default: z.boolean().optional(),
      blocks: z.array(ProtocolBlockSchema as z.ZodType<unknown>),
    }),
    BaseBlockSchema.extend({ type: z.literal('text'), content: z.string() }),
    BaseBlockSchema.extend({
      type: z.literal('checklist'),
      title: z.string().optional(),
      items: z.array(ChecklistItemSchema).min(1),
    }),
    BaseBlockSchema.extend({
      type: z.literal('steps'),
      title: z.string().optional(),
      steps: z.array(StepSchema).min(1),
    }),
    BaseBlockSchema.extend({
      type: z.literal('decision'),
      condition: z.string().min(1),
      branches: z.array(DecisionBranchSchema).min(2),
    }),
    BaseBlockSchema.extend({
      type: z.literal('dosage_table'),
      title: z.string().optional(),
      columns: z.array(z.string()),
      rows: z.array(DosageRowSchema).min(1),
    }),
    BaseBlockSchema.extend({
      type: z.literal('alert'),
      severity: AlertSeveritySchema,
      title: z.string().optional(),
      content: z.string().min(1),
    }),
  ]),
)

export const ProtocolContentSchema = z.object({
  version: z.string(),
  template_version: z.string().optional(),
  blocks: z.array(ProtocolBlockSchema as z.ZodType<unknown>),
})

export const CreateProtocolSchema = z.object({
  templateId: z.string().uuid().nullable().optional(),
  title: z.string().min(2).max(300),
  specialty: z.string().max(100).nullable().optional(),
  tags: z.array(z.string()).default([]),
  content: ProtocolContentSchema,
})

export const UpdateProtocolSchema = z.object({
  title: z.string().min(2).max(300).optional(),
  specialty: z.string().max(100).nullable().optional(),
  tags: z.array(z.string()).optional(),
  isFavorite: z.boolean().optional(),
})

export const SaveProtocolVersionSchema = z.object({
  content: ProtocolContentSchema,
  changeSummary: z.string().max(500).nullable().optional(),
  publish: z.boolean().default(false),
})

export type CreateProtocolDto = z.infer<typeof CreateProtocolSchema>
export type UpdateProtocolDto = z.infer<typeof UpdateProtocolSchema>
export type SaveProtocolVersionDto = z.infer<typeof SaveProtocolVersionSchema>
