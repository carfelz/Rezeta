import { useState } from 'react'
import { useEditorStore } from '@/store/editor.store'
import { blockTypeStrings, blockEditorStrings } from './strings'
import { Button, Checkbox, Field, Input, Row, Stack } from '@/components/ui'

interface ClinicalNotesBlockEditorProps {
  id: string
  label: string
  required?: boolean | undefined
}

export function ClinicalNotesBlockEditor({
  id,
  label,
  required,
}: ClinicalNotesBlockEditorProps): JSX.Element {
  const [draftLabel, setDraftLabel] = useState(label)
  const [draftRequired, setDraftRequired] = useState(required ?? false)
  const updateBlock = useEditorStore((s) => s.updateBlock)
  const selectBlock = useEditorStore((s) => s.selectBlock)

  const commit = (): void => {
    updateBlock(id, (b) => {
      if (b.type !== 'clinical_notes') return b
      const trimmed = draftLabel.trim()
      return { ...b, label: trimmed || blockTypeStrings.clinicalNotes, required: draftRequired }
    })
    selectBlock(null)
  }

  const cancel = (): void => selectBlock(null)

  return (
    <Stack gap={3} className="p-4">
      <Field label={blockEditorStrings.notesLabelField}>
        <Input value={draftLabel} onChange={(e) => setDraftLabel(e.target.value)} autoFocus />
      </Field>

      <Row gap={1} as="label" className="cursor-pointer select-none">
        <Checkbox
          checked={draftRequired}
          onChange={(e) => setDraftRequired(e.target.checked)}
        />
        <span className="text-[12px] font-sans text-n-600">
          {blockEditorStrings.notesRequiredField}
        </span>
      </Row>

      <Row gap={2} justify="end">
        <Button variant="secondary" size="sm" onClick={cancel}>
          {blockEditorStrings.blockCancel}
        </Button>
        <Button variant="primary" size="sm" onClick={commit}>
          {blockEditorStrings.blockApply}
        </Button>
      </Row>
    </Stack>
  )
}
