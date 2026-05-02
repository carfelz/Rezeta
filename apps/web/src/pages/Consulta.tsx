import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  useConsultation,
  useUpdateConsultation,
  useSignConsultation,
  useAmendConsultation,
  useAddProtocolUsage,
  useUpdateCheckedState,
  useRemoveProtocolUsage,
  usePatientConsultations,
} from '@/hooks/consultations/use-consultations'
import { usePatient } from '@/hooks/patients/use-patients'
import { useProtocols } from '@/hooks/protocols/use-protocols'
import type { ConsultationProtocolUsage, Vitals } from '@rezeta/shared'
import {
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalClose,
  Textarea,
  Field,
} from '@/components/ui'
import { BlockRendererRunMode } from '@/components/protocols/BlockRendererRunMode'
import type { RunModeProps } from '@/components/protocols/BlockRendererRunMode'
import { OrderQueuePanel } from '@/components/consultations/OrderQueuePanel'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LocalVitals {
  bpSys: string
  bpDia: string
  hr: string
  temp: string
  spo2: string
  weight: string
  height: string
  resp: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toNum(s: string): number | undefined {
  const n = parseFloat(s)
  return isNaN(n) ? undefined : n
}

function vitalsToLocal(v: Vitals | null): LocalVitals {
  return {
    bpSys: v?.bloodPressureSystolic?.toString() ?? '',
    bpDia: v?.bloodPressureDiastolic?.toString() ?? '',
    hr: v?.heartRate?.toString() ?? '',
    temp: v?.temperatureCelsius?.toString() ?? '',
    spo2: v?.oxygenSaturation?.toString() ?? '',
    weight: v?.weightKg?.toString() ?? '',
    height: v?.heightCm?.toString() ?? '',
    resp: v?.respiratoryRate?.toString() ?? '',
  }
}

function localToVitals(v: LocalVitals): Vitals {
  const raw: Record<string, number | undefined> = {
    bloodPressureSystolic: toNum(v.bpSys),
    bloodPressureDiastolic: toNum(v.bpDia),
    heartRate: toNum(v.hr),
    temperatureCelsius: toNum(v.temp),
    oxygenSaturation: toNum(v.spo2),
    weightKg: toNum(v.weight),
    heightCm: toNum(v.height),
    respiratoryRate: toNum(v.resp),
  }
  return Object.fromEntries(Object.entries(raw).filter(([, val]) => val !== undefined)) as Vitals
}

function computeBMI(v: LocalVitals): string {
  const w = toNum(v.weight)
  const h = toNum(v.height)
  if (!w || !h) return '—'
  const bmi = w / Math.pow(h / 100, 2)
  return bmi.toFixed(1)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-DO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatKicker(iso: string, location: string): string {
  const d = new Date(iso)
  const date = d.toLocaleDateString('es-DO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const time = d.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })
  return `${date.charAt(0).toUpperCase()}${date.slice(1)} · ${time} · ${location}`
}

// ─── Save status ──────────────────────────────────────────────────────────────

type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved'

function SaveBadge({ status }: { status: SaveStatus }): JSX.Element | null {
  if (status === 'idle') return null
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 text-[11.5px] font-mono px-3 py-1 rounded border',
        status === 'dirty' && 'bg-n-50 border-n-200 text-n-500',
        status === 'saving' && 'bg-n-50 border-n-200 text-n-500',
        status === 'saved' && 'bg-success-bg border-success-border text-success-text',
      )}
    >
      {status === 'dirty' && (
        <>
          <span className="w-2 h-2 rounded-full bg-n-400 inline-block" />
          Sin guardar
        </>
      )}
      {status === 'saving' && (
        <>
          <i className="ph ph-spinner animate-spin text-[11px]" />
          Guardando…
        </>
      )}
      {status === 'saved' && (
        <>
          <i className="ph ph-check text-[11px]" />
          Guardado
        </>
      )}
    </span>
  )
}

// ─── Vitals section ───────────────────────────────────────────────────────────

interface VitalInputProps {
  label: string
  value: string
  onChange: (v: string) => void
  unit: string
  placeholder?: string
  readOnly?: boolean
}

