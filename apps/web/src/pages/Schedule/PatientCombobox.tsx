import { useEffect, useRef, useState } from 'react'
import { Button, Input } from '@/components/ui'
import { usePatients } from '@/hooks/patients/use-patients'
import type { Patient } from '@rezeta/shared'
import { patientComboboxStrings } from './strings'

export interface PatientComboboxProps {
  value: string
  onChange: (patientId: string, patientName: string) => void
}

export function PatientCombobox({ value, onChange }: PatientComboboxProps): JSX.Element {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [selectedName, setSelectedName] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const { data } = usePatients({ search })
  const patients: Patient[] = data?.items ?? []

  useEffect(() => {
    function onMouseDown(e: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
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

  return (
    <div className="relative" ref={containerRef}>
      <Input
        type="text"
        placeholder={patientComboboxStrings.searchPlaceholder}
        value={value && !open ? selectedName : search}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setSearch(e.target.value)
          setOpen(true)
          if (!e.target.value) onChange('', '')
        }}
        autoComplete="off"
      />
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-n-0 border border-n-200 rounded shadow-floating z-50 max-h-[200px] overflow-y-auto">
          {patients.length === 0 ? (
            <div className="px-3 py-2 text-[12px] text-n-400">
              {search ? patientComboboxStrings.noResults : patientComboboxStrings.typeToSearch}
            </div>
          ) : (
            patients.map((p) => (
              <Button
                key={p.id}
                variant="item"
                size="sm"
                className="w-full flex flex-col items-start px-3 py-2 text-left"
                onClick={() => handleSelect(p)}
              >
                <span className="text-[13px] font-medium text-n-800">
                  {p.firstName} {p.lastName}
                </span>
                {p.documentNumber && (
                  <span className="text-[11.5px] font-mono text-n-400">{p.documentNumber}</span>
                )}
              </Button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
