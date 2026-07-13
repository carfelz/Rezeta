import { useRef } from 'react'
import { ProtocolBlock, ProtocolAlert } from '@/components/ui/ProtocolBlock'
import { Button, Checkbox, Row, SelectableCard, TextLink } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useOrderQueueStore } from '@/store/order-queue.store'
import { VitalsBlock } from './blocks/VitalsBlock'
import { ClinicalNotesBlock } from './blocks/ClinicalNotesBlock'
import type { ProtocolBlock as Block } from './BlockRenderer'
import type { ImagingOrderItem, LabOrderItem } from '@rezeta/shared'
import { blockRendererRunModeStrings } from './strings'
import type { BlockModificationEvent } from '@/lib/consultation/modifications'
import type { ContentEdit } from '@/lib/consultation/content-edits'

export type { BlockModificationEvent }
export type SoapField = 'objective' | 'assessment' | 'plan'

export interface RunModeProps {
  checkedState: Record<string, boolean>
  onCheck: (id: string, checked: boolean) => void
  onModification?: (event: BlockModificationEvent) => void
  onLaunchLinkedProtocol?: (protocolId: string, triggerBlockId: string) => void
  onAutoPopulate?: (field: SoapField, text: string) => void
  onContentEdit?: (blockId: string, edit: ContentEdit) => void
  isSigned?: boolean
}

interface BlockRunModeProps {
  block: unknown
  nested?: boolean
  runMode: RunModeProps
}

function StepsRunMode({
  steps,
  checkedState,
  onCheck,
  onModification,
  onAutoPopulate,
  isSigned,
}: {
  steps: Array<{ id: string; order: number; title: string; detail?: string }>
  checkedState: Record<string, boolean>
  onCheck: (id: string, checked: boolean) => void
  onModification?: (event: BlockModificationEvent) => void
  onAutoPopulate?: (field: SoapField, text: string) => void
  isSigned?: boolean
}): JSX.Element {
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((step) => {
        const state = checkedState[`${step.id}:skipped`]
          ? 'skipped'
          : (checkedState[step.id] ?? false)
            ? 'completed'
            : 'pending'

        return (
          <li
            key={step.id}
            className={cn('flex flex-col gap-2', state !== 'pending' && 'opacity-70')}
          >
            <div className="flex gap-3">
              <span
                className={cn(
                  'font-mono text-xs shrink-0 mt-1 w-5 text-right',
                  state !== 'pending' ? 'text-n-400' : 'text-p-700',
                )}
              >
                {step.order}.
              </span>
              <div className="flex-1">
                <div
                  className={cn(
                    'text-sm font-sans font-semibold text-n-800',
                    state === 'skipped' && 'line-through text-n-400',
                    state === 'completed' && 'text-n-600',
                  )}
                >
                  {step.title}
                </div>
                {step.detail && (
                  <div className="text-xs font-sans text-n-500 mt-1 leading-[1.4]">
                    {step.detail}
                  </div>
                )}
              </div>
              {state === 'completed' && (
                <span className="shrink-0 text-overline font-mono text-success-text bg-success-bg border border-success-border px-2 py-1 rounded-sm h-fit mt-1">
                  {blockRendererRunModeStrings.completedStep}
                </span>
              )}
              {state === 'skipped' && (
                <span className="shrink-0 text-overline font-mono text-n-400 bg-n-50 border border-n-200 px-2 py-1 rounded-sm h-fit mt-1">
                  {blockRendererRunModeStrings.skippedStep}
                </span>
              )}
            </div>
            {state === 'pending' && !isSigned && (
              <Row gap={2} className="ml-8">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    onCheck(step.id, true)
                    onModification?.({ type: 'step_completed', step_id: step.id })
                    onAutoPopulate?.('plan', `✓ ${step.title}`)
                  }}
                  className="text-success-text border-success-border bg-success-bg hover:bg-success-border"
                >
                  {blockRendererRunModeStrings.completedStep}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onCheck(`${step.id}:skipped`, true)}
                >
                  {blockRendererRunModeStrings.skippedStep}
                </Button>
              </Row>
            )}
          </li>
        )
      })}
    </ol>
  )
}

