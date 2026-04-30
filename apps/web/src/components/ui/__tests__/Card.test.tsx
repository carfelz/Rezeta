import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Card, CardTitle, CardSubtitle, CardItem } from '../Card'

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Card content</Card>)
    expect(screen.getByText('Card content')).toBeInTheDocument()
  })

  it('applies default border when not selected', () => {
    const { container } = render(<Card>Content</Card>)
    expect(container.firstChild).toHaveClass('border-n-200')
  })

  it('applies selected border when selected prop is true', () => {
    const { container } = render(<Card selected>Content</Card>)
    expect(container.firstChild).toHaveClass('border-p-500')
  })

  it('applies custom className', () => {
    const { container } = render(<Card className="custom">Content</Card>)
    expect(container.firstChild).toHaveClass('custom')
  })
})

describe('CardTitle', () => {
  it('renders title text', () => {
    render(<CardTitle>My Title</CardTitle>)
    expect(screen.getByText('My Title')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<CardTitle className="custom">Title</CardTitle>)
    expect(screen.getByText('Title').className).toContain('custom')
  })
})

describe('CardSubtitle', () => {
  it('renders subtitle text', () => {
    render(<CardSubtitle>Subtitle</CardSubtitle>)
    expect(screen.getByText('Subtitle')).toBeInTheDocument()
  })

  it('applies muted text style', () => {
    render(<CardSubtitle>Subtitle</CardSubtitle>)
    expect(screen.getByText('Subtitle').className).toContain('text-n-500')
  })
})

describe('CardItem', () => {
  it('renders name', () => {
    render(<CardItem name="Ana García" />)
    expect(screen.getByText('Ana García')).toBeInTheDocument()
  })

  it('renders meta when provided', () => {
    render(<CardItem name="Ana García" meta="Cédula · 001-234" />)
    expect(screen.getByText('Cédula · 001-234')).toBeInTheDocument()
  })

  it('renders leading element', () => {
    render(<CardItem name="Ana" leading={<span data-testid="avatar">AV</span>} />)
    expect(screen.getByTestId('avatar')).toBeInTheDocument()
  })

  it('renders trailing element', () => {
    render(<CardItem name="Ana" trailing={<span data-testid="badge">Active</span>} />)
    expect(screen.getByTestId('badge')).toBeInTheDocument()
  })

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<CardItem name="Clickable" onClick={onClick} />)
    await user.click(screen.getByText('Clickable'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('has button role when onClick provided', () => {
    render(<CardItem name="Clickable" onClick={vi.fn()} />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('has no role when onClick not provided', () => {
    render(<CardItem name="Static" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
