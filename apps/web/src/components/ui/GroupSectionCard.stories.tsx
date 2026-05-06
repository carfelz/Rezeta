import type { Meta, StoryObj } from '@storybook/react-vite'
import { GroupSectionCard } from './GroupSectionCard'
import { Button } from './Button'

const meta: Meta<typeof GroupSectionCard> = {
  title: 'UI/GroupSectionCard',
  component: GroupSectionCard,
}
export default meta
type Story = StoryObj<typeof GroupSectionCard>

export const RailSection: Story = {
  render: () => (
    <div className="max-w-[260px]">
      <GroupSectionCard label="Pasos del protocolo" compact>
        <div className="text-[12px] text-n-700 py-1">01 Motivo</div>
        <div className="text-[12px] text-n-700 py-1">02 Vitales</div>
        <div className="text-[12px] text-n-400 py-1">03 Decisión</div>
      </GroupSectionCard>
    </div>
  ),
}

export const WithTitleHeader: Story = {
  render: () => (
    <div className="max-w-md">
      <GroupSectionCard
        label="Receta"
        title="Tratamiento HTA"
        headerActions={<span className="text-[11px] font-mono text-success-text">✓ Generado</span>}
      >
        <div className="px-4 py-3">
          <div className="text-[13px] font-semibold text-n-800">Amlodipino 5mg</div>
          <div className="text-[12px] font-mono text-n-500 mt-1">Oral · 1 vez al día · 30 días</div>
        </div>
      </GroupSectionCard>
    </div>
  ),
}

export const WithFooter: Story = {
  render: () => (
    <div className="max-w-md">
      <GroupSectionCard
        label="Receta"
        title="Tratamiento"
        footer={<Button size="sm">Generar receta</Button>}
      >
        <p className="px-4 py-3 text-[12.5px] text-n-300 italic">Sin medicamentos.</p>
      </GroupSectionCard>
    </div>
  ),
}

export const DangerTone: Story = {
  render: () => (
    <div className="max-w-[260px]">
      <GroupSectionCard label="Faltantes (3)" tone="danger" compact>
        <div className="text-[12.5px] text-danger-text py-1">Temperatura</div>
        <div className="text-[12.5px] text-danger-text py-1">Peso</div>
        <div className="text-[12.5px] text-danger-text py-1">Fecha de seguimiento</div>
      </GroupSectionCard>
    </div>
  ),
}
