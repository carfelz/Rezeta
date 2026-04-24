import { useState } from 'react'
import { ArrowUp, ArrowDown } from '@phosphor-icons/react'
import { useEditorStore } from '@/store/editor.store'
import { strings } from '@/lib/strings'
import { Button } from '@/components/ui'

interface Step {
  id: string
  order: number
  title: string
  detail?: string
}

interface StepsBlockEditorProps {
  id: string
  title?: string | undefined
  steps: Step[]
}

export function StepsBlockEditor({ id, title, steps }: StepsBlockEditorProps): JSX.Element {
  const [draftTitle, setDraftTitle] = useState(title ?? '')
  const [draftSteps, setDraftSteps] = useState<Step[]>(steps)
  const updateBlock = useEditorStore((s) => s.updateBlock)
  const selectBlock = useEditorStore((s) => s.selectBlock)

  const addStep = () => {
    const nextOrder = draftSteps.length + 1
    setDraftSteps((prev) => [
      ...prev,
      { id: `stp_${crypto.randomUUID().slice(0, 8)}`, order: nextOrder, title: '' },
    ])
  }

  const updateStep = (stepId: string, patch: Partial<Step>) => {
    setDraftSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, ...patch } : s)))
  }

  const removeStep = (stepId: string) => {
    setDraftSteps((prev) =>
      prev.filter((s) => s.id !== stepId).map((s, idx) => ({ ...s, order: idx + 1 })),
    )
  }

  const moveStep = (stepId: string, dir: 'up' | 'down') => {
    setDraftSteps((prev) => {
      const idx = prev.findIndex((s) => s.id === stepId)
      if (idx === -1) return prev
      const target = dir === 'up' ? idx - 1 : idx + 1
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[target]] = [next[target]!, next[idx]!]
      return next.map((s, i) => ({ ...s, order: i + 1 }))
    })
  }

  const commit = () => {
    updateBlock(id, (b) => {
      if (b.type !== 'steps') return b
      const trimmed = draftTitle.trim()
      const updated = { ...b, steps: draftSteps }
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
          {strings.EDITOR_STEPS_TITLE_LABEL}
        </label>
        <input
          type="text"
          className="h-[34px] px-3 text-[13px] font-sans border border-n-300 rounded-sm focus:outline-none focus:border-p-500 transition-all duration-[100ms]"
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          placeholder={strings.EDITOR_STEPS_TITLE_PLACEHOLDER}
        />
      </div>

      {/* Steps */}
      <div className="flex flex-col gap-1">
        <label className="text-[12px] font-sans font-medium text-n-600">
          {strings.EDITOR_STEPS_ITEMS_LABEL}
        </label>
        <div className="flex flex-col gap-2">
          {draftSteps.map((step, idx) => (
            <div key={step.id} className="flex gap-2 items-start">
              {/* Order number */}
              <span className="text-[11px] font-mono text-n-400 mt-[9px] w-5 shrink-0 text-right">
                {idx + 1}.
              </span>

              {/* Fields */}
              <div className="flex-1 flex flex-col gap-1">
                <input
                  type="text"
                  className="h-[30px] px-2 text-[13px] font-sans border border-n-300 rounded-sm focus:outline-none focus:border-p-500 transition-all duration-[100ms]"
                  value={step.title}
                  onChange={(e) => updateStep(step.id, { title: e.target.value })}
                  placeholder={strings.EDITOR_STEPS_STEP_TITLE_PLACEHOLDER}
                  autoFocus={idx === draftSteps.length - 1 && step.title === ''}
                />
                <input
                  type="text"
                  className="h-[28px] px-2 text-[12px] font-sans text-n-500 border border-n-200 rounded-sm focus:outline-none focus:border-p-500 transition-all duration-[100ms]"
                  value={step.detail ?? ''}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val) {
                      updateStep(step.id, { detail: val })
                    } else {
                      setDraftSteps((prev) =>
                        prev.map((s) => {
                          if (s.id !== step.id) return s
                          const next = { ...s }
                          delete next.detail
                          return next
                        }),
                      )
                    }
                  }}
                  placeholder={strings.EDITOR_STEPS_STEP_DETAIL_PLACEHOLDER}
                />
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-0.5 shrink-0 mt-0.5">
                <button
                  onClick={() => moveStep(step.id, 'up')}
                  disabled={idx === 0}
                  className="w-6 h-6 flex items-center justify-center text-n-400 hover:text-n-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-[100ms]"
                  title={strings.TEMPLATE_EDITOR_MOVE_UP}
                >
                  <ArrowUp size={12} />
                </button>
                <button
                  onClick={() => moveStep(step.id, 'down')}
                  disabled={idx === draftSteps.length - 1}
                  className="w-6 h-6 flex items-center justify-center text-n-400 hover:text-n-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-[100ms]"
                  title={strings.TEMPLATE_EDITOR_MOVE_DOWN}
                >
                  <ArrowDown size={12} />
                </button>
                <button
                  onClick={() => removeStep(step.id)}
                  disabled={draftSteps.length === 1}
                  className="w-6 h-6 flex items-center justify-center text-n-400 hover:text-danger-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-[100ms]"
                  title={strings.EDITOR_STEPS_REMOVE_STEP}
                >
                  <i className="ph ph-x text-[12px]" />
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={addStep}
          className="mt-1 text-[12px] font-sans text-p-500 hover:text-p-700 self-start transition-colors duration-[100ms]"
        >
          {strings.EDITOR_STEPS_ADD_STEP}
        </button>
      </div>

      <div className="flex items-center gap-2 justify-end">
        <Button variant="secondary" size="sm" onClick={cancel}>
          {strings.EDITOR_BLOCK_CANCEL}
        </Button>
        <Button variant="primary" size="sm" onClick={commit} disabled={draftSteps.length === 0}>
          {strings.EDITOR_BLOCK_APPLY}
        </Button>
      </div>
    </div>
  )
}
