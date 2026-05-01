import { useState } from 'react'
import { useEditorStore } from '@/store/editor.store'
import { strings } from '@/lib/strings'
import { Button } from '@/components/ui'

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

  const addBranch = () => {
    setDraftBranches((prev) => [
      ...prev,
      { id: `brn_${crypto.randomUUID().slice(0, 8)}`, label: '', action: '' },
    ])
  }

  const updateBranch = (branchId: string, patch: Partial<Branch>) => {
    setDraftBranches((prev) => prev.map((b) => (b.id === branchId ? { ...b, ...patch } : b)))
  }

  const removeBranch = (branchId: string) => {
    if (draftBranches.length <= 2) return
    setDraftBranches((prev) => prev.filter((b) => b.id !== branchId))
  }

  const commit = () => {
    updateBlock(id, (b) => {
      if (b.type !== 'decision') return b
      return { ...b, condition: draftCondition, branches: draftBranches }
    })
    selectBlock(null)
  }

  const cancel = () => selectBlock(null)

  const isValid =
    draftCondition.trim().length > 0 &&
    draftBranches.length >= 2 &&
    draftBranches.every((b) => b.label.trim().length > 0 && b.action.trim().length > 0)

  return (
    <div className="p-4 flex flex-col gap-3">
      {/* Condition */}
      <div className="flex flex-col gap-1">
        <label className="text-[12px] font-sans font-medium text-n-600">
          {strings.EDITOR_DECISION_CONDITION_LABEL}
        </label>
        <textarea
          className="w-full min-h-[60px] px-3 py-2 text-[13px] font-sans text-n-700 border border-n-300 rounded-sm resize-vertical focus:outline-none focus:border-p-500 focus:shadow-[0_0_0_3px_rgba(45,87,96,0.12)] transition-all duration-[100ms]"
          value={draftCondition}
          onChange={(e) => setDraftCondition(e.target.value)}
          placeholder={strings.EDITOR_DECISION_CONDITION_PLACEHOLDER}
          autoFocus
        />
      </div>

      {/* Branches */}
      <div className="flex flex-col gap-1">
        <label className="text-[12px] font-sans font-medium text-n-600">
          {strings.EDITOR_DECISION_BRANCHES_LABEL}
        </label>
        <div className="flex flex-col gap-2">
          {draftBranches.map((branch, idx) => (
            <div
              key={branch.id}
              className="border border-n-200 rounded-sm p-3 flex flex-col gap-2 bg-n-25"
            >
              <div className="flex items-center gap-2">
                <span className="text-[10.5px] font-mono text-n-400 uppercase tracking-[0.05em] shrink-0">
                  {strings.EDITOR_DECISION_BRANCH_LABEL} {idx + 1}
                </span>
                <input
                  type="text"
                  className="flex-1 h-[28px] px-2 text-[12.5px] font-sans border border-n-300 rounded-sm focus:outline-none focus:border-p-500 transition-all duration-[100ms]"
                  value={branch.label}
                  onChange={(e) => updateBranch(branch.id, { label: e.target.value })}
                  placeholder={strings.EDITOR_DECISION_BRANCH_LABEL_PLACEHOLDER}
                />
                <button
                  onClick={() => removeBranch(branch.id)}
                  disabled={draftBranches.length <= 2}
                  className="w-6 h-6 flex items-center justify-center text-n-400 hover:text-danger-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-[100ms] shrink-0"
                  title={strings.EDITOR_DECISION_REMOVE_BRANCH}
                >
                  <i className="ph ph-x text-[12px]" />
                </button>
              </div>
              <textarea
                className="w-full min-h-[52px] px-2 py-2 text-[12.5px] font-sans text-n-700 border border-n-300 rounded-sm resize-vertical focus:outline-none focus:border-p-500 transition-all duration-[100ms]"
                value={branch.action}
                onChange={(e) => updateBranch(branch.id, { action: e.target.value })}
                placeholder={strings.EDITOR_DECISION_BRANCH_ACTION_PLACEHOLDER}
              />
            </div>
          ))}
        </div>
        <button
          onClick={addBranch}
          className="mt-1 text-[12px] font-sans text-p-500 hover:text-p-700 self-start transition-colors duration-[100ms]"
        >
          {strings.EDITOR_DECISION_ADD_BRANCH}
        </button>
      </div>

      <div className="flex items-center gap-2 justify-end">
        <Button variant="secondary" size="sm" onClick={cancel}>
          {strings.EDITOR_BLOCK_CANCEL}
        </Button>
        <Button variant="primary" size="sm" onClick={commit} disabled={!isValid}>
          {strings.EDITOR_BLOCK_APPLY}
        </Button>
      </div>
    </div>
  )
}
