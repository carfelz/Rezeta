import { useState } from 'react'
import { useEditorStore } from '@/store/editor.store'
import { strings } from '@/lib/strings'
import { Button } from '@/components/ui'

interface TextBlockEditorProps {
  id: string
  content: string
}

export function TextBlockEditor({ id, content }: TextBlockEditorProps): JSX.Element {
  const [draft, setDraft] = useState(content)
  const updateBlock = useEditorStore((s) => s.updateBlock)
  const selectBlock = useEditorStore((s) => s.selectBlock)

  const commit = () => {
    updateBlock(id, (b) => {
      if (b.type !== 'text') return b
      return { ...b, content: draft }
    })
    selectBlock(null)
  }

  const cancel = () => {
    setDraft(content)
    selectBlock(null)
  }

  return (
    <div className="p-4 flex flex-col gap-3">
      <textarea
        className="w-full min-h-[100px] px-3 py-2 text-[13px] font-sans text-n-700 border border-n-300 rounded-sm resize-vertical focus:outline-none focus:border-p-500 focus:shadow-[0_0_0_3px_rgba(45,87,96,0.12)] transition-all duration-[100ms] leading-[1.55]"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={strings.EDITOR_TEXT_PLACEHOLDER}
        autoFocus
      />
      <div className="flex items-center gap-2 justify-end">
        <Button variant="secondary" size="sm" onClick={cancel}>
          {strings.EDITOR_BLOCK_CANCEL}
        </Button>
        <Button variant="primary" size="sm" onClick={commit}>
          {strings.EDITOR_BLOCK_APPLY}
        </Button>
      </div>
    </div>
  )
}
