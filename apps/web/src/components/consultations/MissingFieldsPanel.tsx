import { Button, Callout, GroupSectionCard, IconButton, TextLink, Chip } from '@/components/ui'

export interface MissingField {
  id: string
  label: string
  description?: string
}

// ─── Inline callout (body) ──────────────────────────────────────────────────────

export interface MissingFieldsCalloutProps {
  count: number
  onJumpFirst: () => void
  onShowList: () => void
}

export function MissingFieldsCallout({
  count,
  onJumpFirst,
  onShowList,
}: MissingFieldsCalloutProps): JSX.Element {
  return (
    <Callout tone="danger" icon="ph ph-warning-circle" title="No puedes firmar todavía">
      <div className="flex items-center gap-3">
        <TextLink tone="danger" size="md" underline="hover" onClick={onJumpFirst}>
          Faltan {count} campos requeridos por el protocolo. Saltar al primero ↓
        </TextLink>
        <Button variant="secondary" size="sm" onClick={onShowList} className="ml-auto">
          Ver faltantes
        </Button>
      </div>
    </Callout>
  )
}

// ─── Right-rail panel ──────────────────────────────────────────────────────────

export interface MissingFieldsPanelProps {
  fields: MissingField[]
  onFieldClick: (fieldId: string) => void
  onDismiss?: () => void
}

export function MissingFieldsPanel({
  fields,
  onFieldClick,
  onDismiss,
}: MissingFieldsPanelProps): JSX.Element | null {
  if (fields.length === 0) return null

  return (
    <GroupSectionCard
      label={`Faltantes (${fields.length})`}
      tone="danger"
      headerActions={
        onDismiss ? (
          <IconButton icon="ph ph-x" aria-label="Cerrar panel" tone="neutral" onClick={onDismiss} />
        ) : undefined
      }
    >
      <div className="divide-y divide-n-100">
        {fields.map((field) => (
          <button
            key={field.id}
            type="button"
            onClick={() => onFieldClick(field.id)}
            className="flex items-center gap-2 w-full text-left px-3 py-2 hover:bg-danger-bg transition-colors group"
          >
            <span className="text-[12.5px] text-danger-text">{field.label}</span>
            <i className="ph ph-arrow-right text-[11px] text-danger-text ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        ))}
      </div>
    </GroupSectionCard>
  )
}

// ─── Required field badge (inline) ─────────────────────────────────────────────

export function RequiredBadge(): JSX.Element {
  return (
    <Chip tone="warning" size="xs">
      Requerido
    </Chip>
  )
}

// ─── Helper: compute missing fields ────────────────────────────────────────────

export interface ConsultationFieldCheck {
  chiefComplaint: string
  subjective: string
  objective: string
  assessment: string
  plan: string
  diagnoses: string[]
}

export function computeMissingFields(fields: ConsultationFieldCheck): MissingField[] {
  const missing: MissingField[] = []
  if (!fields.chiefComplaint.trim()) {
    missing.push({ id: 'chiefComplaint', label: 'Motivo de consulta' })
  }
  if (!fields.assessment.trim()) {
    missing.push({
      id: 'assessment',
      label: 'Evaluación',
      description: 'Impresión diagnóstica o diagnóstico diferencial',
    })
  }
  if (fields.diagnoses.length === 0) {
    missing.push({
      id: 'diagnoses',
      label: 'Diagnósticos',
      description: 'Al menos un diagnóstico registrado',
    })
  }
  return missing
}