function ChecklistRunMode({
  items,
  checkedState,
  onCheck,
  onAutoPopulate,
  isSigned,
}: {
  items: Array<{ id: string; text: string; critical?: boolean }>
  checkedState: Record<string, boolean>
  onCheck: (id: string, checked: boolean) => void
  onAutoPopulate?: (field: SoapField, text: string) => void
  isSigned?: boolean
}): JSX.Element {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => {
        const done = checkedState[item.id] ?? false
        return (
          <li
            key={item.id}
            className={cn(
              'flex gap-3',
              isSigned ? 'cursor-default' : 'cursor-pointer',
              done && 'opacity-60',
            )}
            onClick={() => {
              if (isSigned) return
              const next = !done
              // onCheck records the checklist_item event upstream — emitting it
              // here too would double-append it to the modifications log.
              onCheck(item.id, next)
              if (next && item.critical) {
                onAutoPopulate?.('objective', `✓ ${item.text}`)
              }
            }}
          >
            <Checkbox
              checked={done}
              onChange={() => {}}
              onClick={(e) => e.stopPropagation()}
              readOnly
              className="shrink-0 mt-1"
            />
            <span
              className={cn(
                'text-sm font-sans text-n-700',
                done && 'line-through text-n-400',
                item.critical && !done && 'font-semibold text-n-800',
              )}
            >
              {item.text}
              {item.critical && (
                <span className="ml-2 text-2xs font-mono text-danger-text uppercase">
                  {blockRendererRunModeStrings.criticalItem}
                </span>
              )}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function DecisionRunMode({
  blockId,
  condition,
  branches,
  checkedState,
  onCheck,
  onModification,
  onLaunchLinkedProtocol,
  onAutoPopulate,
  isSigned,
}: {
  blockId: string
  condition: string
  branches: Array<{ id: string; label: string; action: string; linked_protocol_id?: string }>
  checkedState: Record<string, boolean>
  onCheck: (id: string, checked: boolean) => void
  onModification?: (event: BlockModificationEvent) => void
  onLaunchLinkedProtocol?: (protocolId: string, triggerBlockId: string) => void
  onAutoPopulate?: (field: SoapField, text: string) => void
  isSigned?: boolean
}): JSX.Element {
  const selectedId = branches.find((b) => checkedState[b.id])?.id ?? null
  return (
    <div>
      <div className="text-sm font-sans font-semibold text-n-800 mb-3 pb-3 border-b border-n-100">
        {condition}
      </div>
      <div className="flex flex-col gap-2">
        {branches.map((branch) => {
          const selected = checkedState[branch.id] ?? false
          return (
            <div key={branch.id} className="flex flex-col gap-2">
              <SelectableCard
                density="standard"
                state={selected ? 'selected' : 'default'}
                onClick={
                  isSigned
                    ? undefined
                    : () => {
                        const wasSelected = selected
                        branches.forEach((b) => {
                          if (b.id !== branch.id && checkedState[b.id]) onCheck(b.id, false)
                        })
                        onCheck(branch.id, !selected)
                        if (!wasSelected) {
                          onModification?.({
                            type: 'decision_branch',
                            decision_id: blockId,
                            branch_id: branch.id,
                            linked_protocol_launched: Boolean(branch.linked_protocol_id),
                          })
                          onAutoPopulate?.('assessment', branch.action)
                        }
                      }
                }
              >
                <span
                  className={cn(
                    'text-overline font-mono font-medium px-2 py-1 rounded-sm shrink-0 h-fit mt-1',
                    selected
                      ? 'bg-p-500 text-n-0 border border-p-500'
                      : 'bg-p-50 text-p-700 border border-p-100',
                  )}
                >
                  {branch.label}
                </span>
                <div className="text-sm leading-[1.45] flex-1">{branch.action}</div>
              </SelectableCard>
              {selected && branch.linked_protocol_id && onLaunchLinkedProtocol && (
                <TextLink
                  tone="primary"
                  size="md"
                  onClick={() => onLaunchLinkedProtocol(branch.linked_protocol_id!, blockId)}
                  className="ml-3"
                >
                  <i className="ph ph-arrow-square-out text-base" />
                  {blockRendererRunModeStrings.openLinkedProtocol}
                </TextLink>
              )}
            </div>
          )
        })}
      </div>
      {selectedId && (
        <TextLink
          tone="neutral"
          size="sm"
          onClick={() => branches.forEach((b) => onCheck(b.id, false))}
          className="mt-2 font-mono"
        >
          {blockRendererRunModeStrings.clearSelection}
        </TextLink>
      )}
    </div>
  )
}

function ImagingOrderRunMode({
  orders,
  onModification,
  onAutoPopulate,
  isSigned,
}: {
  orders: ImagingOrderItem[]
  onModification?: (event: BlockModificationEvent) => void
  onAutoPopulate?: (field: SoapField, text: string) => void
  isSigned?: boolean
}): JSX.Element {
  const queueImagingOrder = useOrderQueueStore((s) => s.queueImagingOrder)
  return (
    <div className="flex flex-col gap-2">
      {orders.map((order) => (
        <div
          key={order.id}
          className="flex items-start justify-between gap-3 px-3 py-3 border border-n-200 rounded bg-n-0"
        >
          <div className="flex-1 min-w-0">
            <div className="text-sm font-sans font-semibold text-n-800">{order.study_type}</div>
            <div className="text-xs font-sans text-n-500 mt-1">{order.indication}</div>
            {order.urgency !== 'routine' && (
              <span className="text-overline font-mono uppercase text-warning-text bg-warning-bg border border-warning-border px-2 py-1 rounded-sm mt-1 inline-block">
                {order.urgency}
              </span>
            )}
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="shrink-0"
            disabled={isSigned}
            onClick={() => {
              queueImagingOrder({
                study_type: order.study_type,
                indication: order.indication,
                urgency: order.urgency,
                contrast: order.contrast,
                fasting_required: order.fasting_required,
                ...(order.special_instructions !== undefined
                  ? { special_instructions: order.special_instructions }
                  : {}),
                source: `protocol:${order.id}`,
              })
              onModification?.({
                type: 'imaging_queued',
                order_id: order.id,
                study_type: order.study_type,
              })
              onAutoPopulate?.('plan', `Imagen: ${order.study_type}`)
            }}
          >
            {blockRendererRunModeStrings.addToOrders}
          </Button>
        </div>
      ))}
    </div>
  )
}

function DosageTableRunMode({
  blockId,
  rows,
  onModification,
  onAutoPopulate,
  isSigned,
}: {
  blockId: string
  rows: Array<{
    id: string
    drug: string
    dose: string
    route: string
    frequency: string
    notes: string
  }>
  onModification?: (event: BlockModificationEvent) => void
  onAutoPopulate?: (field: SoapField, text: string) => void
  isSigned?: boolean
}): JSX.Element {
  const queueMedication = useOrderQueueStore((s) => s.queueMedication)
  const queuedMedications = useOrderQueueStore((s) => s.medications)
  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => {
        const source = `protocol:${row.id}`
        const alreadyQueued = queuedMedications.some((m) => m.source === source)
        return (
          <div
            key={row.id}
            className="flex items-start justify-between gap-3 px-3 py-3 border border-n-200 rounded bg-n-0"
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-sans font-semibold text-n-800">{row.drug}</div>
              <div className="text-xs font-mono text-n-500 mt-1">
                {row.dose} · {row.route} · {row.frequency}
              </div>
              {row.notes && (
                <div className="text-xs font-sans text-n-500 mt-1 italic">{row.notes}</div>
              )}
            </div>
            {alreadyQueued ? (
              <span className="shrink-0 text-xs font-mono text-success-text bg-success-bg border border-success-border px-3 py-1 rounded-sm">
                {blockRendererRunModeStrings.alreadyQueued}
              </span>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                className="shrink-0"
                disabled={isSigned}
                onClick={() => {
                  queueMedication({
                    drug: row.drug,
                    dose: row.dose,
                    route: row.route,
                    frequency: row.frequency,
                    duration: '',
                    ...(row.notes ? { notes: row.notes } : {}),
                    source,
                  })
                  onModification?.({
                    type: 'medication_queued',
                    block_id: blockId,
                    row_id: row.id,
                    drug: row.drug,
                    dose: row.dose,
                    route: row.route,
                    frequency: row.frequency,
                    ...(row.notes ? { notes: row.notes } : {}),
                  })
                  onAutoPopulate?.('plan', `${row.drug} ${row.dose}`)
                }}
              >
                {blockRendererRunModeStrings.addToPrescription}
              </Button>
            )}
          </div>
        )
      })}
    </div>
  )
}

