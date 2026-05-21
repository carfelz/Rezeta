import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ErrorBoundary } from '../ErrorBoundary'

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

import { logger } from '@/lib/logger'

const mockLogger = logger as { error: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> }

function Bomb(): JSX.Element {
  throw new Error('Test render error')
}

function BombNoStack(): JSX.Element {
  const err = new Error('No stack error')
  delete (err as { stack?: string }).stack
  throw err
}

const originalConsoleError = console.error
beforeEach(() => {
  console.error = vi.fn()
  vi.clearAllMocks()
})

afterEach(() => {
  console.error = originalConsoleError
})

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <div>All good</div>
      </ErrorBoundary>,
    )
    expect(screen.getByText('All good')).toBeInTheDocument()
  })

  it('renders fallback UI when child throws', () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Algo salió mal')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Recargar' })).toBeInTheDocument()
  })

  it('calls logger.error with error details', () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    )
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Test render error',
      expect.objectContaining({ context: 'ErrorBoundary' }),
    )
  })

  it('logs without stack when error.stack is undefined', () => {
    render(
      <ErrorBoundary>
        <BombNoStack />
      </ErrorBoundary>,
    )
    expect(mockLogger.error).toHaveBeenCalledWith(
      'No stack error',
      expect.objectContaining({ context: 'ErrorBoundary' }),
    )
  })

  it('reload button calls window.location.reload', () => {
    const reload = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { ...window.location, reload },
    })

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Recargar' }))
    expect(reload).toHaveBeenCalled()
  })
})
