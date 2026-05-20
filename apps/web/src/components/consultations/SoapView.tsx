import { SectionBlock } from './SectionBlock'
import { SoapTextarea } from './SoapTextarea'
import { VitalsSection } from './VitalsSection'
import { DiagnosesSection } from './DiagnosesSection'
import type { LocalVitals } from '@/lib/consultation/vitals'
import { soapViewStrings } from './strings'

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
      <SectionBlock title={soapViewStrings.chiefComplaintTitle} id="field-chiefComplaint">
        <SoapTextarea
          value={chiefComplaint}
          onChange={onChiefComplaintChange}
          placeholder={soapViewStrings.chiefComplaintPlaceholder}
          rows={2}
          disabled={isSigned}
        />
      </SectionBlock>

      <SectionBlock title={soapViewStrings.vitalsTitle} id="field-vitals">
        <VitalsSection vitals={vitals} onChange={onVitalsChange} disabled={isSigned} />
      </SectionBlock>

      <SectionBlock title={soapViewStrings.subjectiveTitle} id="field-subjective">
        <SoapTextarea
          value={subjective}
          onChange={onSubjectiveChange}
          placeholder={soapViewStrings.subjectivePlaceholder}
          rows={4}
          disabled={isSigned}
        />
      </SectionBlock>

      <SectionBlock title={soapViewStrings.objectiveTitle} id="field-objective">
        <SoapTextarea
          value={objective}
          onChange={onObjectiveChange}
          placeholder={soapViewStrings.objectivePlaceholder}
          rows={4}
          disabled={isSigned}
        />
      </SectionBlock>

      <SectionBlock title={soapViewStrings.assessmentTitle} id="field-assessment">
        <SoapTextarea
          value={assessment}
          onChange={onAssessmentChange}
          placeholder={soapViewStrings.assessmentPlaceholder}
          rows={3}
          disabled={isSigned}
        />
      </SectionBlock>

      <SectionBlock title={soapViewStrings.planTitle} id="field-plan">
        <SoapTextarea
          value={plan}
          onChange={onPlanChange}
          placeholder={soapViewStrings.planPlaceholder}
          rows={4}
          disabled={isSigned}
        />
      </SectionBlock>

      <SectionBlock title={soapViewStrings.diagnosesTitle} id="field-diagnoses">
        <DiagnosesSection diagnoses={diagnoses} onChange={onDiagnosesChange} disabled={isSigned} />
      </SectionBlock>
    </div>
  )
}
