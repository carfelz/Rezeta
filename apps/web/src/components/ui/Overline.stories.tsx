import type { Meta, StoryObj } from '@storybook/react-vite'
import { Overline } from './Overline'

const meta: Meta<typeof Overline> = {
  title: 'UI/Overline',
  component: Overline,
  argTypes: {
    tone: {
      control: 'select',
      options: ['neutral', 'muted', 'primary', 'warning', 'danger', 'success'],
    },
    size: { control: 'select', options: ['xs', 'sm', 'md', 'lg'] },
    weight: { control: 'select', options: ['regular', 'medium', 'semibold'] },
  },
}
export default meta
type Story = StoryObj<typeof Overline>

export const Default: Story = { args: { children: 'Paso 1 de 2 · ¿Qué traes hoy?' } }

export const Tones: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <Overline tone="neutral">Neutral · Para Isabel</Overline>
      <Overline tone="muted">Muted · Sus consultas anteriores</Overline>
      <Overline tone="primary">Primary · En curso</Overline>
      <Overline tone="warning">Warning · Saltar paso</Overline>
      <Overline tone="danger">Danger · Faltantes</Overline>
      <Overline tone="success">Success · Protocolo completo</Overline>
    </div>
  ),
}

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <Overline size="xs">XS · Más probable</Overline>
      <Overline size="sm">SM · Pasos del protocolo</Overline>
      <Overline size="md">MD · Para Isabel · Sus consultas anteriores</Overline>
      <Overline size="lg">LG · Consulta en progreso</Overline>
    </div>
  ),
}

export const InDarkContext: Story = {
  render: () => (
    <div className="bg-p-50 p-4 rounded-md">
      <Overline tone="primary">Saltar paso</Overline>
    </div>
  ),
}
