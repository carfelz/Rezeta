import { useState, useRef, useEffect } from 'react'
import type { ConsultationProtocolUsage, ProtocolBlock } from '@rezeta/shared'
import { Caption, Chip, Overline, StepCircle, TextLink } from '@/components/ui'
import { cn } from '@/lib/utils'
import { deriveCheckedState } from '@/lib/consultation/usage'
import { ViewModeToggle } from './ViewModeToggle'
import type { ConsultationViewMode } from '@/store/ui.store'

// ─── Progress helpers ──────────────────────────────────────────────────────────

function collectCheckableIds(blocks: ProtocolBlock[]): string[] {
  const ids: string[] = []
  for (const block of blocks) {
    if (block.type === 'section') {
      ids.push(...collectCheckableIds(block.blocks))
    } else if (block.type === 'checklist') {
      for (const item of block.items) ids.push(item.id)
    } else if (block.type === 'steps') {
      for (const step of block.steps) ids.push(step.id)
    } else if (block.type === 'decision') {
      ids.push(block.id)
    }
  }
  return ids
}

interface StepEntry {
  id: string
  label: string
  subItems: string[]
}

function buildStepEntries(blocks: ProtocolBlock[]): StepEntry[] {
  const sections = blocks.filter(
    (b): b is Extract<ProtocolBlock, { type: 'section' }> => b.type === 'section',
  )
  if (sections.length > 0) {
    return sections.map((block) => ({
      id: block.id,
      label: block.title,
      subItems: collectCheckableIds(block.blocks),
    }))
  }
  return blocks.flatMap((block): StepEntry[] => {
    if (block.type === 'checklist') {
      return block.items.map((item) => ({ id: item.id, label: item.text, subItems: [item.id] }))
    }
    if (block.type === 'steps') {
      return block.steps.map((step) => ({ id: step.id, label: step.title, subItems: [step.id] }))
    }
    return []
  })
}

// ─── Step list popover ─────────────────────────────────────────────────────────

function StepListPopover({
  steps,
  checkedState,
}: {
  steps: StepEntry[]
  checkedState: Record<string, boolean>
}): JSX.Element {
  const stepIsComplete = (step: StepEntry): boolean =>
    step.subItems.length > 0 && step.subItems.every((id) => checkedState[id])

  return (
    <div className="absolute right-0 top-full mt-1 w-72 bg-n-0 border border-n-200 rounded-md shadow-floating z-30 overflow-hidden">
      <div className="px-3 py-2 border-b border-n-100">
        <Overline tone="neutral" size="md">
          Pasos del protocolo
        </Overline>
      </div>
      <div className="max-h-72 overflow-y-auto py-1">
        {steps.map((step, i) => {
          const complete = stepIsComplete(step)
          const partial = step.subItems.filter((id) => checkedState[id]).length
          const hasItems = step.subItems.length > 0
          return (
            <div key={step.id} className="flex items-start gap-3 px-3 py-2 hover:bg-n-25">
              <StepCircle
                status={complete ? 'done' : 'pending'}
                number={i + 1}
                size="sm"
                showCheck={complete}
                aria-label={`Paso ${i + 1} ${complete ? 'completado' : 'pendiente'}`}
                disabled
                className="mt-px"
              />
              <div className="flex-1 min-w-0">
                <div
                  className={cn(
                    'text-[12.5px] font-sans leading-tight',
                    complete ? 'text-n-400 line-through' : 'text-n-800',
                  )}
                >
                  {step.label}
                </div>
                {hasItems && !complete && partial > 0 && (
                  <Caption tone="muted" size="xs" as="div" className="mt-px font-mono">
                    {partial}/{step.subItems.length} ítems
                  </Caption>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Protocol strip ────────────────────────────────────────────────────────────

export interface ProtocolStripProps {
  usage: ConsultationProtocolUsage
  isSigned: boolean
  onChangePicker: () => void
  viewMode?: ConsultationViewMode
  onViewModeChange?: (mode: ConsultationViewMode) => void
  hint?: string
}

export function ProtocolStrip({
  usage,
  isSigned,
  onChangePicker,
  viewMode,
  onViewModeChange,
  hint,
}: ProtocolStripProps): JSX.Element {
  const [stepListOpen, setStepListOpen] = useState(false)
  const stepListRef = useRef<HTMLDivElement>(null)

  const blocks = usage.content?.blocks ?? []
  const steps = buildStepEntries(blocks)
  const checkedState = deriveCheckedState(usage)

  const allCheckableIds = collectCheckableIds(blocks)
  const totalItems = allCheckableIds.length
  const completedItems = allCheckableIds.filter((id) => checkedState[id]).length
  const progressPercent = totalItems > 0 ? (completedItems / totalItems) * 100 : 0

  useEffect(() => {
    if (!stepListOpen) return
    function handleClickOutside(e: MouseEvent): void {
      if (stepListRef.current && !stepListRef.current.contains(e.target as Node)) {
        setStepListOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [stepListOpen])

  return (
    <div className="flex items-center gap-3 px-7 py-[10px] bg-p-50 border-b border-p-100">
      <i className="ph ph-list-checks text-[15px] text-p-700 shrink-0" />
      <div className="text-[12.5px] font-medium text-p-900 shrink-0">
        {usage.protocolTitle}
        <span className="font-mono text-[10px] text-p-700 ml-2">v{usage.versionNumber}</span>
      </div>

      {totalItems > 0 && (
        <div className="flex items-center gap-1 max-w-[380px] flex-1">
          <div className="flex-1 h-[3px] bg-p-100 rounded-[2px] overflow-hidden">
            <div
              className="h-full bg-p-500 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="font-mono text-[10.5px] text-p-700 whitespace-nowrap ml-1">
            {completedItems} / {totalItems}
          </span>
        </div>
      )}

      {hint && (
        <Caption tone="primary" size="xs" className="italic">
          {hint}
        </Caption>
      )}

      {totalItems === 0 && <div className="flex-1" />}

      <div className="flex items-center gap-2 shrink-0">
        {steps.length > 0 && (
          <div className="relative" ref={stepListRef}>
            <Chip
              tone="primary"
              size="md"
              format="sentence"
              asButton
              onClick={() => setStepListOpen(!stepListOpen)}
            >
              Ver pasos
            </Chip>
            {stepListOpen && <StepListPopover steps={steps} checkedState={checkedState} />}
          </div>
        )}
        {!isSigned && (
          <TextLink tone="primary" size="xs" underline="hover" onClick={onChangePicker}>
            Cambiar
          </TextLink>
        )}
        {viewMode && onViewModeChange && (
          <>
            <Overline tone="primary" size="md" className="ml-2 tracking-[0.06em]">
              Vista
            </Overline>
            <ViewModeToggle value={viewMode} onChange={onViewModeChange} />
          </>
        )}
      </div>
    </div>
  )
}
