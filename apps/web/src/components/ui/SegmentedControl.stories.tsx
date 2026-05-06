import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { SegmentedControl } from './SegmentedControl'

const meta: Meta<typeof SegmentedControl> = {
  title: 'UI/SegmentedControl',
  component: SegmentedControl,
}
export default meta
type Story = StoryObj<typeof SegmentedControl>

const ViewToggle = (): JSX.Element => {
  const [v, setV] = useState<'soap' | 'canvas'>('soap')
  return (
    <SegmentedControl
      options={[
        { value: 'soap', label: 'SOAP' },
        { value: 'canvas', label: 'Protocolo' },
      ]}
      value={v}
      onChange={setV}
    />
  )
}

export const Default: Story = { render: () => <ViewToggle /> }

const ThreeWay = (): JSX.Element => {
  const [v, setV] = useState<'a' | 'b' | 'c'>('b')
  return (
    <SegmentedControl
      options={[
        { value: 'a', label: 'Día' },
        { value: 'b', label: 'Semana' },
        { value: 'c', label: 'Mes' },
      ]}
      value={v}
      onChange={setV}
    />
  )
}

export const ThreeOptions: Story = { render: () => <ThreeWay /> }

const SmallToggle = (): JSX.Element => {
  const [v, setV] = useState<'a' | 'b'>('a')
  return (
    <SegmentedControl
      options={[
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ]}
      value={v}
      onChange={setV}
      size="sm"
    />
  )
}
export const SmallSize: Story = { render: () => <SmallToggle /> }

const Disabled = (): JSX.Element => {
  const [v, setV] = useState<'a' | 'b'>('a')
  return (
    <SegmentedControl
      options={[
        { value: 'a', label: 'SOAP' },
        { value: 'b', label: 'Protocolo' },
      ]}
      value={v}
      onChange={setV}
      disabled
    />
  )
}
export const DisabledState: Story = { render: () => <Disabled /> }
