import type { Meta, StoryObj } from '@storybook/react-vite'
import { Avatar } from './Avatar'

const meta: Meta<typeof Avatar> = {
  title: 'UI/Avatar',
  component: Avatar,
  parameters: { layout: 'centered' },
  argTypes: {
    size: { control: 'select', options: ['default', 'sm', 'xs'] },
    initials: { control: 'text' },
  },
}

export default meta
type Story = StoryObj<typeof Avatar>

export const Default: Story = { args: { initials: 'JG', size: 'default' } }
export const Small: Story = { args: { initials: 'AM', size: 'sm' } }
export const ExtraSmall: Story = { args: { initials: 'AR', size: 'xs' } }

export const AllSizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <Avatar initials="JG" size="default" />
      <Avatar initials="AM" size="sm" />
      <Avatar initials="AR" size="xs" />
    </div>
  ),
}

export const DifferentInitials: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <Avatar initials="JG" />
      <Avatar initials="AM" />
      <Avatar initials="DR" />
      <Avatar initials="LC" />
      <Avatar initials="PE" />
    </div>
  ),
}
