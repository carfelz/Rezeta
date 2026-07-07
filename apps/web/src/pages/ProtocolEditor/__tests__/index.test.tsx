import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'
import type { ProtocolResponse } from '@rezeta/shared'
import { ProtocolEditor } from '../index'
import { useProtocols } from '@/hooks/protocols/use-protocols'

vi.mock('@/hooks/protocols/use-protocols', () => ({
  useProtocols: vi.fn(),
}))

const protocol: ProtocolResponse = {
  id: 'proto-1',
  title: 'Manejo de anafilaxia',
  status: 'active',
  isFavorite: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  categoryId: 'cat-1',
  categoryName: 'Emergencias',
  templateSchema: { version: '1.0', blocks: [] },
  currentVersion: {
    id: 'ver-1',
    versionNumber: 1,
    changeSummary: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    content: {
      version: '1.0',
      template_version: '1.0',
      blocks: [{ id: 'b1', type: 'clinical_notes', label: 'Motivo de consulta', content: '' }],
    },
  },
} as unknown as ProtocolResponse

function makeQuery<T>(data: T): UseQueryResult<T> {
  return { data, isLoading: false, isError: false, error: null } as unknown as UseQueryResult<T>
}

function makeMutation<T, V>(mutate: ReturnType<typeof vi.fn>): UseMutationResult<T, Error, V> {
  return {
    mutate,
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null,
    data: undefined,
    reset: vi.fn(),
  } as unknown as UseMutationResult<T, Error, V>
}

function setup(saveVersion = vi.fn()) {
  vi.mocked(useProtocols).mockReturnValue({
    useGetProtocol: () => makeQuery(protocol),
    useRenameProtocol: () => makeMutation(vi.fn()),
    useSaveVersion: () => makeMutation(saveVersion),
    useGetVersionHistory: () => makeQuery([]),
    useGetVersion: () => makeQuery(undefined),
    useRestoreVersion: () => makeMutation(vi.fn()),
  } as unknown as ReturnType<typeof useProtocols>)

  const router = createMemoryRouter(
    [{ path: '/protocolos/:id', element: <ProtocolEditor /> }],
    { initialEntries: ['/protocolos/proto-1'] },
  )
  render(<RouterProvider router={router} />)

  return { saveVersion }
}

describe('ProtocolEditor save-path wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    window.innerWidth = 1280
  })

  it('includes the historia mapping override in the save payload for a mapping-only edit', async () => {
    const { saveVersion } = setup()
    const user = userEvent.setup()

    await user.click(screen.getByRole('tab', { name: 'Historia médica' }))
    await user.click(screen.getAllByRole('switch')[0]!)

    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await user.click(await screen.findByRole('button', { name: 'Guardar como borrador' }))

    await waitFor(() => expect(saveVersion).toHaveBeenCalled())
    const [payload] = saveVersion.mock.calls[0] as [{ content: Record<string, unknown> }, unknown]
    expect(payload.content).toEqual(
      expect.objectContaining({
        historia_mapping: { b1: { include: false } },
      }),
    )
  })

  it('omits historia_mapping entirely once all overrides are cleared', async () => {
    const { saveVersion } = setup()
    const user = userEvent.setup()

    await user.click(screen.getByRole('tab', { name: 'Historia médica' }))
    await user.click(screen.getAllByRole('switch')[0]!)
    await user.click(screen.getByRole('button', { name: /Restaurar automático/ }))

    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await user.click(await screen.findByRole('button', { name: 'Guardar como borrador' }))

    await waitFor(() => expect(saveVersion).toHaveBeenCalled())
    const [payload] = saveVersion.mock.calls[0] as [{ content: Record<string, unknown> }, unknown]
    expect(payload.content).not.toHaveProperty('historia_mapping')
  })
})
