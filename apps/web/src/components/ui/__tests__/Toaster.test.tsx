import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(),
}))

import { useToast } from '@/hooks/use-toast'
import { Toaster } from '../Toaster'

const mockUseToast = useToast as ReturnType<typeof vi.fn>

describe('Toaster', () => {
  it('renders without toasts', () => {
    mockUseToast.mockReturnValue({ toasts: [] })
    const { container } = render(<Toaster />)
    expect(container).toBeInTheDocument()
  })

  it('renders a toast with title and description', () => {
    mockUseToast.mockReturnValue({
      toasts: [{ id: '1', title: 'Hello', description: 'World', open: true, variant: 'success' }],
    })
    render(<Toaster />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(screen.getByText('World')).toBeInTheDocument()
  })

  it('renders a toast with only title', () => {
    mockUseToast.mockReturnValue({
      toasts: [{ id: '2', title: 'Only title', open: true }],
    })
    render(<Toaster />)
    expect(screen.getByText('Only title')).toBeInTheDocument()
  })

  it('renders a toast with only description', () => {
    mockUseToast.mockReturnValue({
      toasts: [{ id: '3', description: 'Only desc', open: true }],
    })
    render(<Toaster />)
    expect(screen.getByText('Only desc')).toBeInTheDocument()
  })

  it('renders multiple toasts', () => {
    mockUseToast.mockReturnValue({
      toasts: [
        { id: '1', title: 'First', open: true },
        { id: '2', title: 'Second', open: true },
      ],
    })
    render(<Toaster />)
    expect(screen.getByText('First')).toBeInTheDocument()
    expect(screen.getByText('Second')).toBeInTheDocument()
  })
})