type VitalsFieldDef = {
  id: string
  label: string
  unit?: string
  input_type: 'text' | 'number' | 'computed'
  formula?: string
}

/**
 * Recomputes BMI inline when the block defines a `bmi` field with
 * `input_type: 'computed'` and both `weight`/`height` hold positive numeric
 * values. Returns `nextValues` with `bmi` set to one decimal place, or with
 * `bmi` cleared (omitted) when weight/height aren't both positive numbers
 * (guards against falsy/zero weight/height so `0` doesn't divide).
 */
function withDerivedBMI(
  fields: VitalsFieldDef[],
  nextValues: Record<string, string | number>,
): Record<string, string | number> {
  const bmiField = fields.find((f) => f.id === 'bmi' && f.input_type === 'computed')
  if (!bmiField) return nextValues

  const weight = parseFloat(String(nextValues.weight ?? ''))
  const height = parseFloat(String(nextValues.height ?? ''))
  const result = { ...nextValues }
  if (!isNaN(weight) && !isNaN(height) && weight > 0 && height > 0) {
    const bmi = weight / Math.pow(height / 100, 2)
    result.bmi = bmi.toFixed(1)
  } else {
    delete result.bmi
  }
  return result
}

/**
 * Rounds every parseable-as-number value in `values` to at most 2 decimal
 * places, fixing float artifacts (e.g. `81.4000015258789` from a browser's
 * number input) at commit time. Must only run on blur, never per keystroke —
 * rounding mid-edit would mangle values the user is still typing (e.g.
 * turning "81." into "81" and dropping the decimal point they just typed).
 * Non-numeric or empty values (including the computed `bmi`, already capped
 * to 1 decimal by `withDerivedBMI`) pass through unchanged. Returns the same
 * object reference when nothing needed rounding, so callers can skip a
 * redundant `onContentEdit` re-propagation.
 */