function VitalInput({
  label,
  value,
  onChange,
  unit,
  placeholder = '—',
  readOnly = false,
}: VitalInputProps): JSX.Element {
  return (
    <div className="field">
      <label className="block text-[12px] font-sans font-medium text-n-700 mb-1">{label}</label>
      <div className="flex h-[34px] border border-n-300 rounded-sm overflow-hidden focus-within:border-p-500 focus-within:ring-[3px] focus-within:ring-p-500/10">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          readOnly={readOnly}
          className={cn(
            'flex-1 min-w-0 px-3 text-[13px] font-sans text-n-700 placeholder:text-n-300 bg-n-0 focus:outline-none',
            readOnly && 'bg-n-25 text-n-500 cursor-default',
          )}
        />
        <span className="px-3 flex items-center text-[11.5px] font-mono text-n-500 bg-n-50 border-l border-n-200 shrink-0 whitespace-nowrap">
          {unit}
        </span>
      </div>
    </div>
  )
}

interface VitalsSectionProps {
  vitals: LocalVitals
  onChange: (v: LocalVitals) => void
  disabled: boolean
}

function VitalsSection({ vitals, onChange, disabled }: VitalsSectionProps): JSX.Element {
  const set = (key: keyof LocalVitals) => (val: string) => onChange({ ...vitals, [key]: val })
  const bmi = computeBMI(vitals)

  if (disabled) {
    const hasData = Object.values(vitals).some(Boolean)
    if (!hasData) {
      return <p className="text-[13px] text-n-300">—</p>
    }
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="field">
        <label className="block text-[12px] font-sans font-medium text-n-700 mb-1">
          Presión arterial
        </label>
        <div className="flex h-[34px] border border-n-300 rounded-sm overflow-hidden focus-within:border-p-500 focus-within:ring-[3px] focus-within:ring-p-500/10">
          <input
            type="number"
            value={vitals.bpSys}
            onChange={(e) => set('bpSys')(e.target.value)}
            placeholder="—"
            disabled={disabled}
            className="w-[52px] shrink-0 px-2 text-[13px] font-sans text-n-700 placeholder:text-n-300 bg-n-0 focus:outline-none disabled:bg-n-25 disabled:text-n-500"
          />
          <span className="px-1 flex items-center text-n-400 text-[12px] bg-n-0">/</span>
          <input
            type="number"
            value={vitals.bpDia}
            onChange={(e) => set('bpDia')(e.target.value)}
            placeholder="—"
            disabled={disabled}
            className="w-[52px] shrink-0 px-2 text-[13px] font-sans text-n-700 placeholder:text-n-300 bg-n-0 focus:outline-none disabled:bg-n-25 disabled:text-n-500"
          />
          <span className="px-2 flex items-center text-[11px] font-mono text-n-500 bg-n-50 border-l border-n-200 shrink-0">
            mmHg
          </span>
        </div>
      </div>

      <VitalInput label="Frec. cardíaca" value={vitals.hr} onChange={set('hr')} unit="lpm" />
      <VitalInput label="Temperatura" value={vitals.temp} onChange={set('temp')} unit="°C" />
      <VitalInput label="Saturación O₂" value={vitals.spo2} onChange={set('spo2')} unit="%" />
      <VitalInput label="Peso" value={vitals.weight} onChange={set('weight')} unit="kg" />
      <VitalInput label="Talla" value={vitals.height} onChange={set('height')} unit="cm" />
      <VitalInput label="IMC · calculado" value={bmi} onChange={() => {}} unit="kg/m²" readOnly />
      <VitalInput
        label="Frec. respiratoria"
        value={vitals.resp}
        onChange={set('resp')}
        unit="resp/min"
      />
    </div>
  )
}

// ─── Diagnoses section ────────────────────────────────────────────────────────

function DiagnosesSection({
  diagnoses,
  onChange,
  disabled,
}: {
  diagnoses: string[]
  onChange: (d: string[]) => void
  disabled: boolean
}): JSX.Element {
  const [input, setInput] = useState('')

  function addDiagnosis(): void {
    const trimmed = input.trim()
    if (!trimmed || diagnoses.includes(trimmed)) return
    onChange([...diagnoses, trimmed])
    setInput('')
  }

  function removeDiagnosis(d: string): void {
    onChange(diagnoses.filter((x) => x !== d))
  }

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {diagnoses.map((d) => (
        <span
          key={d}
          className="inline-flex items-center gap-2 text-[12.5px] font-sans px-3 py-1 rounded bg-p-50 border border-p-100 text-p-700"
        >
          {d}
          {!disabled && (
            <button
              type="button"
              onClick={() => removeDiagnosis(d)}
              className="ml-1 text-p-500 hover:text-p-900 leading-none"
            >
              <i className="ph ph-x text-[11px]" />
            </button>
          )}
        </span>
      ))}
      {!disabled && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addDiagnosis()
              }
            }}
            placeholder="Añadir diagnóstico…"
            className="h-[30px] px-3 text-[12.5px] font-sans border border-dashed border-n-300 rounded-sm bg-n-0 placeholder:text-n-300 text-n-700 focus:outline-none focus:border-p-500 w-[200px]"
          />
          {input.trim() && (
            <button
              type="button"
              onClick={addDiagnosis}
              className="text-[11.5px] text-p-700 hover:text-p-900 font-medium"
            >
              Añadir
            </button>
          )}
        </div>
      )}
      {diagnoses.length === 0 && disabled && <span className="text-[13px] text-n-300">—</span>}
    </div>
  )
}

