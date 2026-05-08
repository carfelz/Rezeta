export interface TemplateCandidate {
  clientId: string
  name: string
  schema: object
}

export interface TypeCandidate {
  name: string
  templateClientId: string
}
