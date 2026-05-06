import type { Meta, StoryObj } from '@storybook/react-vite'
import { Chip } from './Chip'

const meta: Meta<typeof Chip> = {
  title: 'UI/Chip',
  component: Chip,
  argTypes: {
    tone: {
      control: 'select',
      options: ['primary', 'primarySolid', 'warning', 'danger', 'success', 'neutral'],
    },
    size: { control: 'select', options: ['xs', 'sm', 'md'] },
  },
}
export default meta
type Story = StoryObj<typeof Chip>

export const Default: Story = { args: { children: 'En curso' } }

export const Tones: Story = {
  render: () => (
    <div className="flex items-center flex-wrap gap-2">
      <Chip tone="primary">Ver pasos</Chip>
      <Chip tone="primarySolid">Más probable</Chip>
      <Chip tone="warning">Fuera de protocolo</Chip>
      <Chip tone="danger">Requerido</Chip>
      <Chip tone="success">Completo</Chip>
      <Chip tone="neutral">Borrador</Chip>
    </div>
  ),
}

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Chip size="xs">XS</Chip>
      <Chip size="sm">SM</Chip>
      <Chip size="md">MD</Chip>
    </div>
  ),
}

export const AsButton: Story = {
  args: {
    children: 'Ver pasos',
    asButton: true,
  },
}
