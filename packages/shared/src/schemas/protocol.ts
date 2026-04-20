import { z } from 'zod'

export const AlertSeveritySchema = z.enum(['info', 'warning', 'danger', 'success'])

// Inner collection item schemas use z.string() (not .min(1)) so that
// minimum-valid seeded content passes validation from creation.
// Content quality is enforced at the editor/UI layer, not the schema layer.

export const ChecklistItemSchema = z.object({
  id: z.string(),
  text: z.string(),
  critical: z.boolean().optional(),
})

export const StepSchema = z.object({
  id: z.string(),
  order: z.number().int().positive(),
  title: z.string(),
  detail: z.string().optional(),
})

export const DecisionBranchSchema = z.object({
  id: z.string(),
  label: z.string(),
  action: z.string(),
})

export const DosageRowSchema = z.object({
  id: z.string(),
  drug: z.string(),
  dose: z.string(),
  route: z.string(),
  frequency: z.string(),
  notes: z.string(),
})

const FixedDosageColumnsSchema = z.tuple([
  z.literal('drug'),
  z.literal('dose'),
  z.literal('route'),
  z.literal('frequency'),
  z.literal('notes'),
])

// ─── Protocol Instance Schema (Strict Content) ─────────────────────────────

const BaseBlockSchema = z.object({ id: z.string() })

export const ProtocolBlockSchema: z.ZodType<unknown> = z.lazy(() =>
  z.discriminatedUnion('type', [
    BaseBlockSchema.extend({
      type: z.literal('section'),
      title: z.string().min(1),
      description: z.string().optional(),
      collapsed_by_default: z.boolean().optional(),
      blocks: z.array(ProtocolBlockSchema),
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
      condition: z.string(),
      branches: z.array(DecisionBranchSchema).min(2),
    }),
    BaseBlockSchema.extend({
      type: z.literal('dosage_table'),
      title: z.string().optional(),
      columns: FixedDosageColumnsSchema,
      rows: z.array(DosageRowSchema).min(1),
    }),
    BaseBlockSchema.extend({
      type: z.literal('alert'),
      severity: AlertSeveritySchema,
      title: z.string().optional(),
      content: z.string(),
    }),
  ]),
)

// ─── Template Schema (Authoring Context) ────────────────────────────────────

const BaseTemplateBlockSchema = BaseBlockSchema.extend({
  required: z.boolean().optional(),
  placeholder: z.string().optional(),
})

export const TemplateBlockSchema: z.ZodType<unknown> = z.lazy(() =>
  z.discriminatedUnion('type', [
    BaseTemplateBlockSchema.extend({
      type: z.literal('section'),
      title: z.string().min(1),
      description: z.string().optional(),
      collapsed_by_default: z.boolean().optional(),
      blocks: z.array(TemplateBlockSchema).optional(),
      placeholder_blocks: z.array(TemplateBlockSchema).optional(),
    }),
    BaseTemplateBlockSchema.extend({ type: z.literal('text'), content: z.string().optional() }),
    BaseTemplateBlockSchema.extend({
      type: z.literal('checklist'),
      title: z.string().optional(),
      items: z.array(ChecklistItemSchema).optional(),
    }),
    BaseTemplateBlockSchema.extend({
      type: z.literal('steps'),
      title: z.string().optional(),
      steps: z.array(StepSchema).optional(),
    }),
    BaseTemplateBlockSchema.extend({
      type: z.literal('decision'),
      condition: z.string().optional(),
      branches: z.array(DecisionBranchSchema).optional(),
    }),
    BaseTemplateBlockSchema.extend({
      type: z.literal('dosage_table'),
      title: z.string().optional(),
      columns: FixedDosageColumnsSchema.optional(),
      rows: z.array(DosageRowSchema).optional(),
    }),
    BaseTemplateBlockSchema.extend({
      type: z.literal('alert'),
      severity: AlertSeveritySchema.optional(),
      title: z.string().optional(),
      content: z.string().optional(),
    }),
  ]),
)

export const ProtocolTemplateSchema = z.object({
  version: z.string(),
  metadata: z.object({
    suggested_specialty: z.string().optional(),
    intended_use: z.string().optional(),
  }),
  blocks: z.array(TemplateBlockSchema),
})

export const ProtocolContentSchema = z.object({
  version: z.string(),
  template_version: z.string().optional(),
  blocks: z.array(ProtocolBlockSchema),
})

// ─── Request Schemas ─────────────────────────────────────────────────────────

export const CreateProtocolSchema = z.object({
  templateId: z.string().uuid().nullable().optional(),
  title: z.string().min(2).max(300).optional(),
  specialty: z.string().max(100).nullable().optional(),
  tags: z.array(z.string()).default([]),
})

// .strict() rejects any additional keys — PATCH only accepts title
export const UpdateProtocolTitleSchema = z
  .object({ title: z.string().min(2).max(300) })
  .strict()

export const SaveVersionSchema = z.object({
  content: ProtocolContentSchema,
  changeSummary: z.string().max(500).nullable().optional(),
})

// Kept for backwards compat with existing imports
export const UpdateProtocolSchema = z.object({
  title: z.string().min(2).max(300).optional(),
  specialty: z.string().max(100).nullable().optional(),
  tags: z.array(z.string()).optional(),
  isFavorite: z.boolean().optional(),
})

export const SaveProtocolVersionSchema = SaveVersionSchema.extend({
  publish: z.boolean().default(false),
})

// ─── Response Schemas ────────────────────────────────────────────────────────

export const ProtocolTemplateDtoSchema = z.object({
  id: z.string().uuid(),
  templateKey: z.string(),
  locale: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  suggestedSpecialty: z.string().nullable(),
  category: z.string().nullable(),
  icon: z.string().nullable(),
  schema: z.any(),
  isSystem: z.boolean(),
})

export const ProtocolListItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  templateId: z.string().uuid().nullable(),
  templateName: z.string().nullable(),
  status: z.string(),
  isFavorite: z.boolean(),
  updatedAt: z.string().datetime(),
  currentVersionNumber: z.number().int().nullable(),
})

export const ProtocolVersionSummarySchema = z.object({
  id: z.string().uuid(),
  versionNumber: z.number().int(),
  content: ProtocolContentSchema,
  changeSummary: z.string().nullable(),
  createdAt: z.string().datetime(),
})

export const ProtocolResponseSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  status: z.string(),
  isFavorite: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  templateId: z.string().uuid().nullable(),
  templateName: z.string().nullable(),
  templateSchema: z.any().nullable(),
  currentVersion: ProtocolVersionSummarySchema.nullable(),
})

// ─── Inferred Types ──────────────────────────────────────────────────────────

export type CreateProtocolDto = z.infer<typeof CreateProtocolSchema>
export type UpdateProtocolDto = z.infer<typeof UpdateProtocolSchema>
export type UpdateProtocolTitleDto = z.infer<typeof UpdateProtocolTitleSchema>
export type SaveVersionDto = z.infer<typeof SaveVersionSchema>
export type SaveProtocolVersionDto = z.infer<typeof SaveProtocolVersionSchema>
export type ProtocolTemplateDto = z.infer<typeof ProtocolTemplateDtoSchema>
export type ProtocolListItem = z.infer<typeof ProtocolListItemSchema>
export type ProtocolVersionSummary = z.infer<typeof ProtocolVersionSummarySchema>
export type ProtocolResponse = z.infer<typeof ProtocolResponseSchema>
