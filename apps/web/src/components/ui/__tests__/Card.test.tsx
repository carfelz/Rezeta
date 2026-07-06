import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Card, CardTitle, CardSubtitle } from '../Card'

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

