import { ReadField } from '@/pages/Pacientes/ReadField'
import { SEX_LABELS, formatAge, formatDate } from '@/pages/Pacientes/helpers'
import type { Patient } from '@rezeta/shared'

export function DemographicsBlock({ patient }: { patient: Patient }): JSX.Element {
  return (
    <div className="border border-n-200 rounded-md bg-n-0 p-5 mb-4">
      <h2 className="text-[12px] font-mono font-semibold text-n-600 uppercase tracking-[0.08em] mb-4">
        Datos personales
      </h2>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        <ReadField
          label="Fecha de nacimiento"
          value={
            patient.dateOfBirth
              ? `${formatDate(patient.dateOfBirth)} (${formatAge(patient.dateOfBirth)})`
              : null
          }
        />
        <ReadField label="Sexo" value={patient.sex ? SEX_LABELS[patient.sex] : null} />
        <ReadField label="Teléfono" value={patient.phone} />
        <ReadField label="Correo electrónico" value={patient.email} />
        {patient.notes && (
          <div className="col-span-2">
            <ReadField label="Notas" value={patient.notes} />
          </div>
        )}
      </div>
    </div>
  )
}
