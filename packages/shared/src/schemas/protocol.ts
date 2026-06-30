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

export const OrderUrgencySchema = z.enum(['routine', 'urgent', 'stat'])
export const LabSampleTypeSchema = z.enum(['blood', 'urine', 'stool', 'other'])

export const ImagingOrderItemSchema = z.object({
  id: z.string(),
  study_type: z.string(),
  indication: z.string(),
  urgency: OrderUrgencySchema,
  contrast: z.boolean(),
  fasting_required: z.boolean(),
  special_instructions: z.string().optional(),
})

export const LabOrderItemSchema = z.object({
  id: z.string(),
  test_name: z.string(),
  test_code: z.string().optional(),
  indication: z.string(),
  urgency: OrderUrgencySchema,
  fasting_required: z.boolean(),
  sample_type: LabSampleTypeSchema,
  special_instructions: z.string().optional(),
})

const FixedDosageColumnsSchema = z.tuple([
  z.literal('drug'),
  z.literal('dose'),
  z.literal('route'),
  z.literal('frequency'),
  z.literal('notes'),
])

// ─── Conditional rule expression tree (for blocks that activate conditionally) ──
// Field paths supported in v1: any vitals field or clinical_notes content.

export const ComparisonOpSchema = z.enum(['<', '<=', '>', '>=', '==', '!='])

export const ConditionalRuleSchema: z.ZodType<unknown> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('cmp'),
      field: z.string().min(1).max(100),
      op: ComparisonOpSchema,
      value: z.union([z.number(), z.string(), z.boolean()]),
    }),
    z.object({
      kind: z.literal('and'),
      rules: z.array(ConditionalRuleSchema).min(1).max(10),
    }),
    z.object({
      kind: z.literal('or'),
      rules: z.array(ConditionalRuleSchema).min(1).max(10),
    }),
    z.object({
      kind: z.literal('not'),
      rule: ConditionalRuleSchema,
    }),
  ]),
)

// Types `ComparisonOp` and `ConditionalRule` are exported from `types/protocol.ts`
// (single source of truth). This schema validates the same shape.

// ─── Vitals field schema (shared between Template and Protocol blocks) ────────

export const VitalsFieldSchema = z.object({
  id: z.string().min(1).max(100),
  label: z.string().min(1).max(200),
  unit: z.string().max(50).optional(),
  input_type: z.enum(['text', 'number', 'computed']),
  formula: z.string().max(200).optional(),
})

// ─── Protocol Instance Schema (Strict Content) ─────────────────────────────

const BaseBlockSchema = z.object({
  id: z.string(),
  conditional_rule: ConditionalRuleSchema.optional(),
  conditional_label: z.string().max(200).optional(),
})

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
    BaseBlockSchema.extend({
      type: z.literal('imaging_order'),
      title: z.string().optional(),
      orders: z.array(ImagingOrderItemSchema).min(1),
    }),
    BaseBlockSchema.extend({
      type: z.literal('lab_order'),
      title: z.string().optional(),
      orders: z.array(LabOrderItemSchema).min(1),
    }),
    BaseBlockSchema.extend({
      type: z.literal('vitals'),
      fields: z.array(VitalsFieldSchema),
      values: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
    }),
    BaseBlockSchema.extend({
      type: z.literal('clinical_notes'),
      label: z.string(),
      required: z.boolean().optional(),
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
    BaseTemplateBlockSchema.extend({
      type: z.literal('imaging_order'),
      title: z.string().optional(),
      orders: z.array(ImagingOrderItemSchema).optional(),
    }),
    BaseTemplateBlockSchema.extend({
      type: z.literal('lab_order'),
      title: z.string().optional(),
      orders: z.array(LabOrderItemSchema).optional(),
    }),
    BaseTemplateBlockSchema.extend({
      type: z.literal('vitals'),
      fields: z.array(VitalsFieldSchema).optional(),
    }),
    BaseTemplateBlockSchema.extend({
      type: z.literal('clinical_notes'),
      label: z.string().optional(),
      required: z.boolean().optional(),
      content: z.string().optional(),
    }),
  ]),
)

export const ProtocolTemplateSchemaContent = z.object({
  version: z.string(),
  metadata: z
    .object({
      suggested_specialty: z.string().optional(),
      intended_use: z.string().optional(),
    })
    .optional(),
  blocks: z.array(TemplateBlockSchema),
})

