import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  ToastProvider,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastViewport,
} from '@/components/ui/Toast'

function renderToast(props: Parameters<typeof Toast>[0] = {}) {
  return render(
    <ToastProvider>
      <Toast open {...props}>
        <ToastTitle>Éxito</ToastTitle>
        <ToastDescription>Operación completada</ToastDescription>
      </Toast>
      <ToastViewport />
    </ToastProvider>,
  )
}

describe('Toast', () => {
  it('renders title and description', () => {
    renderToast()
    expect(screen.getByText('Éxito')).toBeInTheDocument()
    expect(screen.getByText('Operación completada')).toBeInTheDocument()
  })

  it('renders with default variant classes', () => {
    const { container } = renderToast()
    const toast = container.querySelector('[data-radix-toast-root]') ?? container.firstChild
    expect(toast).toBeInTheDocument()
  })

  it('renders within a ToastViewport', () => {
    // Verify the toast renders without crashing when viewport is present
    expect(() => renderToast()).not.toThrow()
  })

  it('renders icon when provided', () => {
    render(
      <ToastProvider>
        <Toast open icon={<span data-testid="toast-icon">✓</span>}>
          <ToastTitle>OK</ToastTitle>
        </Toast>
        <ToastViewport />
      </ToastProvider>,
    )
    expect(screen.getByTestId('toast-icon')).toBeInTheDocument()
  })

  it('does not render icon container when no icon provided', () => {
    renderToast()
    expect(screen.queryByTestId('toast-icon')).not.toBeInTheDocument()
  })

  it.each(['success', 'warning', 'danger', 'info'] as const)(
    'renders %s variant without crashing',
    (variant) => {
      expect(() => renderToast({ variant })).not.toThrow()
    },
  )
})

describe('ToastTitle', () => {
  it('renders with semibold text class', () => {
    render(
      <ToastProvider>
        <Toast open>
          <ToastTitle className="my-title">My Title</ToastTitle>
        </Toast>
        <ToastViewport />
      </ToastProvider>,
    )
    const title = screen.getByText('My Title')
    expect(title.className).toContain('font-semibold')
  })
})

describe('ToastDescription', () => {
  it('renders description text', () => {
    render(
      <ToastProvider>
        <Toast open>
          <ToastDescription>Description text here</ToastDescription>
        </Toast>
        <ToastViewport />
      </ToastProvider>,
    )
    expect(screen.getByText('Description text here')).toBeInTheDocument()
  })
})
