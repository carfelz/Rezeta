import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ProtocolTemplateDto } from '@rezeta/shared'

const mocks = vi.hoisted(() => ({
  useProtocolCategories: vi.fn(),
  useProtocolTemplate: vi.fn(),
  useCreateProtocolTemplate: vi.fn(),
  useUpdateProtocolTemplate: vi.fn(),
  createMutateAsync: vi.fn(),
  updateMutateAsync: vi.fn(),
  navigate: vi.fn(),
  useParams: vi.fn(),
}))

vi.mock('@/hooks/protocol-categories/use-protocol-categories', () => ({
  useProtocolCategories: mocks.useProtocolCategories,
}))
vi.mock('@/hooks/protocol-templates/use-protocol-templates', () => ({
  useProtocolTemplate: mocks.useProtocolTemplate,
  useCreateProtocolTemplate: mocks.useCreateProtocolTemplate,
  useUpdateProtocolTemplate: mocks.useUpdateProtocolTemplate,
}))
vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  useParams: mocks.useParams,
}))

import { TemplateEditorNew, TemplateEditor } from '../TemplateEditor'

const categories = [
  { id: 'cat-1', tenantId: 'tenant-1', name: 'Emergencias', color: '#EF4444', isSeeded: false, deletedAt: null },
  { id: 'cat-2', tenantId: 'tenant-1', name: 'Consulta', color: '#3B82F6', isSeeded: false, deletedAt: null },
]

const makeTemplateDto = (overrides: Partial<ProtocolTemplateDto> = {}): ProtocolTemplateDto => ({
  id: 'tmpl-1',
  tenantId: 'tenant-1',
  name: 'Mi plantilla',
  description: null,
  suggestedSpecialty: null,
  categoryId: 'cat-1',
  category: { id: 'cat-1', name: 'Emergencias', color: '#EF4444' },
  schema: { version: '1.0', blocks: [] },
  isSeeded: false,
  isLocked: false,
  createdAt: '2026-06-29T00:00:00.000Z',
  updatedAt: '2026-06-29T00:00:00.000Z',
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.useProtocolCategories.mockReturnValue({ data: categories, isLoading: false, isError: false })
  mocks.createMutateAsync.mockResolvedValue(makeTemplateDto())
  mocks.updateMutateAsync.mockResolvedValue(makeTemplateDto())
  mocks.useCreateProtocolTemplate.mockReturnValue({
    mutateAsync: mocks.createMutateAsync,
    isPending: false,
  })
  mocks.useUpdateProtocolTemplate.mockReturnValue({
    mutateAsync: mocks.updateMutateAsync,
    isPending: false,
  })
  mocks.useParams.mockReturnValue({ id: 'tmpl-1' })
  mocks.useProtocolTemplate.mockReturnValue({
    data: makeTemplateDto(),
    isLoading: false,
    isError: false,
  })
})

describe('TemplateEditorNew — category select', () => {
  it('renders the category select with options from useProtocolCategories', () => {
    render(<TemplateEditorNew />)
    const select = screen.getByRole('combobox', { name: /Categoría/i })
    expect(select).toBeInTheDocument()
    expect(screen.getByText('Emergencias')).toBeInTheDocument()
    expect(screen.getByText('Consulta')).toBeInTheDocument()
  })

  it('save button is disabled when no category is selected', () => {
    render(<TemplateEditorNew />)
    // Fill the name field so the only remaining constraint is category
    const nameInput = screen.getByPlaceholderText(/Intervención de emergencia/i)
    fireEvent.change(nameInput, { target: { value: 'Mi plantilla test' } })
    const saveBtn = screen.getByRole('button', { name: /Guardar/i })
    expect(saveBtn).toBeDisabled()
  })

  it('save button is enabled once a category is selected and name is filled', () => {
    render(<TemplateEditorNew />)
    const nameInput = screen.getByPlaceholderText(/Intervención de emergencia/i)
    fireEvent.change(nameInput, { target: { value: 'Mi plantilla test' } })
    const select = screen.getByRole('combobox', { name: /Categoría/i })
    fireEvent.change(select, { target: { value: 'cat-1' } })
    const saveBtn = screen.getByRole('button', { name: /Guardar/i })
    expect(saveBtn).not.toBeDisabled()
  })

  it('includes categoryId in the create mutation payload', async () => {
    render(<TemplateEditorNew />)
    const nameInput = screen.getByPlaceholderText(/Intervención de emergencia/i)
    fireEvent.change(nameInput, { target: { value: 'Test Template' } })
    const select = screen.getByRole('combobox', { name: /Categoría/i })
    fireEvent.change(select, { target: { value: 'cat-2' } })
    const saveBtn = screen.getByRole('button', { name: /Guardar/i })
    fireEvent.click(saveBtn)
    await vi.waitFor(() => {
      expect(mocks.createMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ categoryId: 'cat-2' }),
      )
    })
  })
})

describe('TemplateEditor (edit mode) — category select', () => {
  it('renders the category select prefilled with the template category', () => {
    render(<TemplateEditor />)
    const select = screen.getByRole('combobox', { name: /Categoría/i })
    expect(select).toBeInTheDocument()
    // The template has categoryId 'cat-1' which should be pre-selected
    expect((select as HTMLSelectElement).value).toBe('cat-1')
  })

  it('renders category options from useProtocolCategories', () => {
    render(<TemplateEditor />)
    expect(screen.getByText('Emergencias')).toBeInTheDocument()
    expect(screen.getByText('Consulta')).toBeInTheDocument()
  })
})
