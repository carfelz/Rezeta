import type { Meta, StoryObj } from '@storybook/react-vite'
import { DashedButton } from './DashedButton'

const meta: Meta<typeof DashedButton> = {
  title: 'UI/DashedButton',
  component: DashedButton,
  argTypes: {
    tone: { control: 'select', options: ['neutral', 'subtle', 'warning'] },
    size: { control: 'select', options: ['sm', 'md'] },
  },
}
export default meta
type Story = StoryObj<typeof DashedButton>

export const Default: Story = {
  args: { children: '+ Añadir medicación' },
  render: (args) => (
    <div className="max-w-md">
      <DashedButton {...args} />
    </div>
  ),
}

export const Tones: Story = {
  render: () => (
    <div className="flex flex-col gap-3 max-w-md">
      <DashedButton tone="neutral">+ Añadir nota fuera de protocolo</DashedButton>
      <DashedButton tone="subtle">+ Añadir grupo de receta</DashedButton>
      <DashedButton tone="warning">+ Añadir alerta</DashedButton>
    </div>
  ),
}

export const Disabled: Story = {
  args: { children: '+ Añadir medicación', disabled: true },
}
