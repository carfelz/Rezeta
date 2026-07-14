import { useState } from 'react'
import { useEditorStore } from '@/store/editor.store'
import { blockEditorStrings } from './strings'
import {
  Button,
  Field,
  IconButton,
  Input,
  Row,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Stack,
  TextLink,
} from '@/components/ui'
import type { VitalsField } from '@rezeta/shared'

type EditableInputType = Exclude<VitalsField['input_type'], 'computed'>

interface VitalsBlockEditorProps {
  id: string
  title?: string | undefined
  fields: VitalsField[]
}

const EDITABLE_TYPE_OPTIONS: { value: EditableInputType; label: string }[] = [
  { value: 'text', label: blockEditorStrings.vitalsTypeText },
  { value: 'number', label: blockEditorStrings.vitalsTypeNumber },
]

export function VitalsBlockEditor({ id, title, fields }: VitalsBlockEditorProps): JSX.Element {
  const [draftTitle, setDraftTitle] = useState(title ?? '')
  const [draftFields, setDraftFields] = useState<VitalsField[]>(fields)
  const updateBlock = useEditorStore((s) => s.updateBlock)
  const selectBlock = useEditorStore((s) => s.selectBlock)

  const addField = (): void => {
    setDraftFields((prev) => [
      ...prev,
      { id: `vtl_${crypto.randomUUID().slice(0, 8)}`, label: '', input_type: 'number' },
    ])
  }

  const updateField = (fieldId: string, patch: Partial<VitalsField>): void => {
    setDraftFields((prev) => prev.map((f) => (f.id === fieldId ? { ...f, ...patch } : f)))
  }

  const removeField = (fieldId: string): void => {
    setDraftFields((prev) => prev.filter((f) => f.id !== fieldId))
  }

  const commit = (): void => {
    updateBlock(id, (b) => {
      if (b.type !== 'vitals') return b
      const trimmed = draftTitle.trim()
      const updated = { ...b, fields: draftFields }
      if (trimmed) updated.title = trimmed
      else delete updated.title
      return updated
    })
    selectBlock(null)
  }

  const cancel = (): void => selectBlock(null)

  return (
    <Stack gap={3} className="p-4">
      <Field label={blockEditorStrings.vitalsTitleField}>
        <Input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} />
      </Field>

      <div className="overflow-x-auto rounded-sm border border-n-200">
        <table className="w-full text-xs font-sans">
          <thead>
            <tr className="bg-n-50 border-b border-n-200">
              <th className="px-2 py-2 text-left text-2xs font-mono uppercase tracking-label text-n-600 whitespace-nowrap">
                {blockEditorStrings.vitalsFieldLabel}
              </th>
              <th className="px-2 py-2 text-left text-2xs font-mono uppercase tracking-label text-n-600 whitespace-nowrap">
                {blockEditorStrings.vitalsFieldUnit}
              </th>
              <th className="px-2 py-2 text-left text-2xs font-mono uppercase tracking-label text-n-600 whitespace-nowrap">
                {blockEditorStrings.vitalsFieldType}
              </th>
              <th className="px-2 py-2 w-8" />
            </tr>
          </thead>
          <tbody>
            {draftFields.map((field, idx) => {
              const isComputed = field.input_type === 'computed'
              return (
                <tr key={field.id} className={idx % 2 === 0 ? 'bg-n-0' : 'bg-n-25'}>
                  <td className="px-1 py-1">
                    <Input
                      value={field.label}
                      onChange={(e) => updateField(field.id, { label: e.target.value })}
                      autoFocus={idx === draftFields.length - 1 && field.label === ''}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <Input
                      value={field.unit ?? ''}
                      onChange={(e) => updateField(field.id, { unit: e.target.value })}
                    />
                  </td>
                  <td className="px-1 py-1">
                    {isComputed ? (
                      <span className="inline-block text-2xs font-mono uppercase tracking-wider text-n-500 px-2 py-1 border border-n-200 rounded-sm whitespace-nowrap">
                        {blockEditorStrings.vitalsTypeComputed}
                      </span>
                    ) : (
                      <Select
                        value={field.input_type}
                        onValueChange={(v) =>
                          updateField(field.id, { input_type: v as EditableInputType })
                        }
                      >
                        <SelectTrigger className="w-110">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {EDITABLE_TYPE_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </td>
                  <td className="px-1 py-1 text-center">
                    {!isComputed && (
                      <IconButton
                        icon="ph ph-x"
                        aria-label={blockEditorStrings.vitalsRemoveField(field.label)}
                        tone="danger"
                        size="sm"
                        onClick={() => removeField(field.id)}
                        className="mx-auto"
                      />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <TextLink tone="primary" size="md" onClick={addField} className="self-start">
        {blockEditorStrings.vitalsAddField}
      </TextLink>

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
