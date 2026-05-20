import { useState } from 'react'
import { useEditorStore } from '@/store/editor.store'
import { blockEditorStrings } from './strings'
import { Button, Field, IconButton, Input, Row, Stack, TextLink } from '@/components/ui'

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

  const addStep = (): void => {
    const nextOrder = draftSteps.length + 1
    setDraftSteps((prev) => [
      ...prev,
      { id: `stp_${crypto.randomUUID().slice(0, 8)}`, order: nextOrder, title: '' },
    ])
  }

  const updateStep = (stepId: string, patch: Partial<Step>): void => {
    setDraftSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, ...patch } : s)))
  }

  const removeStep = (stepId: string): void => {
    setDraftSteps((prev) =>
      prev.filter((s) => s.id !== stepId).map((s, idx) => ({ ...s, order: idx + 1 })),
    )
  }

  const moveStep = (stepId: string, dir: 'up' | 'down'): void => {
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

  const commit = (): void => {
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

  const cancel = (): void => selectBlock(null)

  return (
    <Stack gap={3} className="p-4">
      <Field label={blockEditorStrings.stepsTitleLabel}>
        <Input
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          placeholder={blockEditorStrings.stepsTitlePlaceholder}
        />
      </Field>

      <Field label={blockEditorStrings.stepsItemsLabel}>
        <Stack gap={2}>
          {draftSteps.map((step, idx) => (
            <Row key={step.id} gap={2} align="start">
              <span className="text-[11px] font-mono text-n-400 mt-[9px] w-5 shrink-0 text-right">
                {idx + 1}.
              </span>
              <Stack gap={1} className="flex-1">
                <Input
                  value={step.title}
                  onChange={(e) => updateStep(step.id, { title: e.target.value })}
                  placeholder={blockEditorStrings.stepsStepTitlePlaceholder}
                  autoFocus={idx === draftSteps.length - 1 && step.title === ''}
                />
                <Input
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
                  placeholder={blockEditorStrings.stepsStepDetailPlaceholder}
                />
              </Stack>
              <Stack gap={1} className="shrink-0 mt-1">
                <IconButton
                  icon="ph ph-arrow-up"
                  aria-label={blockEditorStrings.stepsMoveUp}
                  tone="neutral"
                  size="sm"
                  disabled={idx === 0}
                  onClick={() => moveStep(step.id, 'up')}
                />
                <IconButton
                  icon="ph ph-arrow-down"
                  aria-label={blockEditorStrings.stepsMoveDown}
                  tone="neutral"
                  size="sm"
                  disabled={idx === draftSteps.length - 1}
                  onClick={() => moveStep(step.id, 'down')}
                />
                <IconButton
                  icon="ph ph-x"
                  aria-label={blockEditorStrings.stepsRemoveStep}
                  tone="danger"
                  size="sm"
                  disabled={draftSteps.length === 1}
                  onClick={() => removeStep(step.id)}
                />
              </Stack>
            </Row>
          ))}
        </Stack>
        <TextLink tone="primary" size="md" onClick={addStep} className="mt-1 self-start">
          {blockEditorStrings.stepsAddStep}
        </TextLink>
      </Field>

      <Row gap={2} justify="end">
        <Button variant="secondary" size="sm" onClick={cancel}>
          {blockEditorStrings.blockCancel}
        </Button>
        <Button variant="primary" size="sm" onClick={commit} disabled={draftSteps.length === 0}>
          {blockEditorStrings.blockApply}
        </Button>
      </Row>
    </Stack>
  )
}
