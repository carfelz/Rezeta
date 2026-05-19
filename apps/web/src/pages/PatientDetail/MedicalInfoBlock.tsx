import { Badge } from '@/components/ui'
import type { Patient } from '@rezeta/shared'

export function MedicalInfoBlock({ patient }: { patient: Patient }): JSX.Element | null {
  if (patient.allergies.length === 0 && patient.chronicConditions.length === 0) return null
  return (
    <div className="border border-n-200 rounded-md bg-n-0 p-5 mb-4">
      <h2 className="text-[12px] font-mono font-semibold text-n-600 uppercase tracking-[0.08em] mb-4">
        Antecedentes médicos
      </h2>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        {patient.allergies.length > 0 && (
          <div>
            <div className="text-[10.5px] font-mono uppercase tracking-[0.08em] text-n-400 mb-2">
              Alergias
            </div>
            <div className="flex flex-wrap gap-1">
              {patient.allergies.map((a) => (
                <Badge key={a} variant="overdue" showDot={false}>
                  {a}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {patient.chronicConditions.length > 0 && (
          <div>
            <div className="text-[10.5px] font-mono uppercase tracking-[0.08em] text-n-400 mb-2">
              Condiciones crónicas
            </div>
            <div className="flex flex-wrap gap-1">
              {patient.chronicConditions.map((c) => (
                <Badge key={c} variant="review" showDot={false}>
                  {c}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
