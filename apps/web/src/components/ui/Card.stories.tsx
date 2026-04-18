import type { Meta, StoryObj } from '@storybook/react-vite'
import { Card, CardTitle, CardSubtitle, CardItem } from './Card'
import { Avatar } from './Avatar'
import { Badge } from './Badge'

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

export const CardItemBasic: StoryObj = {
  render: () => (
    <div style={{ width: 480 }}>
      <CardItem
        leading={<Avatar initials="AM" />}
        name="Ana María Reyes"
        meta="Cédula · 001-1234567-8 · 42 años"
        trailing={<Badge variant="active">Activo</Badge>}
        onClick={() => {}}
      />
    </div>
  ),
}

export const CardItemList: StoryObj = {
  render: () => (
    <div style={{ width: 560, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[
        { initials: 'AM', name: 'Ana María Reyes', meta: '001-1234567-8 · 42 años', badge: 'active' as const, badgeLabel: 'Activo' },
        { initials: 'JL', name: 'José Luis Martínez', meta: '001-9876543-2 · 58 años', badge: 'active' as const, badgeLabel: 'Activo' },
        { initials: 'CR', name: 'Carmen Rosa Vásquez', meta: '402-2345678-9 · 35 años', badge: 'archived' as const, badgeLabel: 'Archivado' },
        { initials: 'PM', name: 'Pedro Miguel Sánchez', meta: '001-3456789-0 · 67 años', badge: 'review' as const, badgeLabel: 'En revisión' },
      ].map((p) => (
        <CardItem
          key={p.initials}
          leading={<Avatar initials={p.initials} />}
          name={p.name}
          meta={p.meta}
          trailing={<Badge variant={p.badge}>{p.badgeLabel}</Badge>}
          onClick={() => {}}
        />
      ))}
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
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.10em', color: 'var(--color-n-500)', marginBottom: 2 }}>Nombre</div>
            <div style={{ fontSize: 14, color: 'var(--color-n-700)' }}>Dr. Juan García</div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.10em', color: 'var(--color-n-500)', marginBottom: 2 }}>Especialidad</div>
            <div style={{ fontSize: 14, color: 'var(--color-n-700)' }}>Cardiología</div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.10em', color: 'var(--color-n-500)', marginBottom: 2 }}>No. de licencia</div>
            <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--color-n-600)' }}>CMP-12345</div>
          </div>
        </div>
      </Card>
    </div>
  ),
}
