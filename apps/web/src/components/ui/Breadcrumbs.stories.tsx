import type { ComponentType } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { MemoryRouter } from 'react-router-dom'
import { Breadcrumbs } from './Breadcrumbs'

const meta: Meta<typeof Breadcrumbs> = {
  title: 'UI/Breadcrumbs',
  component: Breadcrumbs,
  decorators: [
    (Story: ComponentType): JSX.Element => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
}
export default meta
type Story = StoryObj<typeof Breadcrumbs>

export const Default: Story = {
  args: {
    items: [
      { label: 'Pacientes', to: '/pacientes' },
      { label: 'Isabel Cristina Cruz', to: '/pacientes/p1' },
      { label: 'Consulta · 2 may de 2026' },
    ],
  },
}

export const Single: Story = { args: { items: [{ label: 'Dashboard' }] } }

export const TwoLevel: Story = {
  args: {
    items: [{ label: 'Pacientes', to: '/pacientes' }, { label: 'Isabel Cristina Cruz' }],
  },
}
