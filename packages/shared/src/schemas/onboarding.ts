import { z } from 'zod'
import { ProtocolTemplateSchemaContent } from './protocol.js'

export const OnboardingCustomTemplateSchema = z.object({
  clientId: z.string().min(1),
  name: z.string().min(1),
  suggestedSpecialty: z.string().optional(),
  schema: ProtocolTemplateSchemaContent,
})

export const OnboardingCustomTypeSchema = z.object({
  name: z.string().min(1),
  templateClientId: z.string().min(1),
})

export const OnboardingCustomSchema = z.object({
  templates: z.array(OnboardingCustomTemplateSchema).min(1),
  types: z.array(OnboardingCustomTypeSchema).min(1),
})

export type OnboardingCustomInput = z.infer<typeof OnboardingCustomSchema>
