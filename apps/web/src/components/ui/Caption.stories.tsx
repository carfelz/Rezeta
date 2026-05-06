import type { Meta, StoryObj } from '@storybook/react-vite'
import { Caption } from './Caption'

const meta: Meta<typeof Caption> = {
  title: 'UI/Caption',
  component: Caption,
  argTypes: {
    tone: {
      control: 'select',
      options: ['neutral', 'muted', 'strong', 'primary', 'warning', 'danger', 'success'],
    },
    size: { control: 'select', options: ['xs', 'sm', 'md', 'lg'] },
    weight: { control: 'select', options: ['regular', 'medium', 'semibold'] },
  },
}
export default meta
type Story = StoryObj<typeof Caption>

export const Default: Story = {
  args: { children: 'Anamnesis y exploración' },
}

export const Tones: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <Caption tone="muted">muted · Última: hace 3 meses</Caption>
      <Caption tone="neutral">neutral · El borrador se conserva 7 días.</Caption>
      <Caption tone="strong">strong · Examen físico</Caption>
      <Caption tone="primary">primary · Reanudar</Caption>
      <Caption tone="warning">warning · Saltar paso</Caption>
      <Caption tone="danger">danger · Faltan 3 campos</Caption>
      <Caption tone="success">success · Protocolo completo</Caption>
    </div>
  ),
}

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <Caption size="xs">XS</Caption>
      <Caption size="sm">SM</Caption>
      <Caption size="md">MD</Caption>
      <Caption size="lg">LG</Caption>
    </div>
  ),
}
