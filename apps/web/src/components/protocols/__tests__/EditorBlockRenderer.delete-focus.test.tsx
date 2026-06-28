import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EditorBlockRenderer } from '@/components/protocols/EditorBlockRenderer'
import { useEditorStore } from '@/store/editor.store'
import type { ProtocolBlock } from '@/components/protocols/BlockRenderer'

/**
 * Regression test for the "page freezes after deleting a block" bug.
 *
 * The block actions menu is a Radix DropdownMenu and the "Eliminar" item opens
 * a Radix Dialog (ConfirmDialog). A *modal* dropdown sets
 * `document.body.style.pointerEvents = 'none'` while open; the dialog mounts
 * while that lock is active and snapshots `none` as the value to restore on
 * close, leaving the whole page non-interactive until refresh. The menu is
 * therefore rendered with `modal={false}`. These tests assert <body> is never
 * left with `pointer-events: none` after the delete confirm/cancel flow.
 */
function makeTextBlock(): ProtocolBlock {
  return { id: 'blk-1', type: 'text', content: 'Hola' } as ProtocolBlock
}

function initStore(block: ProtocolBlock) {
  useEditorStore.getState().initEditor('protocol-1', [block], new Set())
}

describe('EditorBlockRenderer — delete does not freeze the page', () => {
  beforeEach(() => {
    document.body.style.pointerEvents = ''
  })

  afterEach(() => {
    document.body.style.pointerEvents = ''
    useEditorStore.getState().resetEditor()
  })

  it('leaves <body> interactive after confirming a delete', async () => {
    // pointerEventsCheck disabled so a frozen <body> (the bug) does not block the
    // clicks themselves — we want the post-flow assertion to be what fails.
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    const block = makeTextBlock()
    initStore(block)
    render(<EditorBlockRenderer block={block} />)

    await user.click(screen.getByRole('button', { name: 'Más acciones' }))
    await user.click(screen.getByRole('menuitem', { name: 'Eliminar' }))
    await user.click(screen.getByRole('button', { name: 'Eliminar', hidden: true }))

    await waitFor(() => {
      expect(useEditorStore.getState().blocks).toHaveLength(0)
    })
    expect(document.body.style.pointerEvents).not.toBe('none')
  })

  it('leaves <body> interactive after cancelling a delete', async () => {
    // pointerEventsCheck disabled so a frozen <body> (the bug) does not block the
    // clicks themselves — we want the post-flow assertion to be what fails.
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    const block = makeTextBlock()
    initStore(block)
    render(<EditorBlockRenderer block={block} />)

    await user.click(screen.getByRole('button', { name: 'Más acciones' }))
    await user.click(screen.getByRole('menuitem', { name: 'Eliminar' }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(document.body.style.pointerEvents).not.toBe('none')
  })
})
