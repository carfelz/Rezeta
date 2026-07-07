import type {
  ConsultationRecordKind,
  RecordSection,
  RecordSectionKey,
} from '../types/consultation-record.js'
import { RECORD_SECTION_KEYS } from '../types/consultation-record.js'
import type { ProtocolBlock } from '../types/protocol.js'
import type { HistoriaMapping } from '../schemas/protocol.js'

export const RECORD_SECTION_TITLES: Record<RecordSectionKey, string> = {
  ficha_identificacion: 'Ficha de identificación',
  motivo_consulta: 'Motivo de consulta',
  antecedentes: 'Antecedentes',
  enfermedad_actual: 'Enfermedad actual',
  examen_fisico: 'Examen físico',
  evolucion: 'Evolución',
  resultados_estudios: 'Resultados de estudios',
  diagnosticos: 'Diagnósticos',
  plan_tratamiento: 'Plan de tratamiento',
  enmiendas: 'Enmiendas',
}

const REQUIRED_BY_KIND: Record<ConsultationRecordKind, readonly RecordSectionKey[]> = {
  first_visit: ['motivo_consulta', 'antecedentes', 'examen_fisico', 'diagnosticos', 'plan_tratamiento'],
  evolution: ['motivo_consulta', 'examen_fisico', 'evolucion', 'diagnosticos', 'plan_tratamiento'],
}

/** Sections that never render for a given kind (spec §5 table "—" cells). */
const EXCLUDED_BY_KIND: Record<ConsultationRecordKind, readonly RecordSectionKey[]> = {
  first_visit: ['evolucion'],
  evolution: ['enfermedad_actual'],
}

export interface RecordPatientInput {
  firstName: string
  lastName: string
  dateOfBirth: string | null
  sex: string | null
  documentType: string | null
  documentNumber: string | null
  phone: string | null
  address: string | null
  allergies: string[]
  chronicConditions: string[]
}

export interface RecordUsageInput {
  blocks: ProtocolBlock[]
  historiaMapping?: HistoriaMapping
  modifications: {
    steps_completed?: Array<{ step_id: string }>
    steps_skipped?: Array<{ step_id: string; reason?: string }>
    decision_branches?: Array<Record<string, unknown>>
  }
}

export interface RecordOrdersInput {
  prescriptionItems: Array<{
    drug: string
    dose: string
    route: string
    frequency: string
    duration: string
  }>
  labTests: string[]
  imagingStudies: string[]
}

export interface GenerateRecordSectionsInput {
  kind: ConsultationRecordKind
  patient: RecordPatientInput
  usages: RecordUsageInput[]
  orders: RecordOrdersInput
  amendments: Array<{ reason: string; amendedAt: string }>
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/** Free-narrative destination: evolución on follow-ups, enfermedad actual on first visits. */
function narrativeSection(kind: ConsultationRecordKind): RecordSectionKey {
  return kind === 'first_visit' ? 'enfermedad_actual' : 'evolucion'
}

function matchNotesSection(label: string, kind: ConsultationRecordKind): RecordSectionKey {
  const n = normalize(label)
  if (n.includes('motivo')) return 'motivo_consulta'
  if (n.includes('antecedente')) return 'antecedentes'
  if (n.includes('examen') || n.includes('fisic') || n.includes('exploracion')) return 'examen_fisico'
  if (n.includes('diagnostic')) return 'diagnosticos'
  if (n.includes('plan') || n.includes('tratamiento')) return 'plan_tratamiento'
  if (n.includes('evolucion')) return 'evolucion'
  if (n.includes('resultado') || n.includes('estudio')) return 'resultados_estudios'
  return narrativeSection(kind)
}

function calcAgeYears(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) return null
  const ms = Date.now() - new Date(dateOfBirth).getTime()
  return Math.floor(ms / (365.25 * 24 * 60 * 60 * 1000))
}

const SEX_LABELS: Record<string, string> = { male: 'Masculino', female: 'Femenino', other: 'Otro' }

function buildFicha(patient: RecordPatientInput): string {
  const lines: string[] = []
  const age = calcAgeYears(patient.dateOfBirth)
  const idBits = [
    `${patient.firstName} ${patient.lastName}`.trim(),
    age != null ? `${age} años` : null,
    patient.sex ? (SEX_LABELS[patient.sex] ?? patient.sex) : null,
  ].filter(Boolean)
  lines.push(idBits.join(' · '))
  if (patient.documentNumber) {
    lines.push(`${(patient.documentType ?? 'doc').toUpperCase()}: ${patient.documentNumber}`)
  }
  if (patient.phone) lines.push(`Teléfono: ${patient.phone}`)
  if (patient.address) lines.push(`Dirección: ${patient.address}`)
  if (patient.allergies.length > 0) lines.push(`Alergias: ${patient.allergies.join(', ')}`)
  if (patient.chronicConditions.length > 0) {
    lines.push(`Condiciones crónicas: ${patient.chronicConditions.join(', ')}`)
  }
  return lines.join('\n')
}

type Bucket = Map<RecordSectionKey, string[]>

