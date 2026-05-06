import { SegmentedControl } from '@/components/ui'
import type { ConsultationViewMode } from '@/store/ui.store'

export interface ViewModeToggleProps {
  value: ConsultationViewMode
  onChange: (mode: ConsultationViewMode) => void
}

export function ViewModeToggle({ value, onChange }: ViewModeToggleProps): JSX.Element {
  return (
    <SegmentedControl<ConsultationViewMode>
      value={value}
      onChange={onChange}
      options={[
        { value: 'soap', label: 'SOAP' },
        { value: 'canvas', label: 'Protocolo' },
      ]}
    />
  )
}
