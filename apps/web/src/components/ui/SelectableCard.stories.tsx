import type { Meta, StoryObj } from '@storybook/react-vite'
import { SelectableCard } from './SelectableCard'

const meta: Meta<typeof SelectableCard> = {
  title: 'UI/SelectableCard',
  component: SelectableCard,
  argTypes: {
    density: { control: 'select', options: ['compact', 'standard', 'large'] },
    state: { control: 'select', options: ['default', 'selected', 'primary'] },
  },
}
export default meta
type Story = StoryObj<typeof SelectableCard>

export const Default: Story = {
  render: (args) => (
    <SelectableCard {...args} className="max-w-sm">
      <i className="ph ph-stack text-base text-n-500" />
      <span className="text-sm text-n-700 flex-1">HTA — Seguimiento</span>
      <span className="font-mono text-overline text-n-400">v2</span>
    </SelectableCard>
  ),
}

export const Selected: Story = {
  args: { state: 'selected' },
  render: (args) => (
    <SelectableCard {...args} className="max-w-sm">
      <i className="ph ph-stack text-base text-p-500" />
      <span className="text-sm text-p-700 flex-1">HTA — Seguimiento</span>
    </SelectableCard>
  ),
}

export const Primary: Story = {
  args: { state: 'primary', density: 'large' },
  render: (args) => (
    <SelectableCard {...args} className="max-w-sm">
      <i className="ph ph-heartbeat text-h3 text-p-500" />
      <div className="flex-1">
        <div className="text-sm font-medium text-n-900">Seguimiento HTA</div>
        <div className="text-overline text-n-500 mt-1">Última: hace 3 meses · v2</div>
      </div>
    </SelectableCard>
  ),
}

export const Densities: Story = {
  render: () => (
    <div className="flex flex-col gap-3 max-w-sm">
      <SelectableCard density="compact">
        <span className="text-sm text-n-700">Compact row</span>
      </SelectableCard>
      <SelectableCard density="standard">
        <span className="text-sm text-n-700">Standard card</span>
      </SelectableCard>
      <SelectableCard density="large">
        <span className="text-sm text-n-700">Large card</span>
      </SelectableCard>
    </div>
  ),
}

export const Disabled: Story = {
  args: { disabled: true },
  render: (args) => (
    <SelectableCard {...args} className="max-w-sm">
      <span className="text-sm text-n-500">Disabled card</span>
    </SelectableCard>
  ),
}
