import type { Meta, StoryObj } from '@storybook/react-vite'
import { Card, CardTitle, CardSubtitle } from './Card'

const meta: Meta = {
  title: 'UI/Card',
  parameters: { layout: 'padded' },
}

export default meta

export const StandardCard: StoryObj = {
  render: () => (
    <div style={{ width: 320 }}>
      <Card>
        <CardTitle>Próxima cita</CardTitle>
        <CardSubtitle>Martes 22 abr · 10:30 AM</CardSubtitle>
      </Card>
    </div>
  ),
}

export const SelectedCard: StoryObj = {
  render: () => (
    <div style={{ width: 320, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Card>
        <CardTitle>Opción A</CardTitle>
        <CardSubtitle>No seleccionada</CardSubtitle>
      </Card>
      <Card selected>
        <CardTitle>Opción B</CardTitle>
        <CardSubtitle>Seleccionada — 2px teal rule</CardSubtitle>
      </Card>
    </div>
  ),
}

export const CardWithContent: StoryObj = {
  render: () => (
    <div style={{ width: 400 }}>
      <Card>
        <CardTitle>Mi cuenta</CardTitle>
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div
              style={{
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                letterSpacing: '0.10em',
                color: 'var(--color-n-500)',
                marginBottom: 2,
              }}
            >
              Nombre
            </div>
            <div style={{ fontSize: 14, color: 'var(--color-n-700)' }}>Dr. Juan García</div>
          </div>
          <div>
            <div
              style={{
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                letterSpacing: '0.10em',
                color: 'var(--color-n-500)',
                marginBottom: 2,
              }}
            >
              Especialidad
            </div>
            <div style={{ fontSize: 14, color: 'var(--color-n-700)' }}>Cardiología</div>
          </div>
          <div>
            <div
              style={{
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                letterSpacing: '0.10em',
                color: 'var(--color-n-500)',
                marginBottom: 2,
              }}
            >
              No. de licencia
            </div>
            <div
              style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--color-n-600)' }}
            >
              CMP-12345
            </div>
          </div>
        </div>
      </Card>
    </div>
  ),
}
