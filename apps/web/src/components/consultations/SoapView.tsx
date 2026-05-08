import { SectionBlock } from './SectionBlock'
import { SoapTextarea } from './SoapTextarea'
import { VitalsSection } from './VitalsSection'
import { DiagnosesSection } from './DiagnosesSection'
import type { LocalVitals } from '@/lib/consultation/vitals'

export interface SoapViewProps {
  chiefComplaint: string
  onChiefComplaintChange: (v: string) => void
  subjective: string
  onSubjectiveChange: (v: string) => void
  objective: string
  onObjectiveChange: (v: string) => void
  assessment: string
  onAssessmentChange: (v: string) => void
  plan: string
  onPlanChange: (v: string) => void
  vitals: LocalVitals
  onVitalsChange: (v: LocalVitals) => void
  diagnoses: string[]
  onDiagnosesChange: (d: string[]) => void
  isSigned: boolean
}

export function SoapView({
  chiefComplaint,
  onChiefComplaintChange,
  subjective,
  onSubjectiveChange,
  objective,
  onObjectiveChange,
  assessment,
  onAssessmentChange,
  plan,
  onPlanChange,
  vitals,
  onVitalsChange,
  diagnoses,
  onDiagnosesChange,
  isSigned,
}: SoapViewProps): JSX.Element {
  return (
    <div>
      <SectionBlock title="Motivo de consulta" id="field-chiefComplaint">
        <SoapTextarea
          value={chiefComplaint}
          onChange={onChiefComplaintChange}
          placeholder="Seguimiento trimestral, motivo de consulta, síntomas principales…"
          rows={2}
          disabled={isSigned}
        />
      </SectionBlock>

      <SectionBlock title="Signos vitales" id="field-vitals">
        <VitalsSection vitals={vitals} onChange={onVitalsChange} disabled={isSigned} />
      </SectionBlock>

      <SectionBlock title="Subjetivo" id="field-subjective">
        <SoapTextarea
          value={subjective}
          onChange={onSubjectiveChange}
          placeholder="Historia del paciente, síntomas, antecedentes relevantes, contexto clínico…"
          rows={4}
          disabled={isSigned}
        />
      </SectionBlock>

      <SectionBlock title="Examen físico" id="field-objective">
        <SoapTextarea
          value={objective}
          onChange={onObjectiveChange}
          placeholder="Hallazgos del examen físico, signos clínicos, datos objetivos…"
          rows={4}
          disabled={isSigned}
        />
      </SectionBlock>

      <SectionBlock title="Evaluación" id="field-assessment">
        <SoapTextarea
          value={assessment}
          onChange={onAssessmentChange}
          placeholder="Impresión diagnóstica, diagnóstico diferencial…"
          rows={3}
          disabled={isSigned}
        />
      </SectionBlock>

      <SectionBlock title="Plan" id="field-plan">
        <SoapTextarea
          value={plan}
          onChange={onPlanChange}
          placeholder="Tratamiento, indicaciones, estudios solicitados, seguimiento…"
          rows={4}
          disabled={isSigned}
        />
      </SectionBlock>

      <SectionBlock title="Diagnósticos" id="field-diagnoses">
        <DiagnosesSection diagnoses={diagnoses} onChange={onDiagnosesChange} disabled={isSigned} />
      </SectionBlock>
    </div>
  )
}
