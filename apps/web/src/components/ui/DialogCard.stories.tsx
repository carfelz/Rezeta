import type { Meta, StoryObj } from '@storybook/react-vite'
import { DialogCard } from './DialogCard'
import { Button } from './Button'
import { RadioCard } from './RadioCard'

const meta: Meta<typeof DialogCard> = {
  title: 'UI/DialogCard',
  component: DialogCard,
  argTypes: {
    width: { control: 'select', options: ['sm', 'md', 'lg', 'xl'] },
    elevation: { control: 'select', options: ['none', 'raised', 'floating'] },
    overlineTone: { control: 'select', options: ['neutral', 'warning', 'danger', 'primary'] },
  },
}
export default meta
type Story = StoryObj<typeof DialogCard>

export const SkipStep: Story = {
  args: {
    overline: 'Saltar paso',
    title: '¿Por qué saltar Examen físico?',
    description:
      'Quedará registrado en la consulta. El protocolo seguirá marcado como completo parcialmente.',
    footer: (
      <>
        <Button variant="secondary" size="sm">
          Cancelar
        </Button>
        <Button variant="warning" size="sm">
          Saltar paso
        </Button>
      </>
    ),
  },
  render: (args) => (
    <DialogCard {...args}>
      <div className="flex flex-col gap-2">
        <RadioCard selected={false}>
          <span className="text-sm text-n-800">Paciente no cooperaba</span>
        </RadioCard>
        <RadioCard selected>
          <span className="text-sm text-n-800">No clínicamente relevante hoy</span>
        </RadioCard>
      </div>
    </DialogCard>
  ),
}

export const SwitchProtocol: Story = {
  args: {
    width: 'lg',
    overline: 'Cambio de protocolo',
    title: 'Cambiar HTA → Cefalea diagnóstico',
    description: 'Has completado 3 de 8 pasos. Esto es lo que pasa con el progreso actual:',
    footer: (
      <>
        <Button variant="secondary" size="sm">
          Cancelar
        </Button>
        <Button variant="primary" size="sm">
          Cambiar protocolo
        </Button>
      </>
    ),
  },
  render: (args) => (
    <DialogCard {...args}>
      <div className="border border-n-200 rounded p-4 bg-n-25 text-xs text-n-700">
        Impact card content
      </div>
    </DialogCard>
  ),
}

export const ResumeBanner: Story = {
  args: {
    width: 'xl',
    elevation: 'raised',
    overline: 'Consulta en progreso',
    overlineTone: 'neutral',
    title: 'Bienvenido de vuelta',
    description: 'Dejaste una consulta de Isabel Cristina Cruz a medias hace 47 minutos.',
    footer: (
      <div className="flex items-center gap-2 w-full">
        <Button variant="primary" className="flex-1">
          Continuar en paso 4 · Examen físico
        </Button>
        <Button variant="secondary">Empezar nueva</Button>
      </div>
    ),
  },
  render: (args) => (
    <DialogCard {...args}>
      <div className="border border-n-200 rounded p-4 bg-n-25 text-xs text-n-700">
        Patient mini-card content
      </div>
    </DialogCard>
  ),
}
