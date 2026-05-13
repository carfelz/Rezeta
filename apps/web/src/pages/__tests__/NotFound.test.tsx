import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { NotFound } from '../NotFound'

function renderRouter(initialPath: string) {
  const router = createMemoryRouter(
    [
      { path: '/dashboard', element: <div>dashboard</div> },
      { path: '/throws', element: <Thrower /> },
      { path: '*', element: <NotFound />, errorElement: <NotFound /> },
    ],
    { initialEntries: [initialPath] },
  )
  return render(<RouterProvider router={router} />)
}

function Thrower(): JSX.Element {
  // React Router uses thrown Responses as the routing convention for HTTP-style errors.
  // eslint-disable-next-line @typescript-eslint/only-throw-error
  throw new Response('not found', { status: 404, statusText: 'Not Found' })
}

function ServerErrorThrower(): JSX.Element {
  // eslint-disable-next-line @typescript-eslint/only-throw-error
  throw new Response('boom', { status: 500, statusText: 'Server Error' })
}

describe('NotFound', () => {
  it('renders the 404 title and recovery CTAs for unmatched routes', () => {
    renderRouter('/this-route-does-not-exist')
    expect(screen.getByText('No encontramos esta página')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute(
      'href',
      '/dashboard',
    )
    expect(screen.getByRole('link', { name: 'Ir a pacientes' })).toHaveAttribute(
      'href',
      '/pacientes',
    )
  })

  it('does not surface the React Router developer error message', () => {
    renderRouter('/this-route-does-not-exist')
    expect(screen.queryByText(/Hey developer/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Unexpected Application Error/i)).not.toBeInTheDocument()
  })

  it('renders a generic error title when the route throws a 5xx response', () => {
    const router = createMemoryRouter(
      [
        {
          path: '/boom',
          element: <ServerErrorThrower />,
          errorElement: <NotFound />,
        },
      ],
      { initialEntries: ['/boom'] },
    )
    render(<RouterProvider router={router} />)
    expect(screen.getByText('Algo salió mal')).toBeInTheDocument()
  })
})
