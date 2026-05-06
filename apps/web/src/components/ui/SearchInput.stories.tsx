import type { Meta, StoryObj } from '@storybook/react-vite'
import { SearchInput } from './SearchInput'

const meta: Meta<typeof SearchInput> = {
  title: 'UI/SearchInput',
  component: SearchInput,
  argTypes: {
    size: { control: 'select', options: ['sm', 'md'] },
  },
}
export default meta
type Story = StoryObj<typeof SearchInput>

export const Default: Story = { args: { placeholder: 'Buscar entre tus 34 protocolos…' } }

export const Small: Story = { args: { placeholder: 'Buscar protocolo…', size: 'sm' } }

export const WithValue: Story = {
  args: { placeholder: 'Buscar…', defaultValue: 'HTA seguimiento' },
}

export const Disabled: Story = {
  args: { placeholder: 'Sin protocolos disponibles', disabled: true },
}
