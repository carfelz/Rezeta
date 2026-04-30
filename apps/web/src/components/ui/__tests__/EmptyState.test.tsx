import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { EmptyState } from '../EmptyState'

describe('EmptyState', () => {
  it('renders title', () => {
    render(<EmptyState icon={<span>📂</span>} title="No patients" />)
    expect(screen.getByText('No patients')).toBeInTheDocument()
  })

  it('renders icon', () => {
    render(<EmptyState icon={<span data-testid="icon">📂</span>} title="Empty" />)
    expect(screen.getByTestId('icon')).toBeInTheDocument()
  })

  it('renders description when provided', () => {
    render(
      <EmptyState
        icon={<span>📂</span>}
        title="No patients"
        description="Register your first patient."
      />,
    )
    expect(screen.getByText('Register your first patient.')).toBeInTheDocument()
  })

  it('does not render description when not provided', () => {
    render(<EmptyState icon={<span>📂</span>} title="Empty" />)
    expect(screen.queryByText(/register/i)).not.toBeInTheDocument()
  })

  it('renders action when description is provided', () => {
    render(
      <EmptyState
        icon={<span>📂</span>}
        title="Empty"
        description="Some description"
        action={<button>Add</button>}
      />,
    )
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument()
  })

  it('renders action with margin when description is absent', () => {
    render(
      <EmptyState
        icon={<span>📂</span>}
        title="Empty"
        action={<button>Add</button>}
      />,
    )
    const actionWrapper = screen.getByRole('button', { name: 'Add' }).parentElement
    expect(actionWrapper?.className).toContain('mt-5')
  })

  it('applies custom className to container', () => {
    const { container } = render(
      <EmptyState icon={<span>📂</span>} title="Empty" className="custom-class" />,
    )
    expect(container.firstChild).toHaveClass('custom-class')
  })
})
