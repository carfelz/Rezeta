import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  Modal,
  ModalTrigger,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalClose,
} from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

function renderModal(open?: boolean, onOpenChange?: (v: boolean) => void) {
  return render(
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalTrigger asChild>
        <Button id="open-btn">Abrir Modal</Button>
      </ModalTrigger>
      <ModalContent>
        <ModalHeader
          title="Test Modal"
          subtitle="This is a subtitle"
          id-for-test="modal-header"
        />
        <ModalBody>
          <p>Modal body content</p>
        </ModalBody>
        <ModalFooter>
          <ModalClose asChild>
            <Button id="close-btn">Cancelar</Button>
          </ModalClose>
          <Button id="confirm-btn">Confirmar</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>,
  )
}

describe('Modal', () => {
  it('does not render content when closed (no open prop)', () => {
    renderModal()
    // Content is in a portal, with no `open` prop the dialog starts closed
    expect(screen.queryByText('Test Modal')).not.toBeInTheDocument()
  })

  it('renders content when open=true', () => {
    renderModal(true)
    expect(screen.getByText('Test Modal')).toBeInTheDocument()
    expect(screen.getByText('This is a subtitle')).toBeInTheDocument()
    expect(screen.getByText('Modal body content')).toBeInTheDocument()
  })

  it('renders trigger button', () => {
    renderModal()
    expect(screen.getByRole('button', { name: 'Abrir Modal' })).toBeInTheDocument()
  })

  it('opens on trigger click (uncontrolled)', async () => {
    const user = userEvent.setup()
    render(
      <Modal>
        <ModalTrigger asChild>
          <Button id="trigger">Open</Button>
        </ModalTrigger>
        <ModalContent>
          <ModalHeader title="Opened!" />
          <ModalBody>Content here</ModalBody>
        </ModalContent>
      </Modal>,
    )
    await user.click(screen.getByRole('button', { name: 'Open' }))
    expect(screen.getByText('Opened!')).toBeInTheDocument()
  })

  it('renders footer with close and confirm buttons when open', () => {
    renderModal(true)
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeInTheDocument()
  })

  it('calls onOpenChange when opened (controlled)', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(
      <Modal open={false} onOpenChange={onOpenChange}>
        <ModalTrigger asChild>
          <Button id="ctrl-trigger">Open Controlled</Button>
        </ModalTrigger>
        <ModalContent>
          <ModalHeader title="Controlled" />
          <ModalBody>Body</ModalBody>
        </ModalContent>
      </Modal>,
    )
    await user.click(screen.getByRole('button', { name: 'Open Controlled' }))
    expect(onOpenChange).toHaveBeenCalledWith(true)
  })

  it('ModalHeader renders icon when provided', () => {
    render(
      <Modal open>
        <ModalContent>
          <ModalHeader title="With Icon" icon={<span data-testid="icon">★</span>} />
          <ModalBody>body</ModalBody>
        </ModalContent>
      </Modal>,
    )
    expect(screen.getByTestId('icon')).toBeInTheDocument()
  })

  it('ModalHeader hides close button when showClose=false', () => {
    render(
      <Modal open>
        <ModalContent>
          <ModalHeader title="No Close" showClose={false} />
          <ModalBody>body</ModalBody>
        </ModalContent>
      </Modal>,
    )
    expect(screen.queryByText('Cerrar')).not.toBeInTheDocument()
  })
})
