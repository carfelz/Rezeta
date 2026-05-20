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
  IconButton,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import { schedulesStrings } from './strings'

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_LABELS: Record<number, string> = {
  0: schedulesStrings.daySunday,
  1: schedulesStrings.dayMonday,
  2: schedulesStrings.dayTuesday,
  3: schedulesStrings.dayWednesday,
  4: schedulesStrings.dayThursday,
  5: schedulesStrings.dayFriday,
  6: schedulesStrings.daySaturday,
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
          ? schedulesStrings.blockOverlapError
          : err instanceof Error && err.message.includes('SCHEDULE_BLOCK_TIME_INVALID')
            ? schedulesStrings.blockTimeInvalidError
            : schedulesStrings.blockCreateError
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
        <ModalHeader title={schedulesStrings.blockFormTitle} showClose={false} />
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
            <Field label={schedulesStrings.blockDayLabel} required>
              <Select value={dayOfWeek} onValueChange={(v) => setDayOfWeek(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {DAY_LABELS[d]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={schedulesStrings.blockStartTimeLabel} required>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value ? `${e.target.value}:00` : '')}
                  step="900"
                />
              </Field>
              <Field label={schedulesStrings.blockEndTimeLabel} required>
                <Input
                  type="time"
                  value={endTime.slice(0, 5)}
                  onChange={(e) => setEndTime(e.target.value ? `${e.target.value}:00` : '')}
                  step="900"
                />
              </Field>
            </div>
            <Field
              label={schedulesStrings.blockSlotDurationLabel}
              helper={schedulesStrings.blockSlotDurationHelper}
            >
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
              {schedulesStrings.blockCancelButton}
            </Button>
            <Button variant="primary" type="submit" disabled={!canSubmit || createBlock.isPending}>
              {createBlock.isPending
                ? schedulesStrings.blockSavingButton
                : schedulesStrings.blockCreateButton}
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
          ? schedulesStrings.exceptionTimeInvalidError
          : schedulesStrings.exceptionCreateError
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
        <ModalHeader title={schedulesStrings.exceptionFormTitle} showClose={false} />
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
            <Field label={schedulesStrings.exceptionDateLabel} required>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label={schedulesStrings.exceptionTypeLabel} required>
              <Select value={type} onValueChange={(v) => setType(v as 'blocked' | 'available')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="blocked">{schedulesStrings.exceptionTypeBlocked}</SelectItem>
                  <SelectItem value="available">
                    {schedulesStrings.exceptionTypeAvailable}
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label={schedulesStrings.exceptionStartTimeLabel}
                helper={schedulesStrings.exceptionStartTimeHelper}
              >
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  step="900"
                />
              </Field>
              <Field
                label={schedulesStrings.exceptionEndTimeLabel}
                helper={schedulesStrings.exceptionEndTimeHelper}
              >
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  step="900"
                />
              </Field>
            </div>
            <Field
              label={schedulesStrings.exceptionReasonLabel}
              helper={schedulesStrings.exceptionReasonHelper}
            >
              <Input
                type="text"
                placeholder={schedulesStrings.exceptionReasonPlaceholder}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" type="button" onClick={onClose}>
              {schedulesStrings.exceptionCancelButton}
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={!canSubmit || createException.isPending}
            >
              {createException.isPending
                ? schedulesStrings.exceptionSavingButton
                : schedulesStrings.exceptionCreateButton}
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
          {schedulesStrings.slotDurationSuffix}
        </div>
      </div>
      <IconButton
        icon="ph ph-trash"
        aria-label={schedulesStrings.deleteBlockLabel}
        tone="danger"
        size="md"
        onClick={onDelete}
      />
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
            {ex.type === 'blocked'
              ? schedulesStrings.exceptionBlocked
              : schedulesStrings.exceptionAvailable}
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
      <IconButton
        icon="ph ph-trash"
        aria-label={schedulesStrings.deleteExceptionLabel}
        tone="neutral"
        size="sm"
        onClick={onDelete}
      />
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function Schedules(): JSX.Element {
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
        <h1 className="text-h1">{schedulesStrings.pageTitle}</h1>
      </div>

      {locations && locations.length === 0 && (
        <EmptyState
          icon={<i className="ph ph-map-pin" />}
          title={schedulesStrings.noLocations}
          description={schedulesStrings.noLocationsDescription}
          action={
            <Button
              variant="primary"
              onClick={() => window.location.assign('/ajustes/ubicaciones')}
            >
              {schedulesStrings.goToLocationsButton}
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
                <Button
                  key={loc.id}
                  variant={selectedLocationId === loc.id ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setLocationId(loc.id)}
                >
                  {loc.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Weekly blocks */}
          <section className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-h3">{schedulesStrings.weeklyBlocksTitle}</h2>
              <Button variant="secondary" size="sm" onClick={() => setShowBlockModal(true)}>
                <i className="ph ph-plus mr-1.5" />
                {schedulesStrings.addBlockButton}
              </Button>
            </div>
            <div className="bg-n-0 border border-n-200 rounded-md overflow-hidden">
              {blocksLoading && (
                <div className="px-4 py-8 text-center text-n-500 text-body-sm">
                  {schedulesStrings.loading}
                </div>
              )}
              {!blocksLoading && (!blocks || blocks.length === 0) && (
                <div className="px-4 py-8 text-center">
                  <p className="text-[13px] font-serif text-n-800 mb-1">
                    {schedulesStrings.noBlocks}
                  </p>
                  <p className="text-[12px] text-n-500">{schedulesStrings.noBlocksDescription}</p>
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
              <h2 className="text-h3">{schedulesStrings.exceptionsTitle}</h2>
              <Button variant="secondary" size="sm" onClick={() => setShowExceptionModal(true)}>
                <i className="ph ph-plus mr-1.5" />
                {schedulesStrings.addExceptionButton}
              </Button>
            </div>
            <div className="bg-n-0 border border-n-200 rounded-md overflow-hidden">
              {exceptionsLoading && (
                <div className="px-4 py-8 text-center text-n-500 text-body-sm">
                  {schedulesStrings.loading}
                </div>
              )}
              {!exceptionsLoading && (!exceptions || exceptions.length === 0) && (
                <div className="px-4 py-8 text-center">
                  <p className="text-[13px] font-serif text-n-800 mb-1">
                    {schedulesStrings.noExceptions}
                  </p>
                  <p className="text-[12px] text-n-500">
                    {schedulesStrings.noExceptionsDescription}
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
