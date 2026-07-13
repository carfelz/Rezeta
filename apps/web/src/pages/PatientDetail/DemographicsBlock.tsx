import { ReadField } from '@/pages/Patients/ReadField'
import { SEX_LABELS, formatAge, formatDate } from '@/pages/Patients/helpers'
import type { Patient } from '@rezeta/shared'
import { patientDetailStrings } from './strings'

export function DemographicsBlock({ patient }: { patient: Patient }): JSX.Element {
  return (
    <div className="border border-n-200 rounded-md bg-n-0 p-5 mb-4">
      <h2 className="text-xs font-mono font-semibold text-n-600 uppercase tracking-[0.08em] mb-4">
        {patientDetailStrings.sectionTitle}
      </h2>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        <ReadField
          label={patientDetailStrings.fieldDateOfBirth}
          value={
            patient.dateOfBirth
              ? `${formatDate(patient.dateOfBirth)} (${formatAge(patient.dateOfBirth)})`
              : null
          }
        />
        <ReadField
          label={patientDetailStrings.fieldSex}
          value={patient.sex ? SEX_LABELS[patient.sex] : null}
        />
        <ReadField label={patientDetailStrings.fieldPhone} value={patient.phone} />
        <ReadField label={patientDetailStrings.fieldEmail} value={patient.email} />
        {patient.notes && (
          <div className="col-span-2">
            <ReadField label={patientDetailStrings.fieldNotes} value={patient.notes} />
          </div>
        )}
      </div>
    </div>
  )
}
