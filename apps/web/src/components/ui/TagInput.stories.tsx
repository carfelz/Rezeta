import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { TagInput } from './TagInput'
import { Field } from './Input'

const meta: Meta<typeof TagInput> = {
  title: 'UI/TagInput',
  component: TagInput,
}
export default meta
type Story = StoryObj<typeof TagInput>

const Controlled = (props: { initial?: string[]; disabled?: boolean }): JSX.Element => {
  const [value, setValue] = useState(props.initial ?? [])
  return (
    <div style={{ width: 360 }}>
      <TagInput
        value={value}
        onChange={setValue}
        placeholder="Escribir y presionar Enter…"
        removeAriaLabel={(tag) => `Quitar ${tag}`}
        disabled={props.disabled ?? false}
      />
    </div>
  )
}

export const Empty: Story = { render: () => <Controlled /> }

export const WithTags: Story = {
  render: () => <Controlled initial={['Penicilina', 'Polen']} />,
}

export const Disabled: Story = {
  render: () => <Controlled initial={['Penicilina', 'Polen']} disabled />,
}

export const WithField: Story = {
  render: () => (
    <div style={{ width: 360 }}>
      <Field label="Alergias" helper="Escribe y presiona Enter o coma para agregar.">
        <Controlled initial={['Penicilina']} />
      </Field>
    </div>
  ),
}
