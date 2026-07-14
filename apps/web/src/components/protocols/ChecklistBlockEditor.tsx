import { useState } from 'react'
import { useEditorStore } from '@/store/editor.store'
import { blockEditorStrings } from './strings'
import { Button, Checkbox, Field, IconButton, Input, Row, Stack, TextLink } from '@/components/ui'

interface ChecklistItem {
  id: string
  text: string
  critical?: boolean
}

interface ChecklistBlockEditorProps {
  id: string
  title?: string | undefined
  items: ChecklistItem[]
}

export function ChecklistBlockEditor({ id, title, items }: ChecklistBlockEditorProps): JSX.Element {
  const [draftTitle, setDraftTitle] = useState(title ?? '')
  const [draftItems, setDraftItems] = useState<ChecklistItem[]>(items)
  const updateBlock = useEditorStore((s) => s.updateBlock)
  const selectBlock = useEditorStore((s) => s.selectBlock)

  const addItem = (): void => {
    setDraftItems((prev) => [...prev, { id: `itm_${crypto.randomUUID().slice(0, 8)}`, text: '' }])
  }

  const updateItem = (itemId: string, patch: Partial<ChecklistItem>): void => {
    setDraftItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, ...patch } : it)))
  }

  const removeItem = (itemId: string): void => {
    setDraftItems((prev) => prev.filter((it) => it.id !== itemId))
  }

  const commit = (): void => {
    updateBlock(id, (b) => {
      if (b.type !== 'checklist') return b
      const trimmed = draftTitle.trim()
      const updated = { ...b, items: draftItems }
      if (trimmed) updated.title = trimmed
      else delete updated.title
      return updated
    })
    selectBlock(null)
  }

  const cancel = (): void => selectBlock(null)

  return (
    <Stack gap={3} className="p-4">
      <Field label={blockEditorStrings.checklistTitleLabel}>
        <Input
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          placeholder={blockEditorStrings.checklistTitlePlaceholder}
        />
      </Field>

      <Field label={blockEditorStrings.checklistItemsLabel}>
        <Stack gap={2}>
          {draftItems.map((item, idx) => (
            <Row key={item.id} gap={2}>
              <span className="text-overline font-mono text-n-400 w-4 shrink-0 text-right">
                {idx + 1}
              </span>
              <Input
                className="flex-1"
                value={item.text}
                onChange={(e) => updateItem(item.id, { text: e.target.value })}
                placeholder={blockEditorStrings.checklistItemPlaceholder}
                autoFocus={idx === draftItems.length - 1 && item.text === ''}
              />
              <Row gap={1} as="label" className="shrink-0 cursor-pointer select-none">
                <Checkbox
                  tone="danger"
                  checked={item.critical ?? false}
                  onChange={(e) => updateItem(item.id, { critical: e.target.checked })}
                />
                <span className="text-overline font-mono text-n-500 uppercase tracking-wider">
                  {blockEditorStrings.checklistCriticalLabel}
                </span>
              </Row>
              <IconButton
                icon="ph ph-x"
                aria-label={blockEditorStrings.checklistRemoveItem}
                tone="danger"
                size="sm"
                disabled={draftItems.length === 1}
                onClick={() => removeItem(item.id)}
              />
            </Row>
          ))}
        </Stack>
        <TextLink tone="primary" size="md" onClick={addItem} className="mt-1 self-start">
          {blockEditorStrings.checklistAddItem}
        </TextLink>
      </Field>

      <Row gap={2} justify="end">
        <Button variant="secondary" size="sm" onClick={cancel}>
          {blockEditorStrings.blockCancel}
        </Button>
        <Button variant="primary" size="sm" onClick={commit} disabled={draftItems.length === 0}>
          {blockEditorStrings.blockApply}
        </Button>
      </Row>
    </Stack>
  )
}