export const ProtocolContentSchema = z.object({
  version: z.string(),
  template_version: z.string().optional(),
  blocks: z.array(ProtocolBlockSchema),
})

// ─── Request Schemas ─────────────────────────────────────────────────────────

export const CreateProtocolSchema = z.object({
  categoryId: z.string().uuid().optional(),
  title: z.string().min(2).max(300),
})

// .strict() rejects any additional keys — PATCH only accepts title
export const UpdateProtocolTitleSchema = z.object({ title: z.string().min(2).max(300) }).strict()

export const SaveVersionSchema = z.object({
  content: ProtocolContentSchema,
  changeSummary: z.string().max(500).nullable().optional(),
})

export const UpdateProtocolSchema = z.object({
  title: z.string().min(2).max(300).optional(),
  isFavorite: z.boolean().optional(),
})

export const ProtocolListQuerySchema = z.object({
  search: z.string().max(300).optional(),
  categoryId: z.string().uuid().optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
  favoritesOnly: z.string().optional().transform((v) => v === 'true'),
  sort: z.enum(['updatedAt_desc', 'updatedAt_asc', 'title_asc', 'title_desc']).optional(),
})

export const SaveProtocolVersionSchema = SaveVersionSchema.extend({
  publish: z.boolean().default(false),
})

// ─── Protocol Template Request Schemas ───────────────────────────────────────

export const CreateProtocolTemplateSchema = z.object({
  name: z.string().min(1).max(300),
  suggestedSpecialty: z.string().max(200).optional(),
  categoryId: z.string().uuid().optional(),
  schema: ProtocolTemplateSchemaContent,
})

export const UpdateProtocolTemplateSchema = z.object({
  name: z.string().min(1).max(300).optional(),
  suggestedSpecialty: z.string().max(200).nullable().optional(),
  schema: ProtocolTemplateSchemaContent.optional(),
})

// ─── Protocol Category Request Schemas ───────────────────────────────────────

export const CreateProtocolCategorySchema = z.object({
  name: z.string().min(1).max(200),
  color: z.string().max(20).optional(),
})

export const UpdateProtocolCategorySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  color: z.string().max(20).optional(),
})

// ─── Response Schemas ────────────────────────────────────────────────────────

export const ProtocolTemplateDtoSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  suggestedSpecialty: z.string().nullable(),
  schema: z.any(),
  isSeeded: z.boolean(),
  isLocked: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const ProtocolListItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  categoryId: z.string().uuid().nullable(),
  categoryName: z.string().nullable(),
  status: z.string(),
  isFavorite: z.boolean(),
  updatedAt: z.string().datetime(),
  currentVersionNumber: z.number().int().nullable(),
  /**
   * Top-level block count of the current version's content. 0 means the
   * protocol is structurally empty (no sections, no blocks). Used by the gate
   * to filter empty/draft protocols out of suggestion buckets while keeping
   * them searchable by name.
   */
  blockCount: z.number().int().nonnegative(),
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
  categoryId: z.string().uuid().nullable(),
  categoryName: z.string().nullable(),
  templateSchema: z.any().nullable(),
  currentVersion: ProtocolVersionSummarySchema.nullable(),
})

// ─── Inferred Types ──────────────────────────────────────────────────────────

export type ProtocolListQuery = z.infer<typeof ProtocolListQuerySchema>
export type CreateProtocolTemplateDto = z.infer<typeof CreateProtocolTemplateSchema>
export type UpdateProtocolTemplateDto = z.infer<typeof UpdateProtocolTemplateSchema>
export type CreateProtocolDto = z.infer<typeof CreateProtocolSchema>
export type UpdateProtocolDto = z.infer<typeof UpdateProtocolSchema>
export type UpdateProtocolTitleDto = z.infer<typeof UpdateProtocolTitleSchema>
export type SaveVersionDto = z.infer<typeof SaveVersionSchema>
export type SaveProtocolVersionDto = z.infer<typeof SaveProtocolVersionSchema>
export type CreateProtocolCategoryDto = z.infer<typeof CreateProtocolCategorySchema>
export type UpdateProtocolCategoryDto = z.infer<typeof UpdateProtocolCategorySchema>
export type ProtocolTemplateDto = z.infer<typeof ProtocolTemplateDtoSchema>
export type ProtocolListItem = z.infer<typeof ProtocolListItemSchema>
export type ProtocolVersionSummary = z.infer<typeof ProtocolVersionSummarySchema>
export type ProtocolResponse = z.infer<typeof ProtocolResponseSchema>