function normalizeVitalsValues(
  values: Record<string, string | number>,
): Record<string, string | number> {
  let changed = false
  const result: Record<string, string | number> = { ...values }
  for (const [key, raw] of Object.entries(values)) {
    const str = String(raw).trim()
    if (str === '' || Number.isNaN(Number(str))) continue
    const rounded = String(Math.round(parseFloat(str) * 100) / 100)
    if (rounded !== String(raw)) {
      result[key] = rounded
      changed = true
    }
  }
  return changed ? result : values
}

function VitalsRunMode({
  blockId,
  fields,
  values,
  onModification,
  onContentEdit,
  isSigned,
}: {
  blockId: string
  fields: VitalsFieldDef[]
  values: Record<string, string | number>
  onModification?: (event: BlockModificationEvent) => void
  onContentEdit?: (blockId: string, edit: ContentEdit) => void
  isSigned?: boolean
}): JSX.Element {
  // Tracks the latest merged values across an editing burst so the blur
  // handler (which fires once per field, not per keystroke) can emit a
  // single `vitals_entered` modification event with the final values.
  // `onChange` alone would fire per keystroke, and `onModification` must
  // only ever append once per burst. This can't just read the `values` prop
  // at blur time: the parent only re-renders with the merged values once its
  // own state updates (e.g. usePendingModifications' recordContentEdit),
  // which may not have happened yet in the same tick as a fast burst, so the
  // ref is updated directly from every onChange call as the source of truth
  // for "what should flush on blur." `onContentEdit` still fires on every
  // change so the buffered edit (last-write-wins per block) always reflects
  // the latest keystroke even if the field never blurs before a flush.
  const latestValues = useRef(values)
  latestValues.current = values

  // True only when at least one onChange fired since the last emitted (or
  // reset) modification event. Focusing a field and clicking away with no
  // edit must NOT append a `vitals_entered` event to the append-only
  // modifications audit trail — only an actual change should.
  const dirtySinceLastEmit = useRef(false)

  return (
    <div
      onBlur={(event) => {
        if (isSigned) return
        // The block has multiple fields (weight, height, ...), and
        // blur/focusout bubbles per field — so tabbing from weight to height
        // fires this handler once for each field transition, not once per
        // burst. `appendModification` appends raw with no dedup, so without
        // this guard we'd multiply-emit one `vitals_entered` event per field
        // the user tabs through. Skip emission when focus is moving to
        // another element still inside this block (relatedTarget is
        // contained by currentTarget); only emit once focus actually leaves
        // the block, which is the standard focusout-coalescing pattern.
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
        if (!dirtySinceLastEmit.current) return
        const normalized = normalizeVitalsValues(latestValues.current)
        if (normalized !== latestValues.current) {
          latestValues.current = normalized
          onContentEdit?.(blockId, { kind: 'vitals', values: normalized })
        }
        onModification?.({
          type: 'vitals_entered',
          block_id: blockId,
          values: latestValues.current,
        })
        dirtySinceLastEmit.current = false
      }}
    >
      <VitalsBlock
        fields={fields}
        values={values}
        {...(isSigned !== undefined ? { readOnly: isSigned } : {})}
        onChange={(fieldId, raw) => {
          // Defense in depth: `VitalsBlock`'s disabled `<input>` shouldn't
          // fire onChange in a real browser, but guard explicitly anyway —
          // isSigned must never propagate an edit or modification event.
          if (isSigned) return
          const merged = withDerivedBMI(fields, { ...latestValues.current, [fieldId]: raw })
          latestValues.current = merged
          dirtySinceLastEmit.current = true
          onContentEdit?.(blockId, { kind: 'vitals', values: merged })
        }}
      />
    </div>
  )
}

