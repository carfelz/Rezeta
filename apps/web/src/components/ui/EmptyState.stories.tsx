import type { Meta, StoryObj } from '@storybook/react-vite'
import { User, CalendarBlank, Stack, Receipt, Prescription } from '@phosphor-icons/react'
import { EmptyState } from './EmptyState'
import { Button } from './Button'

const meta: Meta<typeof EmptyState> = {
  title: 'UI/EmptyState',
  component: EmptyState,
  parameters: { layout: 'padded' },
}

export default meta
type Story = StoryObj<typeof EmptyState>

export const Patients: Story = {
  render: () => (
    <div style={{ width: 560 }}>
      <EmptyState
        icon={<User size={24} />}
        title="Aún no hay pacientes registrados"
        description="Registra a tu primer paciente para empezar a gestionar citas, consultas y prescripciones desde un solo lugar."
        action={<Button variant="primary">Registrar paciente</Button>}
      />
    </div>
  ),
}

export const Appointments: Story = {
  render: () => (
    <div style={{ width: 560 }}>
      <EmptyState
        icon={<CalendarBlank size={24} />}
        title="Sin citas programadas"
        description="No tienes citas para hoy. Agenda una nueva cita o revisa tu calendario."
        action={<Button variant="primary">Agendar primera cita</Button>}
      />
    </div>
  ),
}

export const Protocols: Story = {
  render: () => (
    <div style={{ width: 560 }}>
      <EmptyState
        icon={<Stack size={24} />}
        title="Sin protocolos guardados"
        description="Crea tu primer protocolo clínico o empieza desde una plantilla prediseñada."
        action={<Button variant="primary">Crear protocolo</Button>}
      />
    </div>
  ),
}

export const Invoices: Story = {
  render: () => (
    <div style={{ width: 560 }}>
      <EmptyState
        icon={<Receipt size={24} />}
        title="Sin facturas emitidas"
        description="Las facturas generadas durante tus consultas aparecerán aquí."
      />
    </div>
  ),
}

export const Prescriptions: Story = {
  render: () => (
    <div style={{ width: 560 }}>
      <EmptyState
        icon={<Prescription size={24} />}
        title="Sin prescripciones"
        description="Las prescripciones emitidas en consultas aparecerán aquí para su seguimiento."
      />
    </div>
  ),
}
