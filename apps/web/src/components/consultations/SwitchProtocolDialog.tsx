import { useState } from 'react'
import { useProtocols } from '@/hooks/protocols/use-protocols'
import { useSwitchProtocolUsage } from '@/hooks/consultations/use-consultations'
import { Button, DialogCard, SearchInput, SelectableCard } from '@/components/ui'

export interface SwitchProtocolDialogProps {
  consultationId: string
  currentUsageId: string
  currentProtocolId: string
  currentProtocolTitle: string
  completedSteps: number
  totalSteps: number
  onClose: () => void
}

export function SwitchProtocolDialog({
  consultationId,
  currentUsageId,
  currentProtocolId,
  currentProtocolTitle,
  completedSteps,
  totalSteps,
  onClose,
}: SwitchProtocolDialogProps): JSX.Element {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [keepDraft, setKeepDraft] = useState(true)
  const [search, setSearch] = useState('')

  const { useGetProtocols } = useProtocols()
  const { data: protocols = [] } = useGetProtocols({ status: 'active' })
  const switchMutation = useSwitchProtocolUsage(consultationId)

  const filtered = protocols.filter(
    (p) =>
      p.id !== currentProtocolId &&
      (search === '' || p.title.toLowerCase().includes(search.toLowerCase())),
  )
  const target = protocols.find((p) => p.id === selectedId)

  function handleSwitch(): void {
    if (!selectedId) return
    switchMutation.mutate(
      { usageId: currentUsageId, newProtocolId: selectedId },
      { onSuccess: onClose },
    )
  }

  return (
    <DialogCard
      width="lg"
      overline="Cambio de protocolo"
      overlineTone="warning"
      title={
        target
          ? `Cambiar ${currentProtocolTitle} → ${target.title}`
          : `Cambiar ${currentProtocolTitle}`
      }
      description={`Has completado ${completedSteps} de ${totalSteps} pasos. ${
        target
          ? 'Esto es lo que pasa con el progreso actual:'
          : 'Selecciona el nuevo protocolo abajo.'
      }`}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!selectedId || switchMutation.isPending}
            onClick={handleSwitch}
          >
            {switchMutation.isPending ? 'Cambiando…' : 'Cambiar protocolo'}
          </Button>
        </>
      }
    >
      {!target && (
        <div className="flex flex-col gap-2">
          <SearchInput
            size="sm"
            placeholder="Buscar protocolo…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex flex-col gap-1 max-h-[220px] overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-[12.5px] text-n-400 py-3 text-center">
                {search ? 'Sin resultados.' : 'No hay otros protocolos activos.'}
              </p>
            ) : (
              filtered.map((p) => (
                <SelectableCard key={p.id} density="compact" onClick={() => setSelectedId(p.id)}>
                  <i className="ph ph-stack text-[14px] text-n-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-n-800 truncate">{p.title}</div>
                    <div className="font-mono text-[11px] text-n-400">{p.typeName}</div>
                  </div>
                </SelectableCard>
              ))
            )}
          </div>
        </div>
      )}

      {target && (
        <>
          <div className="border border-n-200 rounded p-4 flex flex-col gap-3 bg-n-25">
            <ImpactRow title="Motivo, vitales, subjetivo" detail="Se conservan — son compatibles" />
            <ImpactRow
              title={`Examen físico (paso ${completedSteps})`}
              detail='Se mueve a "fuera de protocolo"'
            />
            <ImpactRow title="Decisión, tratamiento, etc." detail="Se descartan — no aplican" />
          </div>
          <label className="flex items-center gap-2 mt-4 text-[12.5px] text-n-700 cursor-pointer">
            <input
              type="checkbox"
              checked={keepDraft}
              onChange={(e) => setKeepDraft(e.target.checked)}
              className="w-4 h-4 accent-p-500"
            />
            Conservar borrador del protocolo {currentProtocolTitle} por 24h (puedes volver)
          </label>
        </>
      )}

      {switchMutation.isError && (
        <p className="text-[12px] text-danger-text mt-3">
          No se pudo cambiar el protocolo. Inténtalo de nuevo.
        </p>
      )}
    </DialogCard>
  )
}

function ImpactRow({ title, detail }: { title: string; detail: string }): JSX.Element {
  return (
    <div>
      <div className="text-[13px] font-medium text-n-800">{title}</div>
      <div className="text-[12px] text-n-500 mt-px">{detail}</div>
    </div>
  )
}
