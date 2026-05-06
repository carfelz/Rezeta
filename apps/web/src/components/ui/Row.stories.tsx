import type { Meta, StoryObj } from '@storybook/react-vite'
import { Row } from './Row'

const meta: Meta<typeof Row> = {
  title: 'UI/Row',
  component: Row,
}
export default meta
type Story = StoryObj<typeof Row>

const Box = ({ children }: { children: React.ReactNode }): JSX.Element => (
  <div className="bg-n-50 border border-n-200 rounded px-3 py-2">{children}</div>
)

export const Default: Story = {
  render: () => (
    <Row>
      <Box>A</Box>
      <Box>B</Box>
      <Box>C</Box>
    </Row>
  ),
}

export const Between: Story = {
  render: () => (
    <Row justify="between">
      <Box>Left</Box>
      <Box>Right</Box>
    </Row>
  ),
}

export const Wrap: Story = {
  render: () => (
    <Row wrap gap={2}>
      {Array.from({ length: 12 }).map((_, i) => (
        <Box key={i}>Item {i + 1}</Box>
      ))}
    </Row>
  ),
}
