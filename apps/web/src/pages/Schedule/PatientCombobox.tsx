import { useEffect, useRef, useState } from 'react'
import { Button, Input } from '@/components/ui'
import { usePatients } from '@/hooks/patients/use-patients'
import type { Patient } from '@rezeta/shared'
import { PatientModal } from '@/pages/Patients/PatientModal'
import { patientComboboxStrings } from './strings'

export interface PatientComboboxProps {
  value: string
  onChange: (patientId: string, patientName: string) => void
  placeholder?: string
  initialSelectedName?: string
}

export function PatientCombobox({
  value,
  onChange,
  placeholder = patientComboboxStrings.searchPlaceholder,
  initialSelectedName,
}: PatientComboboxProps): JSX.Element {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [selectedName, setSelectedName] = useState(initialSelectedName ?? '')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const { data } = usePatients({ search })
  const patients: Patient[] = data?.items ?? []

  // Clicking outside only dismisses the dropdown. It must not clear the selected
  // patient or reset the surrounding form — the patient is cleared explicitly when
  // the user empties the input (see onChange below).
  useEffect(() => {
    function onMouseDown(e: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  function handleSelect(p: Patient): void {
    const name = `${p.firstName} ${p.lastName}`.trim()
    setSelectedName(name)
    setSearch('')
    setOpen(false)
    onChange(p.id, name)
  }

  function handleCreated(p: Patient): void {
    setShowCreateModal(false)
    handleSelect(p)
  }

  return (
    <div className="relative" ref={containerRef}>
      <Input
        type="text"
        placeholder={placeholder}
        value={value && !open ? selectedName : search}
        onClick={() => setOpen(true)}
        onChange={(e) => {
          setSearch(e.target.value)
          setOpen(true)
          if (!e.target.value) onChange('', '')
        }}
        autoComplete="off"
      />
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-n-0 border border-n-200 rounded shadow-floating z-50 max-h-200 overflow-y-auto">
          {patients.length === 0 ? (
            <div className="px-3 py-2 text-xs text-n-400">
              {search ? patientComboboxStrings.noResults : patientComboboxStrings.typeToSearch}
            </div>
          ) : (
            patients.map((p) => (
              <Button
                key={p.id}
                type="button"
                variant="item"
                size="xl"
                className="w-full flex flex-col items-start px-3 py-2 text-left"
                onClick={() => handleSelect(p)}
              >
                <span className="text-sm font-medium text-n-800">
                  {p.firstName} {p.lastName}
                </span>
                {p.documentNumber && (
                  <span className="text-overline font-mono text-n-400">{p.documentNumber}</span>
                )}
              </Button>
            ))
          )}
          <Button
            type="button"
            variant="item"
            size="xl"
            className="w-full flex items-center gap-2 px-3 py-2 text-left border-t border-n-100"
            onClick={() => setShowCreateModal(true)}
          >
            <i className="ph ph-plus" style={{ fontSize: 14 }} />
            <span className="text-sm font-medium text-n-800">
              {patientComboboxStrings.newPatient}
            </span>
          </Button>
        </div>
      )}

      {showCreateModal && (
        <PatientModal
          mode="create"
          onClose={() => setShowCreateModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  )
}
