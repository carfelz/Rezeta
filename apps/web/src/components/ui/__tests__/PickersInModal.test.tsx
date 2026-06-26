import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { DatePicker } from '../DatePicker'
import { TimePicker } from '../TimePicker'
import { Modal, ModalBody, ModalContent, ModalHeader } from '../Modal'

// Regression guard: a Radix Popover (DatePicker / TimePicker) nested inside a
// Radix Dialog (Modal) must open on click. This broke when @radix-ui/react-dialog
// and @radix-ui/react-popover resolved to different copies of the shared
// react-focus-scope / react-dismissable-layer packages: the modal's focus trap
// did not pause for the popover and dismissed it immediately. Keeping the Radix
// versions deduped is what makes this pass.
describe('pickers inside Modal', () => {
  function renderInModal(children: React.ReactNode): void {
    render(
      <Modal open={true} onOpenChange={() => {}}>
        <ModalContent>
          <ModalHeader title="Nueva cita" showClose={false} />
          <ModalBody>{children}</ModalBody>
        </ModalContent>
      </Modal>,
    )
  }

  it('opens the DatePicker calendar when clicked inside a modal', async () => {
    const user = userEvent.setup()
    renderInModal(<DatePicker value="2026-06-17" onChange={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /17 de junio de 2026/i }))
    expect(await screen.findByRole('grid')).toBeInTheDocument()
  })

  it('opens the TimePicker slot list when clicked inside a modal', async () => {
    const user = userEvent.setup()
    renderInModal(
      <TimePicker value="09:00" onChange={vi.fn()} intervalMin={30} minTime="09:00" maxTime="11:00" />,
    )
    await user.click(screen.getByRole('button', { name: /9:00 a\.m\./i }))
    expect(await screen.findByRole('button', { name: /10:00 a\.m\./i })).toBeInTheDocument()
  })
})
