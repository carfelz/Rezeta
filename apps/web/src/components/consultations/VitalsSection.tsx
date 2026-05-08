import { VitalInput } from './VitalInput'
import { computeBMI, type LocalVitals } from '@/lib/consultation/vitals'

export interface VitalsSectionProps {
  vitals: LocalVitals
  onChange: (v: LocalVitals) => void
  disabled: boolean
}

export function VitalsSection({ vitals, onChange, disabled }: VitalsSectionProps): JSX.Element {
  const set = (key: keyof LocalVitals) => (val: string) => onChange({ ...vitals, [key]: val })
  const bmi = computeBMI(vitals)

  if (disabled) {
    const hasData = Object.values(vitals).some(Boolean)
    if (!hasData) {
      return <p className="text-[13px] text-n-300">—</p>
    }
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="field">
        <label className="block text-[12px] font-sans font-medium text-n-700 mb-1">
          Presión arterial
        </label>
        <div className="flex h-[34px] border border-n-300 rounded-sm overflow-hidden focus-within:border-p-500 focus-within:ring-[3px] focus-within:ring-p-500/10">
          <input
            type="number"
            value={vitals.bpSys}
            onChange={(e) => set('bpSys')(e.target.value)}
            placeholder="—"
            disabled={disabled}
            className="w-[52px] shrink-0 px-2 text-[13px] font-sans text-n-700 placeholder:text-n-300 bg-n-0 focus:outline-none disabled:bg-n-25 disabled:text-n-500"
          />
          <span className="px-1 flex items-center text-n-400 text-[12px] bg-n-0">/</span>
          <input
            type="number"
            value={vitals.bpDia}
            onChange={(e) => set('bpDia')(e.target.value)}
            placeholder="—"
            disabled={disabled}
            className="w-[52px] shrink-0 px-2 text-[13px] font-sans text-n-700 placeholder:text-n-300 bg-n-0 focus:outline-none disabled:bg-n-25 disabled:text-n-500"
          />
          <span className="px-2 flex items-center text-[11px] font-mono text-n-500 bg-n-50 border-l border-n-200 shrink-0">
            mmHg
          </span>
        </div>
      </div>

      <VitalInput
        label="Frec. cardíaca"
        value={vitals.hr}
        onChange={set('hr')}
        unit="lpm"
        disabled={disabled}
      />
      <VitalInput
        label="Temperatura"
        value={vitals.temp}
        onChange={set('temp')}
        unit="°C"
        disabled={disabled}
      />
      <VitalInput
        label="Saturación O₂"
        value={vitals.spo2}
        onChange={set('spo2')}
        unit="%"
        disabled={disabled}
      />
      <VitalInput
        label="Peso"
        value={vitals.weight}
        onChange={set('weight')}
        unit="kg"
        disabled={disabled}
      />
      <VitalInput
        label="Talla"
        value={vitals.height}
        onChange={set('height')}
        unit="cm"
        disabled={disabled}
      />
      <VitalInput label="IMC · calculado" value={bmi} onChange={() => {}} unit="kg/m²" readOnly />
      <VitalInput
        label="Frec. respiratoria"
        value={vitals.resp}
        onChange={set('resp')}
        unit="resp/min"
        disabled={disabled}
      />
    </div>
  )
}
