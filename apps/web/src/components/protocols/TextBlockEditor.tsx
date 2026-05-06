import { useState } from 'react'
import { useEditorStore } from '@/store/editor.store'
import { strings } from '@/lib/strings'
import { Button, Row, Stack, Textarea } from '@/components/ui'

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
    <Stack gap={3} className="p-4">
      <Textarea
        rows={4}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={strings.EDITOR_TEXT_PLACEHOLDER}
        autoFocus
      />
      <Row gap={2} justify="end">
        <Button variant="secondary" size="sm" onClick={cancel}>
          {strings.EDITOR_BLOCK_CANCEL}
        </Button>
        <Button variant="primary" size="sm" onClick={commit}>
          {strings.EDITOR_BLOCK_APPLY}
        </Button>
      </Row>
    </Stack>
  )
}
