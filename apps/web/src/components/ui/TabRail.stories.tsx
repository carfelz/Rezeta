import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { TabRail, TabRailItem, TabRailAdd } from './TabRail'

const meta: Meta<typeof TabRail> = {
  title: 'UI/TabRail',
  component: TabRail,
}
export default meta
type Story = StoryObj<typeof TabRail>

const Multi = (): JSX.Element => {
  const [active, setActive] = useState('hta')
  return (
    <TabRail>
      <TabRailItem active={active === 'hta'} meta="4/8" onClick={() => setActive('hta')}>
        HTA — Seguimiento
      </TabRailItem>
      <TabRailItem active={active === 'dm2'} meta="2/6" onClick={() => setActive('dm2')}>
        DM2 — Control
      </TabRailItem>
      <TabRailAdd>Añadir protocolo</TabRailAdd>
    </TabRail>
  )
}

export const Default: Story = { render: () => <Multi /> }

const Single = (): JSX.Element => (
  <TabRail>
    <TabRailItem active meta="0/12">
      HTA — Seguimiento
    </TabRailItem>
    <TabRailAdd>Añadir protocolo</TabRailAdd>
  </TabRail>
)
export const SingleTab: Story = { render: () => <Single /> }

const NoMeta = (): JSX.Element => (
  <TabRail>
    <TabRailItem active>Tab one</TabRailItem>
    <TabRailItem>Tab two</TabRailItem>
    <TabRailItem>Tab three</TabRailItem>
  </TabRail>
)
export const WithoutMeta: Story = { render: () => <NoMeta /> }
