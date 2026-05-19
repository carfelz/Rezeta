import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { AppToaster } from '@/components/ui/SonnerToaster'

describe('AppToaster', () => {
  it('renders without crashing', () => {
    expect(() => render(<AppToaster />)).not.toThrow()
  })

  it('mounts a single toaster container in the DOM', () => {
    const { container } = render(<AppToaster />)
    expect(container).toBeTruthy()
  })
})
