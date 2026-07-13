import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { RadioCard } from './RadioCard'

const meta: Meta<typeof RadioCard> = {
  title: 'UI/RadioCard',
  component: RadioCard,
}
export default meta
type Story = StoryObj<typeof RadioCard>

const REASONS = [
  { value: 'no_coop', label: 'Paciente no cooperaba' },
  { value: 'not_relevant', label: 'No clínicamente relevante hoy' },
  { value: 'already_done', label: 'Paso ya documentado en visita reciente' },
  { value: 'other', label: 'Otro…' },
]

const Group = (): JSX.Element => {
  const [v, setV] = useState('not_relevant')
  return (
    <div className="flex flex-col gap-2 max-w-md">
      {REASONS.map((r) => (
        <RadioCard key={r.value} selected={v === r.value} onClick={() => setV(r.value)}>
          <span className="text-sm text-n-800">{r.label}</span>
        </RadioCard>
      ))}
    </div>
  )
}

export const Group_: Story = { name: 'Reason group', render: () => <Group /> }

export const Default: Story = {
  args: {
    selected: false,
    children: <span className="text-sm text-n-800">Default option</span>,
  },
}

export const Selected: Story = {
  args: {
    selected: true,
    children: <span className="text-sm text-n-800">Selected option</span>,
  },
}

export const Disabled: Story = {
  args: {
    selected: false,
    disabled: true,
    children: <span className="text-sm text-n-500">Disabled option</span>,
  },
}