// ─── Section block wrapper ─────────────────────────────────────────────────────

function SectionBlock({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <div className="bg-n-0 border border-n-200 rounded-md px-6 py-5 mb-4">
      <h3 className="font-serif font-medium text-[18px] text-n-900 tracking-[-0.005em] mb-3">
        {title}
      </h3>
      {children}
    </div>
  )
}

// ─── SOAP textarea ─────────────────────────────────────────────────────────────

function SoapTextarea({
  value,
  onChange,
  placeholder,
  rows,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  rows: number
  disabled: boolean
}): JSX.Element {
  if (disabled) {
    return (
      <p
        className={cn(
          'text-[13.5px] font-sans text-n-700 leading-[1.55] whitespace-pre-wrap min-h-[48px]',
          !value && 'text-n-300',
        )}
      >
        {value || '—'}
      </p>
    )
  }
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full text-[13.5px] font-sans text-n-700 placeholder:text-n-300 leading-[1.55] resize-none focus:outline-none focus:ring-0 bg-transparent"
    />
  )
}

// ─── Protocol run card ─────────────────────────────────────────────────────────

interface ProtocolRunCardProps {
  usage: ConsultationProtocolUsage
  allUsages: ConsultationProtocolUsage[]
  consultationId: string
  isSigned: boolean
  onAppendToSoap: (field: 'objective' | 'assessment' | 'plan', text: string) => void
}

