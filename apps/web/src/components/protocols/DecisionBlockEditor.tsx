import { useState } from 'react'
import { useEditorStore } from '@/store/editor.store'
import { strings } from '@/lib/strings'
import {
  Button,
  Field,
  IconButton,
  Input,
  Overline,
  Row,
  Stack,
  Textarea,
  TextLink,
} from '@/components/ui'

interface Branch {
  id: string
  label: string
  action: string
}

interface DecisionBlockEditorProps {
  id: string
  condition: string
  branches: Branch[]
}

export function DecisionBlockEditor({
  id,
  condition,
  branches,
}: DecisionBlockEditorProps): JSX.Element {
  const [draftCondition, setDraftCondition] = useState(condition)
  const [draftBranches, setDraftBranches] = useState<Branch[]>(branches)
  const updateBlock = useEditorStore((s) => s.updateBlock)
  const selectBlock = useEditorStore((s) => s.selectBlock)

  const addBranch = (): void => {
    setDraftBranches((prev) => [
      ...prev,
      { id: `brn_${crypto.randomUUID().slice(0, 8)}`, label: '', action: '' },
    ])
  }

  const updateBranch = (branchId: string, patch: Partial<Branch>): void => {
    setDraftBranches((prev) => prev.map((b) => (b.id === branchId ? { ...b, ...patch } : b)))
  }

  const removeBranch = (branchId: string): void => {
    if (draftBranches.length <= 2) return
    setDraftBranches((prev) => prev.filter((b) => b.id !== branchId))
  }

  const commit = (): void => {
    updateBlock(id, (b) => {
      if (b.type !== 'decision') return b
      return { ...b, condition: draftCondition, branches: draftBranches }
    })
    selectBlock(null)
  }

  const cancel = (): void => selectBlock(null)

  const isValid =
    draftCondition.trim().length > 0 &&
    draftBranches.length >= 2 &&
    draftBranches.every((b) => b.label.trim().length > 0 && b.action.trim().length > 0)

  return (
    <Stack gap={3} className="p-4">
      <Field label={strings.EDITOR_DECISION_CONDITION_LABEL}>
        <Textarea
          rows={3}
          value={draftCondition}
          onChange={(e) => setDraftCondition(e.target.value)}
          placeholder={strings.EDITOR_DECISION_CONDITION_PLACEHOLDER}
          autoFocus
        />
      </Field>

      <Field label={strings.EDITOR_DECISION_BRANCHES_LABEL}>
        <Stack gap={2}>
          {draftBranches.map((branch, idx) => (
            <Stack key={branch.id} gap={2} className="border border-n-200 rounded-sm p-3 bg-n-25">
              <Row gap={2}>
                <Overline tone="neutral" size="sm" className="shrink-0 tracking-[0.05em]">
                  {strings.EDITOR_DECISION_BRANCH_LABEL} {idx + 1}
                </Overline>
                <Input
                  className="flex-1"
                  value={branch.label}
                  onChange={(e) => updateBranch(branch.id, { label: e.target.value })}
                  placeholder={strings.EDITOR_DECISION_BRANCH_LABEL_PLACEHOLDER}
                />
                <IconButton
                  icon="ph ph-x"
                  aria-label={strings.EDITOR_DECISION_REMOVE_BRANCH}
                  tone="danger"
                  size="sm"
                  disabled={draftBranches.length <= 2}
                  onClick={() => removeBranch(branch.id)}
                />
              </Row>
              <Textarea
                rows={2}
                value={branch.action}
                onChange={(e) => updateBranch(branch.id, { action: e.target.value })}
                placeholder={strings.EDITOR_DECISION_BRANCH_ACTION_PLACEHOLDER}
              />
            </Stack>
          ))}
        </Stack>
        <TextLink tone="primary" size="md" onClick={addBranch} className="mt-1 self-start">
          {strings.EDITOR_DECISION_ADD_BRANCH}
        </TextLink>
      </Field>

      <Row gap={2} justify="end">
        <Button variant="secondary" size="sm" onClick={cancel}>
          {strings.EDITOR_BLOCK_CANCEL}
        </Button>
        <Button variant="primary" size="sm" onClick={commit} disabled={!isValid}>
          {strings.EDITOR_BLOCK_APPLY}
        </Button>
      </Row>
    </Stack>
  )
}
