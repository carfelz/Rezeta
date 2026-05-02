import { useState } from 'react'
import type { ScheduleBlock, ScheduleException } from '@rezeta/shared'
import { useLocations } from '@/hooks/locations/use-locations'
import {
  useGetBlocks,
  useCreateBlock,
  useDeleteBlock,
  useGetExceptions,
  useCreateException,
  useDeleteException,
} from '@/hooks/schedules/use-schedules'
import {
  Button,
  EmptyState,
  Callout,
  Field,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '@/components/ui'

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_LABELS: Record<number, string> = {
  0: 'Domingo',
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
}

// ─── Block Form Modal ─────────────────────────────────────────────────────────

interface BlockFormModalProps {
  locationId: string
  onClose: () => void
}

function BlockFormModal({ locationId, onClose }: BlockFormModalProps) {
  const createBlock = useCreateBlock()
  const [dayOfWeek, setDayOfWeek] = useState('1')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [slotDurationMin, setSlotDurationMin] = useState('30')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await createBlock.mutateAsync({
        locationId,
        dayOfWeek: parseInt(dayOfWeek, 10),
        startTime,
        endTime,
        slotDurationMin: parseInt(slotDurationMin, 10),
      })
      onClose()
    } catch (err: unknown) {
      const msg =
        err instanceof Error && err.message.includes('SCHEDULE_BLOCK_OVERLAP')
          ? 'Ya existe un bloque en ese horario para ese día.'
          : err instanceof Error && err.message.includes('SCHEDULE_BLOCK_TIME_INVALID')
            ? 'La hora de inicio debe ser anterior a la hora de fin.'
            : 'No se pudo crear el bloque. Intenta de nuevo.'
      setError(msg)
    }
  }

  const canSubmit = startTime.length > 0 && endTime.length > 0

  return (
    <Modal
      open={true}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <ModalContent>
        <ModalHeader title="Nuevo bloque de disponibilidad" showClose={false} />
        <form
          onSubmit={(e) => {
            void handleSubmit(e)
          }}
        >
          <ModalBody className="flex flex-col gap-4">
            {error && (
              <Callout
                variant="danger"
                icon={<i className="ph ph-warning" style={{ fontSize: 16 }} />}
              >
                {error}
              </Callout>
            )}
            <Field label="Día de la semana" required>
              <select
                className="w-full h-input-md px-3 border border-n-300 rounded-sm text-body-sm bg-n-0 focus:outline-none focus:border-p-500"
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(e.target.value)}
              >
                {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                  <option key={d} value={d}>
                    {DAY_LABELS[d]}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Hora inicio" required>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value ? `${e.target.value}:00` : '')}
                  step="900"
                />
              </Field>
              <Field label="Hora fin" required>
                <Input
                  type="time"
                  value={endTime.slice(0, 5)}
                  onChange={(e) => setEndTime(e.target.value ? `${e.target.value}:00` : '')}
                  step="900"
                />
              </Field>
            </div>
            <Field label="Duración por turno (min)" helper="Ej. 30 o 60 minutos">
              <Input
                type="number"
                min="15"
                max="120"
                step="15"
                value={slotDurationMin}
                onChange={(e) => setSlotDurationMin(e.target.value)}
              />
            </Field>
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" type="button" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={!canSubmit || createBlock.isPending}>
              {createBlock.isPending ? 'Guardando…' : 'Crear bloque'}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  )
}

// ─── Exception Form Modal ─────────────────────────────────────────────────────

interface ExceptionFormModalProps {
  locationId: string
  onClose: () => void
}

