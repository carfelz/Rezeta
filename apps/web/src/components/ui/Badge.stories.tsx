import type { Meta, StoryObj } from '@storybook/react-vite'
import { Badge } from './Badge'

const meta: Meta<typeof Badge> = {
  title: 'UI/Badge',
  component: Badge,
  parameters: { layout: 'centered' },
  argTypes: {
    variant: {
      control: 'select',
      options: ['draft', 'active', 'signed', 'review', 'archived', 'paid', 'overdue'],
    },
    showDot: { control: 'boolean' },
  },
}

export default meta
type Story = StoryObj<typeof Badge>

export const Draft: Story = { args: { variant: 'draft', children: 'Borrador' } }
export const Active: Story = { args: { variant: 'active', children: 'Activo' } }
export const Signed: Story = { args: { variant: 'signed', children: 'Firmado' } }
export const Review: Story = { args: { variant: 'review', children: 'En revisión' } }
export const Archived: Story = { args: { variant: 'archived', children: 'Archivado' } }
export const Paid: Story = { args: { variant: 'paid', children: 'Pagado' } }
export const Overdue: Story = { args: { variant: 'overdue', children: 'Vencido' } }

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <Badge variant="draft">Borrador</Badge>
      <Badge variant="active">Activo</Badge>
      <Badge variant="signed">Firmado</Badge>
      <Badge variant="review">En revisión</Badge>
      <Badge variant="archived">Archivado</Badge>
      <Badge variant="paid">Pagado</Badge>
      <Badge variant="overdue">Vencido</Badge>
    </div>
  ),
}

export const WithoutDot: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <Badge variant="active" showDot={false}>Activo</Badge>
      <Badge variant="paid" showDot={false}>Pagado</Badge>
      <Badge variant="overdue" showDot={false}>Vencido</Badge>
    </div>
  ),
}
