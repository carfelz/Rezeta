import { render, screen, waitFor, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'
import type { ProtocolResponse } from '@rezeta/shared'
import { ProtocolEditor } from '../index'
import { useProtocols } from '@/hooks/protocols/use-protocols'
import { loadLocalDraft } from '@/store/editor.store'
import type * as EditorStoreModule from '@/store/editor.store'
import { protocolEditorStrings } from '../strings'

vi.mock('@/hooks/protocols/use-protocols', () => ({
  useProtocols: vi.fn(),
}))

vi.mock('@/store/editor.store', async (importOriginal) => {
  const actual = await importOriginal<typeof EditorStoreModule>()
  return {
    ...actual,
    loadLocalDraft: vi.fn(actual.loadLocalDraft),
  }
})

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

function makeMutation<T, V>(
  mutate: ReturnType<typeof vi.fn>,
  overrides: Partial<UseMutationResult<T, Error, V>> = {},
): UseMutationResult<T, Error, V> {
  return {
    mutate,
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null,
    data: undefined,
    reset: vi.fn(),
    ...overrides,
  } as unknown as UseMutationResult<T, Error, V>
}

function setup(saveVersion = vi.fn(), options: { saveVersionPending?: boolean } = {}) {
  vi.mocked(useProtocols).mockReturnValue({
    useGetProtocol: () => makeQuery(protocol),
    useRenameProtocol: () => makeMutation(vi.fn()),
    useSaveVersion: () =>
      makeMutation(saveVersion, { isPending: options.saveVersionPending ?? false }),
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

  it('shows pending saving/publishing labels and disables the header buttons while a save is in flight', () => {
    setup(vi.fn(), { saveVersionPending: true })

    const saveButton = screen.getByRole('button', { name: protocolEditorStrings.saving })
    const publishButton = screen.getByRole('button', { name: protocolEditorStrings.publishing })
    expect(saveButton).toBeDisabled()
    expect(publishButton).toBeDisabled()
  })

  it('clears the recovered-draft banner once a save succeeds', async () => {
    vi.mocked(loadLocalDraft).mockReturnValue({
      blocks: [{ id: 'b1', type: 'clinical_notes', label: 'Motivo de consulta', content: 'x' }],
      savedAt: Date.now(),
    })
    const saveVersion = vi.fn((_vars: unknown, opts: { onSuccess?: () => void }) => {
      opts.onSuccess?.()
    })
    setup(saveVersion)
    const user = userEvent.setup()

    expect(screen.getByText(protocolEditorStrings.draftRecovered)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await user.click(await screen.findByRole('button', { name: 'Guardar como borrador' }))

    await waitFor(() => expect(saveVersion).toHaveBeenCalled())
    expect(screen.queryByText(protocolEditorStrings.draftRecovered)).not.toBeInTheDocument()
  })

  it('persists historia_mapping to the local draft on an autosave tick after a mapping-only edit', () => {
    vi.useFakeTimers()
    try {
      setup()

      act(() => {
        const tab = screen.getByRole('tab', { name: 'Historia médica' })
        tab.focus()
        fireEvent.click(tab)
      })
      act(() => {
        fireEvent.click(screen.getAllByRole('switch')[0]!)
      })

      act(() => {
        vi.advanceTimersByTime(30_000)
      })

      const raw = window.localStorage.getItem('protocol-draft-proto-1')
      expect(raw).not.toBeNull()
      expect(JSON.parse(raw!).historia_mapping).toEqual({ b1: { include: false } })
    } finally {
      vi.useRealTimers()
    }
  })

  it('applies the historia mapping from a recovered draft', async () => {
    vi.mocked(loadLocalDraft).mockReturnValue({
      blocks: [{ id: 'b1', type: 'clinical_notes', label: 'Motivo de consulta', content: 'x' }],
      historiaMapping: { b1: { include: false } },
      savedAt: Date.now(),
    })
    setup()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: protocolEditorStrings.draftUse }))
    await user.click(screen.getByRole('tab', { name: 'Historia médica' }))

    expect(screen.getAllByRole('switch')[0]).toHaveAttribute('aria-checked', 'false')
  })
})