function push(bucket: Bucket, key: RecordSectionKey, text: string): void {
  if (!text.trim()) return
  const arr = bucket.get(key) ?? []
  arr.push(text.trim())
  bucket.set(key, arr)
}

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
function walkBlocks(
  blocks: ProtocolBlock[],
  usage: RecordUsageInput,
  kind: ConsultationRecordKind,
  bucket: Bucket,
): void {
  for (const raw of blocks) {
    const block = raw as any
    const mapping = usage.historiaMapping?.[block.id as string]
    if (mapping?.include === false) continue
    switch (block.type) {
      case 'section':
        walkBlocks((block.blocks ?? []) as ProtocolBlock[], usage, kind, bucket)
        break
      case 'clinical_notes': {
        const content = String(block.content ?? '')
        if (content.trim()) {
          const destination = mapping?.section ?? matchNotesSection(mapping?.label ?? String(block.label ?? ''), kind)
          push(bucket, destination, content)
        }
        break
      }
      case 'vitals': {
        const values = (block.values ?? {}) as Record<string, string | number>
        const fields = (block.fields ?? []) as Array<{ id: string; label: string; unit?: string }>
        const parts = fields
          .filter((f) => values[f.id] !== undefined && values[f.id] !== '')
          .map((f) => `${f.label} ${String(values[f.id])}${f.unit ? ` ${f.unit}` : ''}`)
        if (parts.length > 0) {
          const destination = mapping?.section ?? 'examen_fisico'
          const text = mapping?.label ? `${mapping.label}: ${parts.join(' · ')}` : parts.join(' · ')
          push(bucket, destination, text)
        }
        break
      }
      case 'checklist': {
        const items = (block.items ?? []) as Array<{ text: string; checked?: boolean }>
        const checked = items.filter((i) => i.checked === true).map((i) => i.text)
        if (checked.length > 0) {
          const destination = mapping?.section ?? narrativeSection(kind)
          const title = mapping?.label ?? String(block.title ?? 'Verificación')
          push(bucket, destination, `${title}: ${checked.join(', ')}`)
        }
        break
      }
      case 'steps': {
        const steps = (block.steps ?? []) as Array<{ id: string; title: string }>
        const completedIds = new Set((usage.modifications.steps_completed ?? []).map((s) => s.step_id))
        const skipped = new Map(
          (usage.modifications.steps_skipped ?? []).map((s) => [s.step_id, s.reason]),
        )
        const parts: string[] = []
        for (const step of steps) {
          if (completedIds.has(step.id)) parts.push(step.title)
          else if (skipped.has(step.id)) {
            const reason = skipped.get(step.id)
            parts.push(`${step.title} (omitido${reason ? `: ${reason}` : ''})`)
          }
        }
        if (parts.length > 0) {
          const destination = mapping?.section ?? narrativeSection(kind)
          const title = mapping?.label ?? String(block.title ?? 'Pasos')
          push(bucket, destination, `${title}: ${parts.join(' · ')}`)
        }
        break
      }
      case 'decision': {
        const chosen = (usage.modifications.decision_branches ?? []).find(
          (d) => d['block_id'] === block.id,
        )
        if (chosen) {
          const branches = (block.branches ?? []) as Array<{ id: string; label: string }>
          const label =
            (chosen['branch_label'] as string | undefined) ??
            branches.find((b) => b.id === chosen['branch_id'])?.label ??
            ''
          if (label) {
            const destination = mapping?.section ?? narrativeSection(kind)
            const prefix = mapping?.label ?? 'Decisión'
            push(bucket, destination, `${prefix}: ${String(block.condition ?? '')} → ${label}`)
          }
        }
        break
      }
      // dosage_table / lab_order / imaging_order: plan comes from order records.
      // alert / text: reference material, never part of the historia.
      default:
        break
    }
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */

function buildPlan(orders: RecordOrdersInput): string {
  const lines: string[] = []
  for (const item of orders.prescriptionItems) {
    lines.push(`${item.drug} ${item.dose} ${item.route} ${item.frequency} — ${item.duration}`)
  }
  if (orders.labTests.length > 0) lines.push(`Laboratorio: ${orders.labTests.join(', ')}`)
  if (orders.imagingStudies.length > 0) lines.push(`Imágenes: ${orders.imagingStudies.join(', ')}`)
  return lines.join('\n')
}

export function generateRecordSections(input: GenerateRecordSectionsInput): RecordSection[] {
  const bucket: Bucket = new Map()
  push(bucket, 'ficha_identificacion', buildFicha(input.patient))
  for (const usage of input.usages) walkBlocks(usage.blocks, usage, input.kind, bucket)
  push(bucket, 'plan_tratamiento', buildPlan(input.orders))
  for (const amendment of input.amendments) {
    push(bucket, 'enmiendas', `${amendment.amendedAt.slice(0, 10)}: ${amendment.reason}`)
  }

  const required = new Set(REQUIRED_BY_KIND[input.kind])
  const excluded = new Set(EXCLUDED_BY_KIND[input.kind])

  const sections: RecordSection[] = []
  for (const key of RECORD_SECTION_KEYS) {
    if (excluded.has(key)) continue
    const content = (bucket.get(key) ?? []).join('\n\n')
    const isRequired = required.has(key)
    // ficha always renders; optional sections render only when they have content
    if (!content && !isRequired && key !== 'ficha_identificacion') continue
    sections.push({
      key,
      title: RECORD_SECTION_TITLES[key],
      content,
      source: 'generated',
      required: isRequired,
    })
  }
  return sections
}
