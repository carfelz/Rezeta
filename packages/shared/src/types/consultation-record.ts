/**
 * Historia médica (consultation record) — DR Reglamento Técnico del
 * Expediente Clínico (MISPAS 2023). Section keys are the fixed legal
 * skeleton (§6.3); order in RECORD_SECTION_KEYS is the render order.
 */
export const RECORD_SECTION_KEYS = [
  'ficha_identificacion',
  'motivo_consulta',
  'antecedentes',
  'enfermedad_actual',
  'examen_fisico',
  'evolucion',
  'resultados_estudios',
  'diagnosticos',
  'plan_tratamiento',
  'enmiendas',
] as const

export type RecordSectionKey = (typeof RECORD_SECTION_KEYS)[number]

export type ConsultationRecordKind = 'first_visit' | 'evolution'
export type ConsultationRecordStatus = 'draft' | 'signed'

export interface RecordSection {
  key: RecordSectionKey
  title: string
  content: string
  /** 'edited' once the doctor has touched the text after generation. */
  source: 'generated' | 'edited'
  /** Required sections must be non-empty to sign the record. */
  required: boolean
}

export interface ConsultationRecordDto {
  id: string
  consultationId: string
  patientId: string
  versionNumber: number
  kind: ConsultationRecordKind
  status: ConsultationRecordStatus
  sections: RecordSection[]
  generatedAt: string
  signedAt: string | null
  signedBy: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Outcome of the auto-draft attempt when a consultation is signed. Draft
 * failure never fails the sign — the response reports what happened.
 */
export type RecordOutcome = { status: 'created'; recordId: string } | { status: 'failed' }
