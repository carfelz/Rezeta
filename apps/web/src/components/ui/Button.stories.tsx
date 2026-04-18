import type { Meta, StoryObj } from '@storybook/react-vite'
import { Plus, Trash, PencilSimple, DotsThree, SignOut } from '@phosphor-icons/react'
import { Button } from './Button'

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  parameters: { layout: 'centered' },
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary', 'ghost', 'danger'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    iconOnly: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
}

export default meta
type Story = StoryObj<typeof Button>

export const Primary: Story = {
  args: { children: 'Nueva consulta', variant: 'primary' },
}

export const Secondary: Story = {
  args: { children: 'Guardar borrador', variant: 'secondary' },
}

export const Ghost: Story = {
  args: { children: 'Cancelar', variant: 'ghost' },
}

export const Danger: Story = {
  args: { children: 'Archivar paciente', variant: 'danger' },
}

export const WithLeadingIcon: Story = {
  args: {
    children: (
      <>
        <Plus /> Nueva consulta
      </>
    ),
    variant: 'primary',
  },
}

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger">Danger</Button>
    </div>
  ),
}

export const AllSizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
}

export const IconOnly: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <Button size="sm" iconOnly aria-label="Añadir"><Plus /></Button>
      <Button size="md" iconOnly aria-label="Añadir"><Plus /></Button>
      <Button size="lg" iconOnly aria-label="Añadir"><Plus /></Button>
      <Button size="md" iconOnly variant="secondary" aria-label="Editar"><PencilSimple /></Button>
      <Button size="md" iconOnly variant="ghost" aria-label="Más"><DotsThree /></Button>
      <Button size="md" iconOnly variant="danger" aria-label="Eliminar"><Trash /></Button>
    </div>
  ),
}

export const DisabledStates: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      <Button variant="primary" disabled>Primary</Button>
      <Button variant="secondary" disabled>Secondary</Button>
      <Button variant="ghost" disabled>Ghost</Button>
      <Button variant="danger" disabled>Danger</Button>
    </div>
  ),
}

export const WithIcons: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
      <Button variant="primary"><Plus /> Nueva cita</Button>
      <Button variant="secondary"><PencilSimple /> Editar</Button>
      <Button variant="ghost"><SignOut /> Cerrar sesión</Button>
      <Button variant="danger"><Trash /> Eliminar</Button>
    </div>
  ),
}
