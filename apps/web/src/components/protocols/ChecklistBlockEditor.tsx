import { useState } from 'react'
import { useEditorStore } from '@/store/editor.store'
import { strings } from '@/lib/strings'
import { Button } from '@/components/ui'

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

  const addItem = () => {
    setDraftItems((prev) => [...prev, { id: `itm_${crypto.randomUUID().slice(0, 8)}`, text: '' }])
  }

  const updateItem = (itemId: string, patch: Partial<ChecklistItem>) => {
    setDraftItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, ...patch } : it)))
  }

  const removeItem = (itemId: string) => {
    setDraftItems((prev) => prev.filter((it) => it.id !== itemId))
  }

  const commit = () => {
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

  const cancel = () => selectBlock(null)

  return (
    <div className="p-4 flex flex-col gap-3">
      {/* Title */}
      <div className="flex flex-col gap-1">
        <label className="text-[12px] font-sans font-medium text-n-600">
          {strings.EDITOR_CHECKLIST_TITLE_LABEL}
        </label>
        <input
          type="text"
          className="h-[34px] px-3 text-[13px] font-sans border border-n-300 rounded-sm focus:outline-none focus:border-p-500 transition-all duration-[100ms]"
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          placeholder={strings.EDITOR_CHECKLIST_TITLE_PLACEHOLDER}
        />
      </div>

      {/* Items */}
      <div className="flex flex-col gap-1">
        <label className="text-[12px] font-sans font-medium text-n-600">
          {strings.EDITOR_CHECKLIST_ITEMS_LABEL}
        </label>
        <div className="flex flex-col gap-1.5">
          {draftItems.map((item, idx) => (
            <div key={item.id} className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-n-400 w-4 shrink-0 text-right">
                {idx + 1}
              </span>
              <input
                type="text"
                className="flex-1 h-[30px] px-2 text-[13px] font-sans border border-n-300 rounded-sm focus:outline-none focus:border-p-500 transition-all duration-[100ms]"
                value={item.text}
                onChange={(e) => updateItem(item.id, { text: e.target.value })}
                placeholder={strings.EDITOR_CHECKLIST_ITEM_PLACEHOLDER}
                autoFocus={idx === draftItems.length - 1 && item.text === ''}
              />
              <label className="flex items-center gap-1 shrink-0 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={item.critical ?? false}
                  onChange={(e) => updateItem(item.id, { critical: e.target.checked })}
                  className="w-3.5 h-3.5 accent-danger-text"
                />
                <span className="text-[11px] font-mono text-n-500 uppercase tracking-[0.05em]">
                  {strings.EDITOR_CHECKLIST_CRITICAL_LABEL}
                </span>
              </label>
              <button
                onClick={() => removeItem(item.id)}
                disabled={draftItems.length === 1}
                className="w-6 h-6 flex items-center justify-center text-n-400 hover:text-danger-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-[100ms]"
                title={strings.EDITOR_CHECKLIST_REMOVE_ITEM}
              >
                <i className="ph ph-x text-[12px]" />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={addItem}
          className="mt-1 text-[12px] font-sans text-p-500 hover:text-p-700 self-start transition-colors duration-[100ms]"
        >
          {strings.EDITOR_CHECKLIST_ADD_ITEM}
        </button>
      </div>

      <div className="flex items-center gap-2 justify-end">
        <Button variant="secondary" size="sm" onClick={cancel}>
          {strings.EDITOR_BLOCK_CANCEL}
        </Button>
        <Button variant="primary" size="sm" onClick={commit} disabled={draftItems.length === 0}>
          {strings.EDITOR_BLOCK_APPLY}
        </Button>
      </div>
    </div>
  )
}
