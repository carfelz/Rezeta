import { z } from 'zod'

export const SsoConnectionTypeSchema = z.enum(['oidc'])
export const SsoConnectionStatusSchema = z.enum(['active', 'disabled'])

const DOMAIN_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/

const DomainSchema = z
  .string()
  .max(253)
  .transform((d) => d.toLowerCase())
  .pipe(z.string().regex(DOMAIN_RE, 'must be a bare domain like clinica.do'))

export const CreateSsoConnectionSchema = z.object({
  tenantId: z.string().uuid(),
  displayName: z.string().min(1).max(80),
  issuerUrl: z.string().url().startsWith('https://'),
  clientId: z.string().min(1).max(255),
  clientSecret: z.string().min(1).max(512),
  domains: z.array(DomainSchema).min(1).max(20),
  allowPassword: z.boolean().default(true),
})
export type CreateSsoConnectionDto = z.infer<typeof CreateSsoConnectionSchema>

export const UpdateSsoConnectionSchema = CreateSsoConnectionSchema.omit({ tenantId: true }).partial()
export type UpdateSsoConnectionDto = z.infer<typeof UpdateSsoConnectionSchema>

export const LoginMethodsRequestSchema = z.object({ email: z.string().email().max(254) })
export type LoginMethodsRequestDto = z.infer<typeof LoginMethodsRequestSchema>

export type LoginMethod = 'password' | 'google' | 'sso'

export interface LoginMethodsResponseDto {
  methods: LoginMethod[]
  ssoProviderId?: string
  ssoDisplayName?: string
}

export interface SsoConnectionDto {
  id: string
  tenantId: string
  tenantName: string | null
  type: z.infer<typeof SsoConnectionTypeSchema>
  providerId: string
  displayName: string
  issuerUrl: string
  clientId: string
  domains: string[]
  allowPassword: boolean
  status: z.infer<typeof SsoConnectionStatusSchema>
  createdAt: string
}

export interface SsoTestResultDto {
  ok: boolean
  checked: string[]
  failure?: string
}