function ClinicalNotesRunMode({
  blockId,
  label,
  content,
  required,
  onModification,
  onContentEdit,
  isSigned,
}: {
  blockId: string
  label: string
  content: string
  required?: boolean
  onModification?: (event: BlockModificationEvent) => void
  onContentEdit?: (blockId: string, edit: ContentEdit) => void
  isSigned?: boolean
}): JSX.Element {
  // Same burst-coalescing rationale as VitalsRunMode: onChange propagates
  // every keystroke via onContentEdit, but onModification (notes_edited)
  // fires once, on blur, with the final content length. The ref is updated
  // directly in onChange (not just synced from the `content` prop) so blur
  // reflects the latest keystroke even if the parent hasn't re-rendered with
  // it yet. Unlike VitalsRunMode, this block wraps a single textarea, so
  // blur/focusout can only fire once for this block (there's no sibling
  // field to tab between) — the relatedTarget/currentTarget.contains guard
  // used there isn't needed here.
  const latestContent = useRef(content)
  latestContent.current = content

  // True only when at least one onChange fired since the last emitted (or
  // reset) modification event. Focusing the textarea and blurring with no
  // edit must NOT append a `notes_edited` event to the append-only
  // modifications audit trail — only an actual change should.
  const dirtySinceLastEmit = useRef(false)

  return (
    <div
      onBlur={() => {
        if (isSigned) return
        if (!dirtySinceLastEmit.current) return
        onModification?.({
          type: 'notes_edited',
          block_id: blockId,
          length: latestContent.current.length,
        })
        dirtySinceLastEmit.current = false
      }}
    >
      <ClinicalNotesBlock
        label={label}
        content={content}
        {...(required !== undefined ? { required } : {})}
        {...(isSigned !== undefined ? { readOnly: isSigned } : {})}
        onChange={(nextContent) => {
          // Defense in depth, same rationale as VitalsRunMode above.
          if (isSigned) return
          latestContent.current = nextContent
          dirtySinceLastEmit.current = true
          onContentEdit?.(blockId, { kind: 'notes', content: nextContent })
        }}
      />
    </div>
  )
}

