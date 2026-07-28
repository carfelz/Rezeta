import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StaffSecurityOverviewDto } from '@rezeta/shared'

const h = vi.hoisted(() => ({
  useStaffSecurityOverview: vi.fn(),
}))

vi.mock('@/hooks/staff/use-staff-security', () => ({
  useStaffSecurityOverview: h.useStaffSecurityOverview,
}))

import { Security } from '../Security'

const overview: StaffSecurityOverviewDto = {
  tiles: { activeInstitutions: 2, activeUsers30d: 42, logins7d: 120, dormantAccounts60d: 3, mfaAdoptionPct: 62 },
  institutions: [
    {
      tenantId: 't1',
      name: 'Centro Médico Vista Alegre',
      plan: 'clinic',
      mau30d: 26,
      logins14d: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
      dormant30d: 0,
      pendingInvites: 0,
    },
    {
      tenantId: 't2',
      name: null,
      plan: 'solo',
      mau30d: 7,
      logins14d: new Array(14).fill(0),
      dormant30d: 2,
      pendingInvites: 1,
    },
  ],
}

describe('Security (staff)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the page title and stat tiles', () => {
    h.useStaffSecurityOverview.mockReturnValue({ data: overview, isLoading: false, isError: false })
    render(<Security />)
    expect(screen.getByText('Security')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('120')).toBeInTheDocument()
  })

  it('renders one sparkline bar per logins14d entry, per institution row', () => {
    h.useStaffSecurityOverview.mockReturnValue({ data: overview, isLoading: false, isError: false })
    const { container } = render(<Security />)
    const rows = container.querySelectorAll('tbody tr')
    expect(rows).toHaveLength(2)
    expect(rows[0]?.querySelectorAll('[data-testid="sparkline-bar"]')).toHaveLength(14)
  })

  it('shows the unnamed-institution fallback and signal chips', () => {
    h.useStaffSecurityOverview.mockReturnValue({ data: overview, isLoading: false, isError: false })
    render(<Security />)
    expect(screen.getByText('Unnamed institution')).toBeInTheDocument()
    expect(screen.getByText('2 dormant')).toBeInTheDocument()
    expect(screen.getByText('1 pending invites')).toBeInTheDocument()
  })

  it('shows the dormant callout when dormantAccounts60d is greater than zero', () => {
    h.useStaffSecurityOverview.mockReturnValue({ data: overview, isLoading: false, isError: false })
    render(<Security />)
    expect(screen.getByText('3 accounts with no access in 60 days')).toBeInTheDocument()
  })

  it('hides the dormant callout when dormantAccounts60d is zero', () => {
    h.useStaffSecurityOverview.mockReturnValue({
      data: { ...overview, tiles: { ...overview.tiles, dormantAccounts60d: 0 } },
      isLoading: false,
      isError: false,
    })
    render(<Security />)
    expect(screen.queryByText(/accounts with no access/)).not.toBeInTheDocument()
  })

  it('shows the empty state when there are no institutions', () => {
    h.useStaffSecurityOverview.mockReturnValue({
      data: { ...overview, institutions: [] },
      isLoading: false,
      isError: false,
    })
    render(<Security />)
    expect(screen.getByText('No institutions yet')).toBeInTheDocument()
  })

  it('shows a spinner while loading', () => {
    h.useStaffSecurityOverview.mockReturnValue({ data: undefined, isLoading: true, isError: false })
    render(<Security />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows a danger callout on load error', () => {
    h.useStaffSecurityOverview.mockReturnValue({ data: undefined, isLoading: false, isError: true })
    render(<Security />)
    expect(screen.getByText('Could not load the security overview.')).toBeInTheDocument()
  })

  it('renders the MFA adoption tile, formatted as a percent', () => {
    h.useStaffSecurityOverview.mockReturnValue({ data: overview, isLoading: false, isError: false })
    render(<Security />)
    expect(screen.getByText('MFA adoption')).toBeInTheDocument()
    expect(screen.getByText('62%')).toBeInTheDocument()
  })

  it('renders an em dash for a null MFA adoption percent (zero active users)', () => {
    h.useStaffSecurityOverview.mockReturnValue({
      data: { ...overview, tiles: { ...overview.tiles, mfaAdoptionPct: null } },
      isLoading: false,
      isError: false,
    })
    render(<Security />)
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThan(0)
  })
})
