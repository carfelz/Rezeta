import { VitalInput } from './VitalInput'
import { computeBMI, type LocalVitals } from '@/lib/consultation/vitals'
import { vitalsSectionStrings } from './strings'
import { Input, InputAdorn, InputGroup } from '@/components/ui'

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
      return <p className="text-[13px] text-n-300">{vitalsSectionStrings.emptyDash}</p>
    }
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="field">
        <label className="block text-[12px] font-sans font-medium text-n-700 mb-1">
          {vitalsSectionStrings.bloodPressureLabel}
        </label>
        <InputGroup>
          <Input
            type="number"
            value={vitals.bpSys}
            onChange={(e) => set('bpSys')(e.target.value)}
            placeholder="—"
            disabled={disabled}
            className="w-[52px] shrink-0 px-2"
          />
          <InputAdorn plain className="px-1">
            /
          </InputAdorn>
          <Input
            type="number"
            value={vitals.bpDia}
            onChange={(e) => set('bpDia')(e.target.value)}
            placeholder="—"
            disabled={disabled}
            className="w-[52px] shrink-0 px-2"
          />
          <InputAdorn side="right">mmHg</InputAdorn>
        </InputGroup>
      </div>

      <VitalInput
        label={vitalsSectionStrings.heartRateLabel}
        value={vitals.hr}
        onChange={set('hr')}
        unit="lpm"
        disabled={disabled}
      />
      <VitalInput
        label={vitalsSectionStrings.temperatureLabel}
        value={vitals.temp}
        onChange={set('temp')}
        unit="°C"
        disabled={disabled}
      />
      <VitalInput
        label={vitalsSectionStrings.spo2Label}
        value={vitals.spo2}
        onChange={set('spo2')}
        unit="%"
        disabled={disabled}
      />
      <VitalInput
        label={vitalsSectionStrings.weightLabel}
        value={vitals.weight}
        onChange={set('weight')}
        unit="kg"
        disabled={disabled}
      />
      <VitalInput
        label={vitalsSectionStrings.heightLabel}
        value={vitals.height}
        onChange={set('height')}
        unit="cm"
        disabled={disabled}
      />
      <VitalInput
        label={vitalsSectionStrings.bmiLabel}
        value={bmi}
        onChange={() => {}}
        unit="kg/m²"
        readOnly
      />
      <VitalInput
        label={vitalsSectionStrings.respiratoryRateLabel}
        value={vitals.resp}
        onChange={set('resp')}
        unit="resp/min"
        disabled={disabled}
      />
    </div>
  )
}