function LabOrderRunMode({
  orders,
  onModification,
  onAutoPopulate,
  isSigned,
}: {
  orders: LabOrderItem[]
  onModification?: (event: BlockModificationEvent) => void
  onAutoPopulate?: (field: SoapField, text: string) => void
  isSigned?: boolean
}): JSX.Element {
  const queueLabOrder = useOrderQueueStore((s) => s.queueLabOrder)
  return (
    <div className="flex flex-col gap-2">
      {orders.map((order) => (
        <div
          key={order.id}
          className="flex items-start justify-between gap-3 px-3 py-3 border border-n-200 rounded bg-n-0"
        >
          <div className="flex-1 min-w-0">
            <div className="text-sm font-sans font-semibold text-n-800">{order.test_name}</div>
            <div className="text-xs font-sans text-n-500 mt-1">{order.indication}</div>
            {order.urgency !== 'routine' && (
              <span className="text-overline font-mono uppercase text-warning-text bg-warning-bg border border-warning-border px-2 py-1 rounded-sm mt-1 inline-block">
                {order.urgency}
              </span>
            )}
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="shrink-0"
            disabled={isSigned}
            onClick={() => {
              queueLabOrder({
                test_name: order.test_name,
                ...(order.test_code !== undefined ? { test_code: order.test_code } : {}),
                indication: order.indication,
                urgency: order.urgency,
                fasting_required: order.fasting_required,
                sample_type: order.sample_type,
                ...(order.special_instructions !== undefined
                  ? { special_instructions: order.special_instructions }
                  : {}),
                source: `protocol:${order.id}`,
              })
              onModification?.({
                type: 'lab_queued',
                order_id: order.id,
                test_name: order.test_name,
              })
              onAutoPopulate?.('plan', `Lab: ${order.test_name}`)
            }}
          >
            {blockRendererRunModeStrings.addToOrders}
          </Button>
        </div>
      ))}
    </div>
  )
}

