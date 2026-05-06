import type { Meta, StoryObj } from '@storybook/react-vite'
import { Stack } from './Stack'

const meta: Meta<typeof Stack> = {
  title: 'UI/Stack',
  component: Stack,
}
export default meta
type Story = StoryObj<typeof Stack>

const Box = ({ children }: { children: React.ReactNode }): JSX.Element => (
  <div className="bg-n-50 border border-n-200 rounded p-3">{children}</div>
)

export const Default: Story = {
  render: () => (
    <Stack>
      <Box>Item 1</Box>
      <Box>Item 2</Box>
      <Box>Item 3</Box>
    </Stack>
  ),
}

export const TightGap: Story = {
  render: () => (
    <Stack gap={1}>
      <Box>Item 1</Box>
      <Box>Item 2</Box>
      <Box>Item 3</Box>
    </Stack>
  ),
}

export const LargeGap: Story = {
  render: () => (
    <Stack gap={6}>
      <Box>Item 1</Box>
      <Box>Item 2</Box>
    </Stack>
  ),
}
