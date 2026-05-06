import { useState } from 'react'
import { useEditorStore } from '@/store/editor.store'
import { strings } from '@/lib/strings'
import { Button, Field, IconButton, Input, Row, Stack, TextLink } from '@/components/ui'

const COLUMNS = ['drug', 'dose', 'route', 'frequency', 'notes'] as const
type Column = (typeof COLUMNS)[number]

interface DosageRow {
  id: string
  drug: string
  dose: string
  route: string
  frequency: string
  notes: string
}

interface DosageTableEditorProps {
  id: string
  title?: string | undefined
  rows: DosageRow[]
}

const COLUMN_LABELS: Record<Column, string> = {
  drug: 'Medicamento',
  dose: 'Dosis',
  route: 'Vía',
  frequency: 'Frecuencia',
  notes: 'Notas',
}

export function DosageTableEditor({ id, title, rows }: DosageTableEditorProps): JSX.Element {
  const [draftTitle, setDraftTitle] = useState(title ?? '')
  const [draftRows, setDraftRows] = useState<DosageRow[]>(rows)
  const updateBlock = useEditorStore((s) => s.updateBlock)
  const selectBlock = useEditorStore((s) => s.selectBlock)

  const addRow = (): void => {
    setDraftRows((prev) => [
      ...prev,
      {
        id: `row_${crypto.randomUUID().slice(0, 8)}`,
        drug: '',
        dose: '',
        route: '',
        frequency: '',
        notes: '',
      },
    ])
  }

  const updateRow = (rowId: string, col: Column, value: string): void => {
    setDraftRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, [col]: value } : r)))
  }

  const removeRow = (rowId: string): void => {
    if (draftRows.length === 1) return
    setDraftRows((prev) => prev.filter((r) => r.id !== rowId))
  }

  const commit = (): void => {
    updateBlock(id, (b) => {
      if (b.type !== 'dosage_table') return b
      const trimmed = draftTitle.trim()
      const updated = { ...b, rows: draftRows, columns: [...COLUMNS] }
      if (trimmed) updated.title = trimmed
      else delete updated.title
      return updated
    })
    selectBlock(null)
  }

  const cancel = (): void => selectBlock(null)

  return (
    <Stack gap={3} className="p-4">
      <Field label={strings.EDITOR_DOSAGE_TITLE_LABEL}>
        <Input
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          placeholder={strings.EDITOR_DOSAGE_TITLE_PLACEHOLDER}
        />
      </Field>

      <Field label={strings.EDITOR_DOSAGE_ROWS_LABEL}>
        <div className="overflow-x-auto rounded-sm border border-n-200">
          <table className="w-full text-[12px] font-sans">
            <thead>
              <tr className="bg-n-50 border-b border-n-200">
                {COLUMNS.map((col) => (
                  <th
                    key={col}
                    className="px-2 py-2 text-left text-[10.5px] font-mono uppercase tracking-[0.06em] text-n-600 whitespace-nowrap"
                  >
                    {COLUMN_LABELS[col]}
                  </th>
                ))}
                <th className="px-2 py-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {draftRows.map((row, idx) => (
                <tr key={row.id} className={idx % 2 === 0 ? 'bg-n-0' : 'bg-n-25'}>
                  {COLUMNS.map((col) => (
                    <td key={col} className="px-1 py-1">
                      <Input
                        value={row[col]}
                        onChange={(e) => updateRow(row.id, col, e.target.value)}
                        placeholder={col === 'drug' && idx === 0 ? 'Ej. Epinefrina' : ''}
                        autoFocus={
                          col === 'drug' && idx === draftRows.length - 1 && row.drug === ''
                        }
                      />
                    </td>
                  ))}
                  <td className="px-1 py-1 text-center">
                    <IconButton
                      icon="ph ph-x"
                      aria-label={strings.EDITOR_DOSAGE_REMOVE_ROW}
                      tone="danger"
                      size="sm"
                      disabled={draftRows.length === 1}
                      onClick={() => removeRow(row.id)}
                      className="mx-auto"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TextLink tone="primary" size="md" onClick={addRow} className="mt-1 self-start">
          {strings.EDITOR_DOSAGE_ADD_ROW}
        </TextLink>
      </Field>

      <Row gap={2} justify="end">
        <Button variant="secondary" size="sm" onClick={cancel}>
          {strings.EDITOR_BLOCK_CANCEL}
        </Button>
        <Button variant="primary" size="sm" onClick={commit} disabled={draftRows.length === 0}>
          {strings.EDITOR_BLOCK_APPLY}
        </Button>
      </Row>
    </Stack>
  )
}