function ExceptionFormModal({ locationId, onClose }: ExceptionFormModalProps) {
  const createException = useCreateException()
  const [date, setDate] = useState('')
  const [type, setType] = useState<'blocked' | 'available'>('blocked')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await createException.mutateAsync({
        locationId,
        date,
        type,
        startTime: startTime ? `${startTime}:00` : null,
        endTime: endTime ? `${endTime}:00` : null,
        reason: reason.trim() || null,
      })
      onClose()
    } catch (err: unknown) {
      const msg =
        err instanceof Error && err.message.includes('SCHEDULE_EXCEPTION_TIME_INVALID')
          ? 'La hora de inicio debe ser anterior a la hora de fin.'
          : 'No se pudo crear la excepción. Intenta de nuevo.'
      setError(msg)
    }
  }

  const canSubmit = date.length > 0

  return (
    <Modal
      open={true}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <ModalContent>
        <ModalHeader title="Nueva excepción de horario" showClose={false} />
        <form
          onSubmit={(e) => {
            void handleSubmit(e)
          }}
        >
          <ModalBody className="flex flex-col gap-4">
            {error && (
              <Callout
                variant="danger"
                icon={<i className="ph ph-warning" style={{ fontSize: 16 }} />}
              >
                {error}
              </Callout>
            )}
            <Field label="Fecha" required>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Tipo" required>
              <select
                className="w-full h-input-md px-3 border border-n-300 rounded-sm text-body-sm bg-n-0 focus:outline-none focus:border-p-500"
                value={type}
                onChange={(e) => setType(e.target.value as 'blocked' | 'available')}
              >
                <option value="blocked">Bloqueado</option>
                <option value="available">Disponible extra</option>
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Hora inicio" helper="Opcional">
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  step="900"
                />
              </Field>
              <Field label="Hora fin" helper="Opcional">
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  step="900"
                />
              </Field>
            </div>
            <Field label="Motivo" helper="Opcional">
              <Input
                type="text"
                placeholder="Ej. Día festivo"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" type="button" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={!canSubmit || createException.isPending}
            >
              {createException.isPending ? 'Guardando…' : 'Crear excepción'}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  )
}

// ─── Block Row ────────────────────────────────────────────────────────────────

function BlockRow({ block, onDelete }: { block: ScheduleBlock; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-n-100 last:border-b-0 hover:bg-n-25">
      <div className="flex-1">
        <div className="text-[13px] font-semibold text-n-800">{DAY_LABELS[block.dayOfWeek]}</div>
        <div className="text-[12px] text-n-500 font-mono">
          {block.startTime.slice(0, 5)} – {block.endTime.slice(0, 5)} · {block.slotDurationMin}{' '}
          min/turno
        </div>
      </div>
      <button
        type="button"
        className="text-n-400 hover:text-danger-text transition-colors p-1 rounded min-h-touch flex items-center justify-center"
        aria-label="Eliminar bloque"
        onClick={onDelete}
      >
        <i className="ph ph-trash" style={{ fontSize: 16 }} />
      </button>
    </div>
  )
}

// ─── Exception Row ────────────────────────────────────────────────────────────

