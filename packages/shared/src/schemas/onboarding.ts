import { z } from 'zod'
import { ProtocolTemplateSchemaContent } from './protocol.js'

export const OnboardingCustomTemplateSchema = z.object({
  clientId: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  schema: ProtocolTemplateSchemaContent,
})

export const OnboardingCustomTypeSchema = z.object({
  name: z.string().min(1).max(200),
  templateClientId: z.string().min(1).max(200),
})

export const OnboardingCustomSchema = z.object({
  templates: z.array(OnboardingCustomTemplateSchema).min(1).max(50),
  types: z.array(OnboardingCustomTypeSchema).min(1).max(50),
})

export type OnboardingCustomInput = z.infer<typeof OnboardingCustomSchema>
