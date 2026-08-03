import { describe, it, expect } from 'vitest'
import { MemoryRouter, useRoutes, Outlet } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import { isStaffHostname, staffHostRootRoutes } from '../staff-host'

describe('isStaffHostname', () => {
  it('matches the dev staff subdomain', () => {
    expect(isStaffHostname('staff-dev.rezeta.co')).toBe(true)
  })

  it('matches the future production staff subdomain', () => {
    expect(isStaffHostname('staff.rezeta.co')).toBe(true)
  })

  it('does not match the main app hosts', () => {
    expect(isStaffHostname('app-dev.rezeta.co')).toBe(false)
    expect(isStaffHostname('app.rezeta.co')).toBe(false)
    expect(isStaffHostname('localhost')).toBe(false)
    expect(isStaffHostname('medical-erp-dev.web.app')).toBe(false)
  })

  it('does not match hosts that merely contain "staff"', () => {
    expect(isStaffHostname('mystaff.rezeta.co')).toBe(false)
    expect(isStaffHostname('staffing.example.com')).toBe(false)
  })
})

// Mirrors the App.tsx structure the staff routes must beat: a pathless layout
// whose index route redirects '/' — the layout's index carries React Router's
// index bonus, so this guards the ranking assumption, not just the redirect.
function TestRoutes({ hostname }: { hostname: string }) {
  return useRoutes([
    ...staffHostRootRoutes(hostname),
    {
      element: (
        <div>
          <Outlet />
        </div>
      ),
      children: [
        { index: true, element: <div>doctor app</div> },
        { path: 'dashboard', element: <div>dashboard</div> },
      ],
    },
    { path: '/staff/institutions', element: <div>staff console</div> },
  ])
}

describe('staffHostRootRoutes', () => {
  it('returns no routes for non-staff hosts', () => {
    expect(staffHostRootRoutes('app-dev.rezeta.co')).toEqual([])
    expect(staffHostRootRoutes('localhost')).toEqual([])
  })

  it('redirects / to the staff console on staff hosts', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <TestRoutes hostname="staff-dev.rezeta.co" />
      </MemoryRouter>,
    )
    expect(screen.getByText('staff console')).toBeInTheDocument()
    expect(screen.queryByText('doctor app')).not.toBeInTheDocument()
  })

  it('leaves / on the doctor app for non-staff hosts', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <TestRoutes hostname="app-dev.rezeta.co" />
      </MemoryRouter>,
    )
    expect(screen.getByText('doctor app')).toBeInTheDocument()
  })
})