function ExceptionRow({
  exception: ex,
  onDelete,
}: {
  exception: ScheduleException
  onDelete: () => void
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-n-100 last:border-b-0 hover:bg-n-25">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <div className="text-[13px] font-semibold text-n-800">{ex.date}</div>
          <span
            className={`text-[11px] font-mono px-2 py-0.5 rounded-sm border ${
              ex.type === 'blocked'
                ? 'bg-danger-bg border-danger-border text-danger-text'
                : 'bg-success-bg border-success-border text-success-text'
            }`}
          >
            {ex.type === 'blocked' ? 'Bloqueado' : 'Disponible extra'}
          </span>
        </div>
        {(ex.startTime || ex.reason) && (
          <div className="text-[12px] text-n-500 font-mono mt-0.5">
            {ex.startTime && ex.endTime
              ? `${ex.startTime.slice(0, 5)} – ${ex.endTime.slice(0, 5)}`
              : null}
            {ex.startTime && ex.reason ? ' · ' : null}
            {ex.reason}
          </div>
        )}
      </div>
      <button
        type="button"
        className="text-n-400 hover:text-danger-text transition-colors p-1 rounded min-h-touch flex items-center justify-center"
        aria-label="Eliminar excepción"
        onClick={onDelete}
      >
        <i className="ph ph-trash" style={{ fontSize: 16 }} />
      </button>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function Horarios(): JSX.Element {
  const { data: locations } = useLocations()
  const [locationId, setLocationId] = useState<string | undefined>(undefined)
  const [showBlockModal, setShowBlockModal] = useState(false)
  const [showExceptionModal, setShowExceptionModal] = useState(false)

  const { data: blocks, isLoading: blocksLoading } = useGetBlocks(locationId)
  const { data: exceptions, isLoading: exceptionsLoading } = useGetExceptions(
    locationId ? { locationId } : {},
  )
  const deleteBlock = useDeleteBlock()
  const deleteException = useDeleteException()

  const selectedLocationId = locationId ?? locations?.[0]?.id

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-h1">Horario de disponibilidad</h1>
      </div>

      {locations && locations.length === 0 && (
        <EmptyState
          icon={<i className="ph ph-map-pin" />}
          title="No tienes ubicaciones registradas"
          description="Añade una ubicación para gestionar tu horario de disponibilidad."
          action={
            <Button
              variant="primary"
              onClick={() => window.location.assign('/ajustes/ubicaciones')}
            >
              Ir a Ubicaciones
            </Button>
          }
        />
      )}

      {locations && locations.length > 0 && (
        <>
          {/* Location selector */}
          <div className="mb-6">
            <div className="flex flex-wrap gap-2">
              {locations.map((loc) => (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => setLocationId(loc.id)}
                  className={`relative px-3 py-1.5 rounded-sm text-[13px] border transition-colors duration-[100ms] min-h-touch flex items-center ${
                    selectedLocationId === loc.id
                      ? 'bg-p-50 border-p-300 text-p-700 font-medium before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[2px] before:bg-p-500'
                      : 'bg-n-0 border-n-200 text-n-600 hover:bg-n-25'
                  }`}
                >
                  {loc.name}
                </button>
              ))}
            </div>
          </div>

          {/* Weekly blocks */}
          <section className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-h3">Disponibilidad semanal</h2>
              <Button variant="secondary" size="sm" onClick={() => setShowBlockModal(true)}>
                <i className="ph ph-plus mr-1.5" />
                Añadir bloque
              </Button>
            </div>
            <div className="bg-n-0 border border-n-200 rounded-md overflow-hidden">
              {blocksLoading && (
                <div className="px-4 py-8 text-center text-n-500 text-body-sm">Cargando…</div>
              )}
              {!blocksLoading && (!blocks || blocks.length === 0) && (
                <div className="px-4 py-8 text-center">
                  <p className="text-[13px] font-serif text-n-800 mb-1">
                    Sin bloques de disponibilidad
                  </p>
                  <p className="text-[12px] text-n-500">
                    Añade un bloque para definir tu horario semanal.
                  </p>
                </div>
              )}
              {!blocksLoading &&
                blocks &&
                blocks.length > 0 &&
                blocks.map((block) => (
                  <BlockRow
                    key={block.id}
                    block={block}
                    onDelete={() => {
                      void deleteBlock.mutate(block.id)
                    }}
                  />
                ))}
            </div>
          </section>

          {/* Exceptions */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-h3">Excepciones de horario</h2>
              <Button variant="secondary" size="sm" onClick={() => setShowExceptionModal(true)}>
                <i className="ph ph-plus mr-1.5" />
                Añadir excepción
              </Button>
            </div>
            <div className="bg-n-0 border border-n-200 rounded-md overflow-hidden">
              {exceptionsLoading && (
                <div className="px-4 py-8 text-center text-n-500 text-body-sm">Cargando…</div>
              )}
              {!exceptionsLoading && (!exceptions || exceptions.length === 0) && (
                <div className="px-4 py-8 text-center">
                  <p className="text-[13px] font-serif text-n-800 mb-1">
                    Sin excepciones registradas
                  </p>
                  <p className="text-[12px] text-n-500">
                    Añade excepciones para días festivos, vacaciones o disponibilidad extra.
                  </p>
                </div>
              )}
              {!exceptionsLoading &&
                exceptions &&
                exceptions.length > 0 &&
                exceptions.map((ex) => (
                  <ExceptionRow
                    key={ex.id}
                    exception={ex}
                    onDelete={() => {
                      void deleteException.mutate(ex.id)
                    }}
                  />
                ))}
            </div>
          </section>
        </>
      )}

      {showBlockModal && selectedLocationId && (
        <BlockFormModal locationId={selectedLocationId} onClose={() => setShowBlockModal(false)} />
      )}
      {showExceptionModal && selectedLocationId && (
        <ExceptionFormModal
          locationId={selectedLocationId}
          onClose={() => setShowExceptionModal(false)}
        />
      )}
    </div>
  )
}
