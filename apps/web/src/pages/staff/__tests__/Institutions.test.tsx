import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Institutions } from '../Institutions'

const h = vi.hoisted(() => ({
  useStaffInstitutions: vi.fn(),
}))

vi.mock('@/hooks/staff/use-institutions', () => ({
  useStaffInstitutions: h.useStaffInstitutions,
}))

const rows = [
  {
    id: 't1',
    name: 'Centro Vista Alegre',
    type: 'clinic',
    plan: 'clinic',
    createdAt: '2026-07-28T12:00:00.000Z',
    userCount: 5,
    activeUserCount: 4,
  },
  {
    id: 't2',
    name: null,
    type: 'solo',
    plan: 'free',
    createdAt: '2026-07-01T12:00:00.000Z',
    userCount: 0,
    activeUserCount: 0,
  },
]

function renderPage(): void {
  render(
    <MemoryRouter>
      <Institutions />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  h.useStaffInstitutions.mockReturnValue({ data: rows, isLoading: false, isError: false })
})

describe('Institutions', () => {
  it('renders the roster with both rows and derived users count', () => {
    renderPage()
    expect(screen.getByText('Institutions')).toBeInTheDocument()
    expect(screen.getByText('Centro Vista Alegre')).toBeInTheDocument()
    expect(screen.getByText('4 of 5')).toBeInTheDocument()
    expect(screen.getByText('Unnamed institution')).toBeInTheDocument()
  })

  it('renders the New institution action as a link to the create route', () => {
    renderPage()
    const link = screen.getByRole('link', { name: 'New institution' })
    expect(link).toHaveAttribute('href', '/staff/institutions/new')
  })

  it('renders the empty state when there are no institutions', () => {
    h.useStaffInstitutions.mockReturnValue({ data: [], isLoading: false, isError: false })
    renderPage()
    expect(screen.getByText('No institutions yet')).toBeInTheDocument()
  })

  it('renders a danger callout on load error', () => {
    h.useStaffInstitutions.mockReturnValue({ data: undefined, isLoading: false, isError: true })
    renderPage()
    expect(screen.getByText('Could not load institutions.')).toBeInTheDocument()
  })
})
