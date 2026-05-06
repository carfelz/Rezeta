import type { Meta, StoryObj } from '@storybook/react-vite'
import { StepCircle } from './StepCircle'

const meta: Meta<typeof StepCircle> = {
  title: 'UI/StepCircle',
  component: StepCircle,
  argTypes: {
    status: { control: 'select', options: ['done', 'active', 'pending'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
  },
}
export default meta
type Story = StoryObj<typeof StepCircle>

export const Done: Story = { args: { status: 'done', 'aria-label': 'Completado' } }

export const Active: Story = {
  args: { status: 'active', number: 5, 'aria-label': 'Paso activo 5' },
}

export const Pending: Story = { args: { status: 'pending', 'aria-label': 'Pendiente' } }

export const Sequence: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <StepCircle status="done" aria-label="Paso 1 completado" />
      <StepCircle status="done" aria-label="Paso 2 completado" />
      <StepCircle status="done" aria-label="Paso 3 completado" />
      <StepCircle status="active" number={4} aria-label="Paso 4 activo" />
      <StepCircle status="pending" aria-label="Paso 5 pendiente" />
      <StepCircle status="pending" aria-label="Paso 6 pendiente" />
    </div>
  ),
}

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <StepCircle status="done" size="sm" aria-label="sm" />
      <StepCircle status="done" size="md" aria-label="md" />
      <StepCircle status="done" size="lg" aria-label="lg" />
    </div>
  ),
}

export const Disabled: Story = { args: { status: 'done', disabled: true, 'aria-label': 'd' } }