export function BlockRendererRunMode({
  block,
  nested = false,
  runMode,
}: BlockRunModeProps): JSX.Element | null {
  const b = block as Block
  const {
    checkedState,
    onCheck,
    onLaunchLinkedProtocol,
    onAutoPopulate,
    isSigned,
    onModification,
    onContentEdit,
  } = runMode

  switch (b.type) {
    case 'section':
      return (
        <ProtocolBlock
          type={blockRendererRunModeStrings.sectionType}
          title={b.title}
          nested={nested}
        >
          {b.blocks.length > 0 ? (
            <div className="flex flex-col gap-0">
              {b.blocks.map((child) => (
                <BlockRendererRunMode key={child.id} block={child} nested runMode={runMode} />
              ))}
            </div>
          ) : null}
        </ProtocolBlock>
      )

    case 'text':
      return (
        <ProtocolBlock
          type={blockRendererRunModeStrings.textType}
          title={blockRendererRunModeStrings.textType}
          nested={nested}
        >
          <p className="text-sm font-sans text-n-700 leading-[1.55] whitespace-pre-wrap">
            {b.content}
          </p>
        </ProtocolBlock>
      )

    case 'checklist':
      return (
        <ProtocolBlock
          type={blockRendererRunModeStrings.checklistType}
          title={b.title ?? blockRendererRunModeStrings.checklistDefaultTitle}
          nested={nested}
        >
          <ChecklistRunMode
            items={b.items}
            checkedState={checkedState}
            onCheck={onCheck}
            {...(onAutoPopulate ? { onAutoPopulate } : {})}
            {...(isSigned !== undefined ? { isSigned } : {})}
          />
        </ProtocolBlock>
      )

    case 'steps':
      return (
        <ProtocolBlock
          type={blockRendererRunModeStrings.stepsType}
          title={b.title ?? blockRendererRunModeStrings.stepsDefaultTitle}
          nested={nested}
        >
          <StepsRunMode
            steps={b.steps}
            checkedState={checkedState}
            onCheck={onCheck}
            {...(onAutoPopulate ? { onAutoPopulate } : {})}
            {...(isSigned !== undefined ? { isSigned } : {})}
            {...(onModification ? { onModification } : {})}
          />
        </ProtocolBlock>
      )

    case 'decision':
      return (
        <ProtocolBlock
          type={blockRendererRunModeStrings.decisionType}
          title={b.condition || blockRendererRunModeStrings.decisionDefaultTitle}
          nested={nested}
        >
          <DecisionRunMode
            blockId={b.id}
            condition={b.condition}
            branches={b.branches}
            checkedState={checkedState}
            onCheck={onCheck}
            {...(onLaunchLinkedProtocol ? { onLaunchLinkedProtocol } : {})}
            {...(onAutoPopulate ? { onAutoPopulate } : {})}
            {...(isSigned !== undefined ? { isSigned } : {})}
            {...(onModification ? { onModification } : {})}
          />
        </ProtocolBlock>
      )

    case 'dosage_table':
      return (
        <ProtocolBlock
          type={blockRendererRunModeStrings.dosageType}
          title={b.title ?? blockRendererRunModeStrings.dosageDefaultTitle}
          nested={nested}
        >
          <DosageTableRunMode
            blockId={b.id}
            rows={b.rows}
            {...(onAutoPopulate ? { onAutoPopulate } : {})}
            {...(isSigned !== undefined ? { isSigned } : {})}
            {...(onModification ? { onModification } : {})}
          />
        </ProtocolBlock>
      )

    case 'alert':
      return (
        <ProtocolBlock
          type={blockRendererRunModeStrings.alertType}
          title={b.title ?? blockRendererRunModeStrings.alertDefaultTitle}
          nested={nested}
        >
          <ProtocolAlert
            severity={b.severity}
            content={b.content}
            {...(b.title ? { title: b.title } : {})}
          />
        </ProtocolBlock>
      )

    case 'imaging_order' as Block['type']: {
      const imgBlock = b as unknown as { title?: string; orders: ImagingOrderItem[] }
      return (
        <ProtocolBlock
          type={blockRendererRunModeStrings.imagingType}
          title={imgBlock.title ?? blockRendererRunModeStrings.imagingDefaultTitle}
          nested={nested}
        >
          <ImagingOrderRunMode
            orders={imgBlock.orders}
            {...(onAutoPopulate ? { onAutoPopulate } : {})}
            {...(isSigned !== undefined ? { isSigned } : {})}
            {...(onModification ? { onModification } : {})}
          />
        </ProtocolBlock>
      )
    }

    case 'lab_order' as Block['type']: {
      const labBlock = b as unknown as { title?: string; orders: LabOrderItem[] }
      return (
        <ProtocolBlock
          type={blockRendererRunModeStrings.labType}
          title={labBlock.title ?? blockRendererRunModeStrings.labDefaultTitle}
          nested={nested}
        >
          <LabOrderRunMode
            orders={labBlock.orders}
            {...(onAutoPopulate ? { onAutoPopulate } : {})}
            {...(isSigned !== undefined ? { isSigned } : {})}
            {...(onModification ? { onModification } : {})}
          />
        </ProtocolBlock>
      )
    }

    case 'vitals': {
      // The local `Block` union (from BlockRenderer.tsx) omits `values` on the
      // vitals variant even though the shared runtime schema
      // (ProtocolBlockSchema in packages/shared) carries it — widen locally,
      // matching the imaging/lab_order cast pattern above.
      const vitalsBlock = b as unknown as {
        title?: string
        fields: Array<{
          id: string
          label: string
          unit?: string
          input_type: 'text' | 'number' | 'computed'
          formula?: string
        }>
        values?: Record<string, string | number>
      }
      return (
        <ProtocolBlock
          type={blockRendererRunModeStrings.vitalsType}
          title={vitalsBlock.title ?? blockRendererRunModeStrings.vitalsDefaultTitle}
          nested={nested}
        >
          <VitalsRunMode
            blockId={b.id}
            fields={vitalsBlock.fields}
            values={vitalsBlock.values ?? {}}
            {...(isSigned !== undefined ? { isSigned } : {})}
            {...(onModification ? { onModification } : {})}
            {...(onContentEdit ? { onContentEdit } : {})}
          />
        </ProtocolBlock>
      )
    }

    case 'clinical_notes':
      return (
        <ProtocolBlock type={blockRendererRunModeStrings.clinicalNotesType} nested={nested}>
          <ClinicalNotesRunMode
            blockId={b.id}
            label={b.label}
            content={b.content}
            {...(b.required !== undefined ? { required: b.required } : {})}
            {...(isSigned !== undefined ? { isSigned } : {})}
            {...(onModification ? { onModification } : {})}
            {...(onContentEdit ? { onContentEdit } : {})}
          />
        </ProtocolBlock>
      )

    default:
      return null
  }
}
