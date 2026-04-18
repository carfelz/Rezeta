import type { Meta, StoryObj } from '@storybook/react-vite'
import { CheckCircle, Warning as WarningIcon, XCircle, Info } from '@phosphor-icons/react'
import { Callout } from './Callout'

const meta: Meta<typeof Callout> = {
  title: 'UI/Callout',
  component: Callout,
  parameters: { layout: 'padded' },
  argTypes: {
    variant: { control: 'select', options: ['success', 'warning', 'danger', 'info'] },
  },
}

export default meta
type Story = StoryObj<typeof Callout>

export const Success: Story = {
  args: {
    variant: 'success',
    icon: <CheckCircle size={18} />,
    title: 'Pago recibido',
    children: 'RD$ 3,450.00 acreditados a la cuenta de Ana María Reyes. Factura F-2026-01142 marcada como pagada.',
  },
}

export const WarningStory: Story = {
  name: 'Warning',
  args: {
    variant: 'warning',
    icon: <WarningIcon size={18} />,
    title: 'Revisión pendiente',
    children: 'El protocolo "Dolor torácico agudo" tiene 3 bloques sin revisar desde la última actualización de guías ACC/AHA.',
  },
}

export const Danger: Story = {
  args: {
    variant: 'danger',
    icon: <XCircle size={18} />,
    title: 'Contraindicación absoluta',
    children: 'Amoxicilina registrada como alergia previa (anafilaxia, 2024). No prescribir sin evaluación especializada.',
  },
}

export const InfoVariant: Story = {
  name: 'Info',
  args: {
    variant: 'info',
    icon: <Info size={18} />,
    title: 'Nueva versión del protocolo',
    children: 'Se publicó la v2.3 de "Manejo de anafilaxia en adultos". Tus copias de trabajo no se verán afectadas.',
  },
}

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 480 }}>
      <Callout variant="success" icon={<CheckCircle size={18} />} title="Guardado correctamente">
        El protocolo ha sido publicado y está disponible para todos los usuarios.
      </Callout>
      <Callout variant="warning" icon={<WarningIcon size={18} />} title="Revisión pendiente">
        Confirma los datos antes de firmar la consulta.
      </Callout>
      <Callout variant="danger" icon={<XCircle size={18} />} title="Error al guardar">
        No se pudo guardar la consulta. Intenta nuevamente.
      </Callout>
      <Callout variant="info" icon={<Info size={18} />}>
        Correo o contraseña incorrectos.
      </Callout>
    </div>
  ),
}

export const WithoutTitle: Story = {
  args: {
    variant: 'danger',
    icon: <WarningIcon size={18} />,
    children: 'Correo o contraseña incorrectos.',
  },
}

export const WithoutIcon: Story = {
  args: {
    variant: 'info',
    title: 'Nota',
    children: 'Este campo es opcional pero recomendado para el historial clínico.',
  },
}
