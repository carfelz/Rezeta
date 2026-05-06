import type { Meta, StoryObj } from '@storybook/react-vite'
import { TextLink } from './TextLink'

const meta: Meta<typeof TextLink> = {
  title: 'UI/TextLink',
  component: TextLink,
  argTypes: {
    tone: { control: 'select', options: ['neutral', 'primary', 'warning', 'danger'] },
    size: { control: 'select', options: ['xs', 'sm', 'md', 'lg'] },
    weight: { control: 'select', options: ['regular', 'medium', 'semibold'] },
    underline: { control: 'select', options: ['always', 'hover', 'never'] },
  },
}
export default meta
type Story = StoryObj<typeof TextLink>

export const Default: Story = { args: { children: 'Editar' } }

export const Tones: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <TextLink tone="neutral">Editar</TextLink>
      <TextLink tone="primary">Reanudar</TextLink>
      <TextLink tone="warning">Saltar</TextLink>
      <TextLink tone="danger">Saltar al primero ↓</TextLink>
    </div>
  ),
}

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <TextLink size="xs">XS</TextLink>
      <TextLink size="sm">SM</TextLink>
      <TextLink size="md">MD</TextLink>
      <TextLink size="lg">LG</TextLink>
    </div>
  ),
}

export const Underline: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <TextLink underline="never">Never</TextLink>
      <TextLink underline="hover">Hover me</TextLink>
      <TextLink underline="always">Always</TextLink>
    </div>
  ),
}

export const Disabled: Story = { args: { children: 'Editar', disabled: true } }
