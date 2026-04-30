import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'

function renderTabs(defaultValue = 'tab1') {
  return render(
    <Tabs defaultValue={defaultValue}>
      <TabsList>
        <TabsTrigger value="tab1" id="trigger-tab1">Tab Uno</TabsTrigger>
        <TabsTrigger value="tab2" id="trigger-tab2">Tab Dos</TabsTrigger>
        <TabsTrigger value="disabled" disabled id="trigger-disabled">Disabled</TabsTrigger>
      </TabsList>
      <TabsContent value="tab1" id="content-tab1">Content One</TabsContent>
      <TabsContent value="tab2" id="content-tab2">Content Two</TabsContent>
      <TabsContent value="disabled">Disabled content</TabsContent>
    </Tabs>,
  )
}

describe('Tabs', () => {
  it('renders all tab triggers', () => {
    renderTabs()
    expect(screen.getByText('Tab Uno')).toBeInTheDocument()
    expect(screen.getByText('Tab Dos')).toBeInTheDocument()
  })

  it('renders active tab content by default', () => {
    renderTabs('tab1')
    expect(screen.getByText('Content One')).toBeInTheDocument()
  })

  it('tab2 content is in the DOM when starting on tab2', () => {
    renderTabs('tab2')
    // Content Two should be visible when tab2 is active
    expect(screen.getByText('Content Two')).toBeInTheDocument()
  })

  it('active tab trigger has data-state=active', () => {
    renderTabs('tab1')
    const trigger = screen.getByRole('tab', { name: 'Tab Uno' })
    expect(trigger).toHaveAttribute('data-state', 'active')
  })

  it('inactive tab trigger has data-state=inactive', () => {
    renderTabs('tab1')
    const trigger = screen.getByRole('tab', { name: 'Tab Dos' })
    expect(trigger).toHaveAttribute('data-state', 'inactive')
  })

  it('disabled trigger is disabled', () => {
    renderTabs()
    const disabled = screen.getByRole('tab', { name: 'Disabled' })
    expect(disabled).toBeDisabled()
  })

  it('TabsList renders with border-b class', () => {
    renderTabs()
    const list = screen.getByRole('tablist')
    expect(list.className).toContain('border-b')
  })
})
