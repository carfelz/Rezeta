import { describe, it, expect } from 'vitest'
import { MemoryRouter, useRoutes, Outlet } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import { belongsToHostApp, isStaffHostname, staffHostRootRoutes } from '../staff-host'

describe('belongsToHostApp', () => {
  it('rejects doctor-app destinations on a staff host', () => {
    // AuthGate plants ?redirectTo=/dashboard when it bounces staff, and
    // honouring it sends them straight back into the loop.
    expect(belongsToHostApp('staff-dev.rezeta.co', '/dashboard')).toBe(false)
    expect(belongsToHostApp('staff-dev.rezeta.co', '/agenda')).toBe(false)
  })

  it('accepts staff destinations on a staff host', () => {
    expect(belongsToHostApp('staff-dev.rezeta.co', '/staff')).toBe(true)
    expect(belongsToHostApp('staff-dev.rezeta.co', '/staff/security')).toBe(true)
  })

  it('rejects staff destinations on a doctor host', () => {
    expect(belongsToHostApp('app-dev.rezeta.co', '/staff/institutions')).toBe(false)
  })

  it('accepts doctor destinations on a doctor host', () => {
    expect(belongsToHostApp('app-dev.rezeta.co', '/dashboard')).toBe(true)
    expect(belongsToHostApp('localhost', '/dashboard')).toBe(true)
  })

  it('does not treat a lookalike prefix as the staff app', () => {
    expect(belongsToHostApp('staff-dev.rezeta.co', '/staffing')).toBe(false)
  })
})

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
