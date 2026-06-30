import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query'
import type { ProtocolTemplateDto, ProtocolResponse } from '@rezeta/shared'
import { TemplatePickerModal } from '../TemplatePickerModal'

vi.mock('@/hooks/protocol-templates/use-protocol-templates', () => ({
  useProtocolTemplates: vi.fn(),
}))

vi.mock('@/hooks/protocols/use-protocols', () => ({
  useProtocols: vi.fn(),
}))

vi.mock('react-router-dom', () => ({
  MemoryRouter: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>) =>
    React.createElement('a', { ...props, href: to }, children),
  useNavigate: () => vi.fn(),
}))

import { useProtocolTemplates } from '@/hooks/protocol-templates/use-protocol-templates'
import { useProtocols } from '@/hooks/protocols/use-protocols'

function makeTemplate(overrides: Partial<ProtocolTemplateDto> = {}): ProtocolTemplateDto {
  return {
    id: 'tmpl-1',
    tenantId: 'tenant-1',
    name: 'Manejo de anafilaxia',
    description: null,
    categoryId: 'cat-1',
    category: { id: 'cat-1', name: 'Emergencias', color: '#EF4444' },
    schema: { version: '1.0', blocks: [] },
    isSeeded: false,
    isLocked: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeTemplatesQuery(
  templates: ProtocolTemplateDto[],
  isLoading = false,
): UseQueryResult<ProtocolTemplateDto[], Error> {
  return {
    data: templates,
    isLoading,
    isError: false,
    error: null,
  } as unknown as UseQueryResult<ProtocolTemplateDto[], Error>
}

function makeMutation(mutate = vi.fn(), isPending = false) {
  return {
    mutate,
    isPending,
    isSuccess: false,
    isError: false,
    error: null,
    data: undefined,
    reset: vi.fn(),
  } as unknown as UseMutationResult<ProtocolResponse, Error, { templateId: string; title: string }>
}

function setup(
  templates: ProtocolTemplateDto[] = [makeTemplate()],
  options: { isPending?: boolean; mutateFn?: ReturnType<typeof vi.fn>; isLoading?: boolean } = {},
) {
  const { isPending = false, mutateFn = vi.fn(), isLoading = false } = options
  const mutation = makeMutation(mutateFn, isPending)

  vi.mocked(useProtocolTemplates).mockReturnValue(makeTemplatesQuery(templates, isLoading))
  vi.mocked(useProtocols).mockReturnValue({
    useCreateProtocol: () => mutation,
  } as unknown as ReturnType<typeof useProtocols>)

  render(
    <MemoryRouter>
      <TemplatePickerModal isOpen onClose={vi.fn()} />
    </MemoryRouter>,
  )

  return { mutateFn, mutation }
}

describe('TemplatePickerModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders a card for each template showing template name and category name', () => {
    const templates = [
      makeTemplate({ id: 'tmpl-1', name: 'Protocolo A', category: { id: 'c1', name: 'Urgencias', color: '#FF0000' } }),
      makeTemplate({ id: 'tmpl-2', name: 'Protocolo B', category: { id: 'c2', name: 'Cardiología', color: '#0000FF' } }),
    ]
    setup(templates)
    expect(screen.getByText('Protocolo A')).toBeInTheDocument()
    expect(screen.getByText('Protocolo B')).toBeInTheDocument()
    expect(screen.getByText('Urgencias')).toBeInTheDocument()
    expect(screen.getByText('Cardiología')).toBeInTheDocument()
  })

  it('does NOT render a "Desde cero" card', () => {
    setup()
    expect(screen.queryByText('Desde cero')).not.toBeInTheDocument()
  })

  it('submit button is disabled when no template selected', () => {
    setup()
    const submitBtn = screen.getByRole('button', { name: 'Crear protocolo' })
    expect(submitBtn).toBeDisabled()
  })

  it('submit button is disabled when template selected but title is too short', () => {
    setup()
    fireEvent.click(screen.getByText('Manejo de anafilaxia'))
    const input = screen.getByPlaceholderText('Ej. Manejo de anafilaxia')
    fireEvent.change(input, { target: { value: 'X' } })
    const submitBtn = screen.getByRole('button', { name: 'Crear protocolo' })
    expect(submitBtn).toBeDisabled()
  })

  it('submit is enabled after selecting a template and typing a valid title', () => {
    setup()
    fireEvent.click(screen.getByText('Manejo de anafilaxia'))
    const input = screen.getByPlaceholderText('Ej. Manejo de anafilaxia')
    fireEvent.change(input, { target: { value: 'Mi protocolo' } })
    const submitBtn = screen.getByRole('button', { name: 'Crear protocolo' })
    expect(submitBtn).not.toBeDisabled()
  })

  it('calls create mutation with { templateId, title } on submit', () => {
    const mutateFn = vi.fn()
    setup([makeTemplate({ id: 'tmpl-42' })], { mutateFn })
    fireEvent.click(screen.getByText('Manejo de anafilaxia'))
    const input = screen.getByPlaceholderText('Ej. Manejo de anafilaxia')
    fireEvent.change(input, { target: { value: 'Mi protocolo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear protocolo' }))
    expect(mutateFn).toHaveBeenCalledWith(
      { templateId: 'tmpl-42', title: 'Mi protocolo' },
      expect.any(Object),
    )
  })

  it('shows empty state with link to /ajustes/plantillas/new when no templates', () => {
    setup([])
    expect(screen.getByText('Aún no tienes plantillas. Crea una primero.')).toBeInTheDocument()
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/ajustes/plantillas/new')
  })

  it('does not show submit button in empty state', () => {
    setup([])
    expect(screen.queryByRole('button', { name: 'Crear protocolo' })).not.toBeInTheDocument()
  })
})
