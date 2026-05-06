import type { Meta, StoryObj } from '@storybook/react-vite'
import { IconButton } from './IconButton'

const meta: Meta<typeof IconButton> = {
  title: 'UI/IconButton',
  component: IconButton,
  argTypes: {
    tone: { control: 'select', options: ['neutral', 'danger', 'muted', 'warning'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
  },
}
export default meta
type Story = StoryObj<typeof IconButton>

export const Default: Story = {
  args: { icon: 'ph ph-x', 'aria-label': 'Cerrar' },
}

export const Tones: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <IconButton icon="ph ph-x" aria-label="Cerrar (neutral)" tone="neutral" />
      <IconButton icon="ph ph-trash" aria-label="Eliminar" tone="danger" />
      <IconButton icon="ph ph-eye" aria-label="Ver" tone="muted" />
      <IconButton icon="ph ph-x" aria-label="Cerrar aviso" tone="warning" />
    </div>
  ),
}

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <IconButton icon="ph ph-x" aria-label="sm" size="sm" />
      <IconButton icon="ph ph-x" aria-label="md" size="md" />
      <IconButton icon="ph ph-x" aria-label="lg" size="lg" />
    </div>
  ),
}

export const Disabled: Story = {
  args: { icon: 'ph ph-trash', 'aria-label': 'Eliminar', tone: 'danger', disabled: true },
}
