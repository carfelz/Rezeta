import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Avatar } from '../Avatar'

describe('Avatar', () => {
  it('renders initials', () => {
    render(<Avatar initials="AR" />)
    expect(screen.getByText('AR')).toBeInTheDocument()
  })

  it('truncates initials to 2 characters', () => {
    render(<Avatar initials="ABC" />)
    expect(screen.getByText('AB')).toBeInTheDocument()
  })

  it('renders default size (36px)', () => {
    render(<Avatar initials="AB" />)
    const el = screen.getByText('AB')
    expect(el.className).toContain('w-9')
    expect(el.className).toContain('h-9')
  })

  it('renders sm size', () => {
    render(<Avatar initials="AB" size="sm" />)
    const el = screen.getByText('AB')
    expect(el.className).toContain('w-[30px]')
  })

  it('renders xs size', () => {
    render(<Avatar initials="AB" size="xs" />)
    const el = screen.getByText('AB')
    expect(el.className).toContain('w-7')
  })

  it('applies custom className', () => {
    render(<Avatar initials="AB" className="custom-class" />)
    const el = screen.getByText('AB')
    expect(el.className).toContain('custom-class')
  })

  it('has rounded-full styling', () => {
    render(<Avatar initials="CF" />)
    const el = screen.getByText('CF')
    expect(el.className).toContain('rounded-full')
  })
})
