import { useState } from 'react'
import { useEditorStore } from '@/store/editor.store'
import { strings } from '@/lib/strings'
import { Button } from '@/components/ui'

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

  const addRow = () => {
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

  const updateRow = (rowId: string, col: Column, value: string) => {
    setDraftRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, [col]: value } : r)))
  }

  const removeRow = (rowId: string) => {
    if (draftRows.length === 1) return
    setDraftRows((prev) => prev.filter((r) => r.id !== rowId))
  }

  const commit = () => {
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

  const cancel = () => selectBlock(null)

  return (
    <div className="p-4 flex flex-col gap-3">
      {/* Title */}
      <div className="flex flex-col gap-1">
        <label className="text-[12px] font-sans font-medium text-n-600">
          {strings.EDITOR_DOSAGE_TITLE_LABEL}
        </label>
        <input
          type="text"
          className="h-[34px] px-3 text-[13px] font-sans border border-n-300 rounded-sm focus:outline-none focus:border-p-500 transition-all duration-[100ms]"
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          placeholder={strings.EDITOR_DOSAGE_TITLE_PLACEHOLDER}
        />
      </div>

      {/* Table */}
      <div className="flex flex-col gap-1">
        <label className="text-[12px] font-sans font-medium text-n-600">
          {strings.EDITOR_DOSAGE_ROWS_LABEL}
        </label>
        <div className="overflow-x-auto rounded-sm border border-n-200">
          <table className="w-full text-[12px] font-sans">
            <thead>
              <tr className="bg-n-50 border-b border-n-200">
                {COLUMNS.map((col) => (
                  <th
                    key={col}
                    className="px-2 py-1.5 text-left text-[10.5px] font-mono uppercase tracking-[0.06em] text-n-600 whitespace-nowrap"
                  >
                    {COLUMN_LABELS[col]}
                  </th>
                ))}
                <th className="px-2 py-1.5 w-8" />
              </tr>
            </thead>
            <tbody>
              {draftRows.map((row, idx) => (
                <tr key={row.id} className={idx % 2 === 0 ? 'bg-n-0' : 'bg-n-25'}>
                  {COLUMNS.map((col) => (
                    <td key={col} className="px-1 py-1">
                      <input
                        type="text"
                        className="w-full h-[26px] px-2 text-[12px] font-sans border border-n-200 rounded-[3px] focus:outline-none focus:border-p-500 transition-all duration-[100ms] bg-transparent"
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
                    <button
                      onClick={() => removeRow(row.id)}
                      disabled={draftRows.length === 1}
                      className="w-6 h-6 flex items-center justify-center text-n-400 hover:text-danger-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-[100ms] mx-auto"
                      title={strings.EDITOR_DOSAGE_REMOVE_ROW}
                    >
                      <i className="ph ph-x text-[11px]" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          onClick={addRow}
          className="mt-1 text-[12px] font-sans text-p-500 hover:text-p-700 self-start transition-colors duration-[100ms]"
        >
          {strings.EDITOR_DOSAGE_ADD_ROW}
        </button>
      </div>

      <div className="flex items-center gap-2 justify-end">
        <Button variant="secondary" size="sm" onClick={cancel}>
          {strings.EDITOR_BLOCK_CANCEL}
        </Button>
        <Button variant="primary" size="sm" onClick={commit} disabled={draftRows.length === 0}>
          {strings.EDITOR_BLOCK_APPLY}
        </Button>
      </div>
    </div>
  )
}