function ProtocolRunCard({
  usage,
  allUsages,
  consultationId,
  isSigned,
  onAppendToSoap,
}: ProtocolRunCardProps): JSX.Element {
  const updateCheckedState = useUpdateCheckedState(consultationId, usage.id)
  const removeUsage = useRemoveProtocolUsage(consultationId)
  const addLinkedUsage = useAddProtocolUsage(consultationId)

  const localKey = `prun-${consultationId}-${usage.id}`

  const [checkedState, setCheckedState] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem(localKey)
      if (stored) {
        return { ...usage.checkedState, ...(JSON.parse(stored) as Record<string, boolean>) }
      }
    } catch {
      // ignore parse errors
    }
    return usage.checkedState
  })

  const [isRestored, setIsRestored] = useState(() => {
    try {
      return !!localStorage.getItem(localKey)
    } catch {
      return false
    }
  })

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialMount = useRef(true)

  // Debounced server sync
  useEffect(() => {
    if (initialMount.current) {
      initialMount.current = false
      return
    }
    if (isSigned) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      updateCheckedState.mutate(
        { checkedState },
        {
          onSuccess: () => {
            try {
              localStorage.removeItem(localKey)
            } catch {
              // ignore
            }
          },
        },
      )
    }, 800)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [checkedState]) // intentional: only watch checkedState

  // 30s localStorage auto-save
  useEffect(() => {
    if (isSigned) return
    const interval = setInterval(() => {
      try {
        localStorage.setItem(localKey, JSON.stringify(checkedState))
      } catch {
        // ignore storage errors
      }
    }, 30_000)
    return () => clearInterval(interval)
  }, [isSigned, localKey, checkedState])

  // Build ancestor breadcrumb chain
  const ancestors: ConsultationProtocolUsage[] = []
  let current = usage
  while (current.parentUsageId) {
    const parent = allUsages.find((u) => u.id === current.parentUsageId)
    if (!parent) break
    ancestors.unshift(parent)
    current = parent
  }

  const handleCheck = useCallback(
    (id: string, checked: boolean) => {
      if (isSigned) return
      setCheckedState((prev) => ({ ...prev, [id]: checked }))
    },
    [isSigned],
  )

  const handleLaunchLinkedProtocol = useCallback(
    (protocolId: string, triggerBlockId: string) => {
      if (isSigned) return
      addLinkedUsage.mutate({ protocolId, parentUsageId: usage.id, triggerBlockId })
    },
    [isSigned, addLinkedUsage, usage.id],
  )

  const runMode: RunModeProps = {
    checkedState,
    onCheck: handleCheck,
    onLaunchLinkedProtocol: handleLaunchLinkedProtocol,
    ...(isSigned ? {} : { onAutoPopulate: onAppendToSoap }),
  }
  const blocks = usage.content?.blocks ?? []
  const completedCount = Object.values(checkedState).filter(Boolean).length
  const isChild = usage.depth > 0

  return (
    <div
      className={cn(
        'bg-n-0 border border-n-200 rounded-md overflow-hidden mb-4',
        isChild && 'ml-4 border-l-2 border-l-p-100',
      )}
    >
      {/* Breadcrumb chain for child protocols */}
      {ancestors.length > 0 && (
        <div className="flex items-center gap-1 px-5 pt-3 pb-0">
          {ancestors.map((a, i) => (
            <span key={a.id} className="flex items-center gap-1">
              <span className="text-[11px] font-mono text-n-400 truncate max-w-[120px]">
                {a.protocolTitle}
              </span>
              {i < ancestors.length - 1 && (
                <i className="ph ph-caret-right text-[10px] text-n-300" />
              )}
            </span>
          ))}
          <i className="ph ph-caret-right text-[10px] text-n-300" />
        </div>
      )}

      {/* Restore notice */}
      {isRestored && (
        <div className="flex items-center justify-between px-5 py-2 bg-info-bg border-b border-info-border">
          <span className="text-[11.5px] font-sans text-info-text">
            Estado recuperado del almacenamiento local
          </span>
          <button
            type="button"
            onClick={() => setIsRestored(false)}
            className="text-[11px] font-mono text-info-text hover:text-n-700 transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex items-center gap-3 px-5 py-3 bg-n-25 border-b border-n-100">
        <div className="flex-1 min-w-0">
          <div className="text-[10.5px] font-mono uppercase tracking-[0.08em] text-p-700 mb-1">
            {usage.protocolTypeName}
          </div>
          <div className="text-[17px] font-serif font-medium text-n-900 truncate leading-tight">
            {usage.protocolTitle}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {completedCount > 0 && (
            <span className="text-[11px] font-mono text-success-text bg-success-bg border border-success-border rounded px-2 py-1">
              {completedCount} completado{completedCount !== 1 ? 's' : ''}
            </span>
          )}
          <span className="text-[11px] font-mono text-n-400 border border-n-200 rounded px-2 py-1">
            v{usage.versionNumber}
          </span>
          {!isSigned && (
            <button
              type="button"
              onClick={() => removeUsage.mutate(usage.id)}
              className="w-btn-sm h-btn-sm flex items-center justify-center rounded hover:bg-n-100 text-n-400 hover:text-n-700 transition-colors"
              title="Quitar protocolo"
            >
              <i className="ph ph-x text-[14px]" />
            </button>
          )}
        </div>
      </div>
      <div className="px-5 py-4">
        {blocks.length === 0 ? (
          <p className="text-[13px] text-n-400 py-2">Sin bloques.</p>
        ) : (
          <div className="flex flex-col gap-0">
            {blocks.map((block) => (
              <BlockRendererRunMode key={block.id} block={block} runMode={runMode} />
            ))}
          </div>
        )}
      </div>
      {updateCheckedState.isPending && (
        <div className="px-5 py-2 border-t border-n-100 text-[11px] font-mono text-n-400 flex items-center gap-1">
          <i className="ph ph-spinner animate-spin text-[11px]" /> Guardando…
        </div>
      )}
    </div>
  )
}

// ─── Protocol picker modal ─────────────────────────────────────────────────────

function ProtocolPickerModal({
  consultationId,
  existingProtocolIds,
  onClose,
}: {
  consultationId: string
  existingProtocolIds: string[]
  onClose: () => void
}): JSX.Element {
  const { useGetProtocols } = useProtocols()
  const protocols = useGetProtocols({ status: 'active' })
  const addUsage = useAddProtocolUsage(consultationId)
  const [search, setSearch] = useState('')

  const filtered = (protocols.data ?? []).filter(
    (p) =>
      !existingProtocolIds.includes(p.id) && p.title.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <ModalContent>
      <ModalHeader
        title="Aplicar protocolo"
        subtitle="Selecciona un protocolo activo para guiar esta consulta."
      />
      <ModalBody>
        <div className="relative mb-4">
          <i className="ph ph-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-n-400 text-[14px]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar protocolo…"
            className="w-full pl-8 pr-3 h-[34px] text-[13px] font-sans border border-n-300 rounded-sm focus:border-p-500 focus:outline-none bg-n-0"
          />
        </div>
        {protocols.isLoading ? (
          <div className="flex items-center gap-2 py-6 text-[13px] text-n-400 justify-center">
            <i className="ph ph-spinner animate-spin" /> Cargando…
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-[13px] text-n-400 py-4 text-center">
            {search ? 'Sin resultados.' : 'No hay protocolos activos.'}
          </p>
        ) : (
          <div className="flex flex-col gap-1 max-h-[288px] overflow-y-auto">
            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() =>
                  addUsage.mutate({ protocolId: p.id }, { onSuccess: () => onClose() })
                }
                disabled={addUsage.isPending}
                className="flex items-center gap-3 w-full text-left px-3 py-3 rounded border border-n-200 bg-n-0 hover:bg-n-25 transition-colors disabled:opacity-50"
              >
                <i className="ph ph-stack text-[16px] text-p-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-sans font-semibold text-n-800 truncate">
                    {p.title}
                  </div>
                  <div className="text-[11px] font-mono text-n-400 mt-1">{p.typeName}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <ModalClose asChild>
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        </ModalClose>
      </ModalFooter>
    </ModalContent>
  )
}

// ─── Sign modal ────────────────────────────────────────────────────────────────

function SignModal({
  consultationId,
  onClose,
}: {
  consultationId: string
  onClose: () => void
}): JSX.Element {
  const signMutation = useSignConsultation(consultationId)
  return (
    <ModalContent>
      <ModalHeader
        title="Firmar consulta"
        subtitle="Al firmar, la consulta quedará bloqueada. Solo podrá editarse mediante enmiendas."
      />
      <ModalBody>
        <div className="flex items-start gap-3 bg-warning-bg border border-warning-border rounded-md px-4 py-3">
          <i className="ph ph-warning text-[18px] text-warning-text shrink-0 mt-1" />
          <p className="text-[13px] text-warning-text leading-[1.45]">
            Esta acción es irreversible. Verifica que todos los datos sean correctos antes de
            continuar.
          </p>
        </div>
      </ModalBody>
      <ModalFooter>
        <ModalClose asChild>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
        </ModalClose>
        <Button
          variant="primary"
          onClick={() => signMutation.mutate(undefined, { onSuccess: onClose })}
          disabled={signMutation.isPending}
        >
          {signMutation.isPending ? 'Firmando…' : 'Firmar y cerrar'}
        </Button>
      </ModalFooter>
    </ModalContent>
  )
}

// ─── Amendment modal ───────────────────────────────────────────────────────────

function AmendmentModal({
  consultationId,
  onClose,
}: {
  consultationId: string
  onClose: () => void
}): JSX.Element {
  const amendMutation = useAmendConsultation(consultationId)
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  return (
    <ModalContent>
      <ModalHeader
        title="Agregar enmienda"
        subtitle="Las enmiendas quedan registradas junto a la consulta original."
      />
      <ModalBody>
        <div className="flex flex-col gap-4">
          <Field label="Motivo de la enmienda" required>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe la corrección…"
              rows={3}
            />
          </Field>
          <Field label="Notas adicionales (opcional)">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Información corregida o aclarada…"
              rows={3}
            />
          </Field>
          {amendMutation.isError && (
            <p className="text-[12px] text-danger-text">
              No se pudo guardar la enmienda. Inténtalo de nuevo.
            </p>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <ModalClose asChild>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
        </ModalClose>
        <Button
          variant="primary"
          disabled={!reason.trim() || amendMutation.isPending}
          onClick={() =>
            amendMutation.mutate(
              { reason: reason.trim(), ...(notes.trim() ? { plan: notes.trim() } : {}) },
              { onSuccess: onClose },
            )
          }
        >
          {amendMutation.isPending ? 'Guardando…' : 'Guardar enmienda'}
        </Button>
      </ModalFooter>
    </ModalContent>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export function Consulta(): JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: consultation, isLoading, isError } = useConsultation(id!)
  const updateMutation = useUpdateConsultation(id!)

  // ── Local SOAP state ──
  const [chiefComplaint, setChiefComplaint] = useState('')
  const [subjective, setSubjective] = useState('')
  const [objective, setObjective] = useState('')
  const [assessment, setAssessment] = useState('')
  const [plan, setPlan] = useState('')
  const [vitals, setVitals] = useState<LocalVitals>({
    bpSys: '',
    bpDia: '',
    hr: '',
    temp: '',
    spo2: '',
    weight: '',
    height: '',
    resp: '',
  })
  const [diagnoses, setDiagnoses] = useState<string[]>([])
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialized = useRef(false)

  // ── Patient & previous consultations (sidebar data) ──
  const { data: patient } = usePatient(consultation?.patientId ?? '')
  const { data: prevConsultations = [] } = usePatientConsultations(consultation?.patientId ?? '')
  const prevList = prevConsultations.filter((c) => c.id !== id).slice(0, 4)

  // ── Initialize from server data ──
  useEffect(() => {
    if (consultation && !initialized.current) {
      initialized.current = true
      setChiefComplaint(consultation.chiefComplaint ?? '')
      setSubjective(consultation.subjective ?? '')
      setObjective(consultation.objective ?? '')
      setAssessment(consultation.assessment ?? '')
      setPlan(consultation.plan ?? '')
      setVitals(vitalsToLocal(consultation.vitals))
      setDiagnoses(consultation.diagnoses ?? [])
    }
  }, [consultation])

  // ── Build payload for save ──
  const buildPayload = useCallback(
    () => ({
      chiefComplaint: chiefComplaint || null,
      subjective: subjective || null,
      objective: objective || null,
      assessment: assessment || null,
      plan: plan || null,
      vitals: localToVitals(vitals),
      diagnoses,
    }),
    [chiefComplaint, subjective, objective, assessment, plan, vitals, diagnoses],
  )

  // ── Auto-save (debounced) ──
  const triggerAutoSave = useCallback(() => {
    if (!consultation || consultation.status === 'signed') return
    setSaveStatus('dirty')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      setSaveStatus('saving')
      updateMutation.mutate(buildPayload(), {
        onSuccess: () => {
          setSaveStatus('saved')
          setTimeout(() => setSaveStatus('idle'), 2500)
        },
        onError: () => setSaveStatus('dirty'),
      })
    }, 1500)
  }, [consultation, buildPayload, updateMutation])

  // ── Protocol SOAP auto-populate ──
  const handleAppendToSoap = useCallback(
    (field: 'objective' | 'assessment' | 'plan', text: string) => {
      if (field === 'objective') setObjective((prev) => (prev ? `${prev}\n${text}` : text))
      if (field === 'assessment') setAssessment((prev) => (prev ? `${prev}\n${text}` : text))
      if (field === 'plan') setPlan((prev) => (prev ? `${prev}\n${text}` : text))
    },
    [],
  )

  // ── Explicit save (button) ──
  function saveNow(): void {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaveStatus('saving')
    updateMutation.mutate(buildPayload(), {
      onSuccess: () => {
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2500)
      },
      onError: () => setSaveStatus('dirty'),
    })
  }

  // ── Watch fields for dirty state ──
  const skipFirst = useRef(true)
  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false
      return
    }
    if (initialized.current) triggerAutoSave()
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [chiefComplaint, subjective, objective, assessment, plan, vitals, diagnoses, triggerAutoSave])

  // ── Modal state ──
  const [showSign, setShowSign] = useState(false)
  const [showAmend, setShowAmend] = useState(false)
  const [showPicker, setShowPicker] = useState(false)

  // ── Loading / error ──
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="text-[13px] text-n-500 flex items-center gap-2">
          <i className="ph ph-spinner animate-spin" /> Cargando consulta…
        </div>
      </div>
    )
  }

  if (isError || !consultation) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center">
        <i className="ph ph-warning text-[32px] text-n-300 mb-3" />
        <p className="text-[14px] text-n-600 mb-4">No se pudo cargar la consulta.</p>
        <Button variant="secondary" onClick={() => void navigate(-1)}>
          Volver
        </Button>
      </div>
    )
  }

  const isSigned = consultation.status === 'signed'
  const protocolIds = consultation.protocolUsages.map((u) => u.protocolId)
  const pageTitle = chiefComplaint.trim() || 'Nueva consulta'

  return (
    <div className="py-8 px-8 max-w-[1440px]">
      {/* ── Breadcrumb ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-[12.5px] font-sans text-n-500 mb-5">
        <Link to="/pacientes" className="hover:text-n-800 transition-colors">
          Pacientes
        </Link>
        <i className="ph ph-caret-right text-[11px] text-n-300" />
        <button
          type="button"
          onClick={() => void navigate(-1)}
          className="hover:text-n-800 transition-colors"
        >
          {consultation.patientName}
        </button>
        <i className="ph ph-caret-right text-[11px] text-n-300" />
        <span className="text-n-800 font-medium">
          Consulta · {formatDate(consultation.consultedAt)}
        </span>
      </div>

      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-6 mb-6">
        <div className="min-w-0">
          <div className="text-[11.5px] font-mono uppercase tracking-[0.08em] text-n-400 mb-1">
            {formatKicker(consultation.consultedAt, consultation.locationName)}
          </div>
          <h1
            className={cn(
              'text-[28px] font-serif font-medium tracking-[-0.01em] leading-tight mb-1',
              pageTitle === 'Nueva consulta' ? 'text-n-400' : 'text-n-900',
            )}
          >
            {pageTitle}
          </h1>
          <p className="text-[13px] font-sans text-n-500">
            {consultation.patientName} · {consultation.doctorName}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 pt-1">
          <SaveBadge status={saveStatus} />
          {isSigned ? (
            <Button variant="secondary" size="sm" onClick={() => setShowAmend(true)}>
              <i className="ph ph-pencil-simple mr-1" />
              Enmienda
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={saveNow}
                disabled={updateMutation.isPending}
              >
                Guardar borrador
              </Button>
              <Button variant="primary" size="sm" onClick={() => setShowSign(true)}>
                <i className="ph ph-check mr-1" />
                Firmar y cerrar
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Signed banner ────────────────────────────────────────────────────── */}
      {isSigned && consultation.signedAt && (
        <div className="flex items-center gap-2 px-3 py-2 bg-p-50 border border-p-100 rounded-md text-[12.5px] text-p-700 mb-5">
          <i className="ph ph-seal-check text-[14px]" />
          Firmada el {formatDate(consultation.signedAt)} por {consultation.doctorName}
        </div>
      )}

      {/* ── Amendments ───────────────────────────────────────────────────────── */}
      {consultation.amendments.length > 0 && (
        <div className="bg-warning-bg border border-warning-border rounded-md px-4 py-3 mb-5">
          <div className="text-[11px] font-mono uppercase tracking-[0.06em] text-warning-text mb-2">
            {consultation.amendments.length} enmienda
            {consultation.amendments.length !== 1 ? 's' : ''}
          </div>
          {consultation.amendments.map((a) => (
            <div key={a.id} className="text-[12.5px] text-warning-text">
              <span className="font-semibold">#{a.amendmentNumber}</span> — {a.reason}
              <span className="ml-2 text-[11px] opacity-60">{formatDate(a.amendedAt)}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Two-column layout ─────────────────────────────────────────────────── */}
      <div className="grid gap-5" style={{ gridTemplateColumns: '1fr 360px' }}>
        {/* ── LEFT: clinical sections ─────────────────────────────────────────── */}
        <div>
          <SectionBlock title="Motivo de consulta">
            <SoapTextarea
              value={chiefComplaint}
              onChange={setChiefComplaint}
              placeholder="Seguimiento trimestral, motivo de consulta, síntomas principales…"
              rows={2}
              disabled={isSigned}
            />
          </SectionBlock>

          <SectionBlock title="Signos vitales">
            <VitalsSection vitals={vitals} onChange={setVitals} disabled={isSigned} />
          </SectionBlock>

          <SectionBlock title="Subjetivo">
            <SoapTextarea
              value={subjective}
              onChange={setSubjective}
              placeholder="Historia del paciente, síntomas, antecedentes relevantes, contexto clínico…"
              rows={4}
              disabled={isSigned}
            />
          </SectionBlock>

          <SectionBlock title="Examen físico">
            <SoapTextarea
              value={objective}
              onChange={setObjective}
              placeholder="Hallazgos del examen físico, signos clínicos, datos objetivos…"
              rows={4}
              disabled={isSigned}
            />
          </SectionBlock>

          <SectionBlock title="Evaluación">
            <SoapTextarea
              value={assessment}
              onChange={setAssessment}
              placeholder="Impresión diagnóstica, diagnóstico diferencial…"
              rows={3}
              disabled={isSigned}
            />
          </SectionBlock>

          <SectionBlock title="Plan">
            <SoapTextarea
              value={plan}
              onChange={setPlan}
              placeholder="Tratamiento, indicaciones, estudios solicitados, seguimiento…"
              rows={4}
              disabled={isSigned}
            />
          </SectionBlock>

          <SectionBlock title="Diagnósticos">
            <DiagnosesSection diagnoses={diagnoses} onChange={setDiagnoses} disabled={isSigned} />
          </SectionBlock>
        </div>

        {/* ── RIGHT: sidebar ──────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          {/* Patient alerts */}
          {patient && (patient.allergies.length > 0 || patient.chronicConditions.length > 0) && (
            <AsideCard title="Alertas del paciente">
              <div className="flex flex-col gap-2">
                {patient.allergies.map((a) => (
                  <div
                    key={a}
                    className="flex gap-3 px-3 py-3 bg-danger-bg border border-danger-border rounded text-[12.5px] text-danger-text leading-[1.4]"
                  >
                    <i className="ph ph-x-circle text-[16px] shrink-0 mt-1" />
                    <div>
                      <strong>Alergia</strong> · {a}
                    </div>
                  </div>
                ))}
                {patient.chronicConditions.map((c) => (
                  <div
                    key={c}
                    className="flex gap-3 px-3 py-3 bg-warning-bg border border-warning-border rounded text-[12.5px] text-warning-text leading-[1.4]"
                  >
                    <i className="ph ph-warning-circle text-[16px] shrink-0 mt-1" />
                    <div>{c}</div>
                  </div>
                ))}
              </div>
            </AsideCard>
          )}

          {/* Protocols panel */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-mono uppercase tracking-[0.06em] text-n-400">
                Protocolos
                {consultation.protocolUsages.length > 0 && (
                  <span className="ml-2 text-n-500">· {consultation.protocolUsages.length}</span>
                )}
              </span>
              {!isSigned && (
                <button
                  type="button"
                  onClick={() => setShowPicker(true)}
                  className="flex items-center gap-1.5 px-2 py-1 text-[11.5px] font-sans text-n-500 hover:text-n-800 border border-n-200 rounded-sm hover:border-n-400 transition-colors bg-n-0"
                >
                  <i className="ph ph-plus text-[12px]" />
                  Agregar
                </button>
              )}
            </div>
            {consultation.protocolUsages.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 border border-dashed border-n-200 rounded-md text-center">
                <i className="ph ph-stack text-[22px] text-n-400" />
                <p className="text-[12.5px] text-n-400">
                  {isSigned
                    ? 'Sin protocolos aplicados.'
                    : 'Agrega un protocolo para guiar esta consulta.'}
                </p>
              </div>
            ) : (
              <div>
                {consultation.protocolUsages.map((usage) => (
                  <ProtocolRunCard
                    key={usage.id}
                    usage={usage}
                    allUsages={consultation.protocolUsages}
                    consultationId={consultation.id}
                    isSigned={isSigned}
                    onAppendToSoap={handleAppendToSoap}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Previous consultations */}
          {prevList.length > 0 && (
            <AsideCard title="Consultas previas">
              <div className="flex flex-col gap-1">
                {prevList.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => void navigate(`/consultas/${c.id}`)}
                    className="flex items-center justify-between w-full text-left py-2 text-[12.5px] group"
                  >
                    <span className="text-n-700 group-hover:text-n-900 transition-colors truncate flex-1 text-left">
                      {c.chiefComplaint ?? 'Sin motivo'}
                    </span>
                    <span className="font-mono text-n-400 text-[11px] shrink-0 ml-2">
                      {formatDate(c.consultedAt)}
                    </span>
                  </button>
                ))}
              </div>
            </AsideCard>
          )}

          {/* Order queue panel */}
          <OrderQueuePanel consultationId={consultation.id} isSigned={isSigned} />
        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      <Modal open={showSign} onOpenChange={setShowSign}>
        {showSign && (
          <SignModal consultationId={consultation.id} onClose={() => setShowSign(false)} />
        )}
      </Modal>
      <Modal open={showAmend} onOpenChange={setShowAmend}>
        {showAmend && (
          <AmendmentModal consultationId={consultation.id} onClose={() => setShowAmend(false)} />
        )}
      </Modal>
      <Modal open={showPicker} onOpenChange={setShowPicker}>
        {showPicker && (
          <ProtocolPickerModal
            consultationId={consultation.id}
            existingProtocolIds={protocolIds}
            onClose={() => setShowPicker(false)}
          />
        )}
      </Modal>
    </div>
  )
}

// ─── Aside card ────────────────────────────────────────────────────────────────

function AsideCard({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="bg-n-0 border border-n-200 rounded-md p-[18px]">
      <h4 className="text-[11.5px] font-mono uppercase tracking-[0.06em] text-n-700 font-semibold mb-3">
        {title}
      </h4>
      {children}
    </div>
  )
}
