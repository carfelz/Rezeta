import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate, Link, useBlocker } from 'react-router-dom'
import {
  Badge,
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '@/components/ui'
import { ProtocolContainer } from '@/components/ui/ProtocolBlock'
import { BlockRenderer } from '@/components/protocols/BlockRenderer'
import { EditorBlockRenderer } from '@/components/protocols/EditorBlockRenderer'
import type { ProtocolBlock } from '@/components/protocols/BlockRenderer'
import { useProtocols } from '@/hooks/protocols/use-protocols'
import { strings } from '@/lib/strings'
import {
  useEditorStore,
  extractRequiredBlockIds,
  saveLocalDraft,
  loadLocalDraft,
  clearLocalDraft,
} from '@/store/editor.store'

// ── Palette config ─────────────────────────────────────────────────────────────

const PALETTE_ITEMS = [
  { type: 'section', icon: 'ph-rows', label: 'Sección', active: true },
  { type: 'text', icon: 'ph-text-t', label: 'Texto', active: true },
  { type: 'checklist', icon: 'ph-check-square', label: 'Lista', active: true },
  { type: 'steps', icon: 'ph-list-numbers', label: 'Pasos', active: true },
  { type: 'decision', icon: 'ph-git-fork', label: 'Decisión', active: true },
  { type: 'dosage_table', icon: 'ph-table', label: 'Dosificación', active: true },
  { type: 'alert', icon: 'ph-warning', label: 'Alerta', active: true },
] as const

const PALETTE_TITLES: Record<string, string> = {
  section: strings.EDITOR_PALETTE_ADD_SECTION,
  text: strings.EDITOR_PALETTE_ADD_TEXT,
  alert: strings.EDITOR_PALETTE_ADD_ALERT,
  checklist: strings.EDITOR_PALETTE_ADD_CHECKLIST,
  steps: strings.EDITOR_PALETTE_ADD_STEPS,
  decision: strings.EDITOR_PALETTE_ADD_DECISION,
  dosage_table: strings.EDITOR_PALETTE_ADD_DOSAGE,
}

function makeid() {
  return `blk_${crypto.randomUUID().slice(0, 8)}`
}

function makeBlock(type: string): ProtocolBlock | null {
  if (type === 'text') {
    return { id: makeid(), type: 'text', content: '' }
  }
  if (type === 'alert') {
    return { id: makeid(), type: 'alert', severity: 'info', content: '' }
  }
  if (type === 'checklist') {
    return {
      id: makeid(),
      type: 'checklist',
      items: [{ id: `itm_${crypto.randomUUID().slice(0, 8)}`, text: '' }],
    }
  }
  if (type === 'steps') {
    return {
      id: makeid(),
      type: 'steps',
      steps: [{ id: `stp_${crypto.randomUUID().slice(0, 8)}`, order: 1, title: '' }],
    }
  }
  if (type === 'decision') {
    return {
      id: makeid(),
      type: 'decision',
      condition: '',
      branches: [
        { id: `brn_${crypto.randomUUID().slice(0, 8)}`, label: 'Sí', action: '' },
        { id: `brn_${crypto.randomUUID().slice(0, 8)}`, label: 'No', action: '' },
      ],
    }
  }
  if (type === 'dosage_table') {
    return {
      id: makeid(),
      type: 'dosage_table',
      columns: ['drug', 'dose', 'route', 'frequency', 'notes'],
      rows: [
        {
          id: `row_${crypto.randomUUID().slice(0, 8)}`,
          drug: '',
          dose: '',
          route: '',
          frequency: '',
          notes: '',
        },
      ],
    }
  }
  return null
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ProtocolEditor(): JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { useGetProtocol, useRenameProtocol, useSaveVersion } = useProtocols()
  const { data: protocol, isLoading, error } = useGetProtocol(id ?? '')
  const { mutate: rename, isPending: isRenaming } = useRenameProtocol(id ?? '')
  const { mutate: saveVersion, isPending: isSaving } = useSaveVersion(id ?? '')

  // Editor store
  const { blocks, isDirty, selectedBlockId, initEditor, insertBlock, markSaved, resetEditor } =
    useEditorStore()

  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [changeSummary, setChangeSummary] = useState('')
  const [draftBanner, setDraftBanner] = useState<{
    blocks: ProtocolBlock[]
    savedAt: number
  } | null>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)

  // ── Initialize editor from server data ────────────────────────────────────

  const initialized = useRef(false)
  useEffect(() => {
    if (!protocol || initialized.current) return
    initialized.current = true

    const serverBlocks = (protocol.currentVersion?.content?.blocks ?? []) as ProtocolBlock[]
    const requiredIds = extractRequiredBlockIds(protocol.templateSchema)

    // Check for a local draft
    const draft = id ? loadLocalDraft(id) : null
    if (draft) {
      setDraftBanner(draft)
      initEditor(id!, serverBlocks, requiredIds)
    } else {
      initEditor(id!, serverBlocks, requiredIds)
    }

    return () => {
      resetEditor()
      initialized.current = false
    }
  }, [protocol?.id])

  // ── Autosave to localStorage every 30s when dirty ─────────────────────────

  const blocksRef = useRef(blocks)
  blocksRef.current = blocks
  const isDirtyRef = useRef(isDirty)
  isDirtyRef.current = isDirty

  useEffect(() => {
    if (!id) return
    const interval = setInterval(() => {
      if (isDirtyRef.current) {
        saveLocalDraft(id, blocksRef.current)
      }
    }, 30_000)
    return () => clearInterval(interval)
  }, [id])

  // ── Navigation guard (unsaved changes) ────────────────────────────────────

  const blocker = useBlocker(isDirty)
  useEffect(() => {
    if (blocker.state === 'blocked') {
      if (window.confirm(strings.EDITOR_NAVIGATE_AWAY)) {
        blocker.proceed()
      } else {
        blocker.reset()
      }
    }
  }, [blocker])

  // ── Guard: missing id ─────────────────────────────────────────────────────

  if (!id) {
    void navigate('/protocolos', { replace: true })
    return <></>
  }

  // ── Loading / error states ────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <i className="ph ph-spinner animate-spin text-[32px] text-n-400" />
      </div>
    )
  }

  if (error || !protocol) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-[14px] font-sans text-n-600">{strings.VIEWER_NOT_FOUND}</p>
        <Link to="/protocolos" className="text-[13px] font-sans text-p-500 hover:text-p-700">
          ← {strings.EDITOR_BACK}
        </Link>
      </div>
    )
  }

  const versionNumber = protocol.currentVersion?.versionNumber ?? 1

  // ── Title editing ─────────────────────────────────────────────────────────

  const startEditing = () => {
    setTitleDraft(protocol.title)
    setEditingTitle(true)
    setTimeout(() => titleInputRef.current?.select(), 0)
  }

  const commitTitle = () => {
    const trimmed = titleDraft.trim()
    if (trimmed.length >= 2 && trimmed !== protocol.title) rename({ title: trimmed })
    setEditingTitle(false)
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commitTitle()
    if (e.key === 'Escape') setEditingTitle(false)
  }

  // ── Save version ──────────────────────────────────────────────────────────

  const handleSaveConfirm = () => {
    const content = {
      version: '1.0',
      template_version: '1.0',
      blocks,
    }
    saveVersion(
      { content, changeSummary: changeSummary.trim() || null },
      {
        onSuccess: () => {
          setSaveModalOpen(false)
          setChangeSummary('')
          markSaved()
          if (id) clearLocalDraft(id)
        },
      },
    )
  }

  // ── Draft banner actions ──────────────────────────────────────────────────

  const applyDraft = () => {
    if (!draftBanner || !id) return
    const requiredIds = extractRequiredBlockIds(protocol.templateSchema)
    initEditor(id, draftBanner.blocks, requiredIds)
    setDraftBanner(null)
  }

  const discardDraft = () => {
    if (id) clearLocalDraft(id)
    setDraftBanner(null)
  }

  // ── Palette click ─────────────────────────────────────────────────────────

  const handlePaletteClick = (type: string) => {
    if (type === 'section') {
      // Sections must always be top-level — never nested inside another section
      const sectionBlock: ProtocolBlock = {
        id: `sec_${crypto.randomUUID().slice(0, 8)}`,
        type: 'section',
        title: '',
        blocks: [],
      }
      // Determine the correct top-level afterId
      const topLevelMatch = blocks.findIndex((b) => b.id === selectedBlockId)
      if (topLevelMatch !== -1) {
        // Selected block is already top-level — insert section after it
        insertBlock(sectionBlock, selectedBlockId)
      } else {
        // Selected block is nested inside a section — insert after its parent section
        let parentSectionId: string | null = null
        for (const b of blocks) {
          if (b.type === 'section' && b.blocks.some((child) => child.id === selectedBlockId)) {
            parentSectionId = b.id
            break
          }
        }
        insertBlock(sectionBlock, parentSectionId)
      }
      return
    }

    const newBlock = makeBlock(type)
    if (!newBlock) return
    insertBlock(newBlock, selectedBlockId)
  }

  return (
    <div className="flex flex-col h-full min-h-0" style={{ height: 'calc(100vh - 56px)' }}>
      {/* ── Draft recovery banner ──────────────────────────────────────────── */}
      {draftBanner && (
        <div className="flex items-center gap-3 px-6 py-2 bg-warning-bg border-b border-warning-border text-[12.5px] font-sans text-warning-text shrink-0">
          <i className="ph ph-clock-counter-clockwise text-[14px]" />
          <span className="flex-1">{strings.EDITOR_DRAFT_RECOVERED}</span>
          <button onClick={applyDraft} className="font-medium hover:underline">
            {strings.EDITOR_DRAFT_USE}
          </button>
          <button onClick={discardDraft} className="hover:underline">
            {strings.EDITOR_DRAFT_DISCARD}
          </button>
        </div>
      )}

      {/* ── Editor top bar ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 px-6 py-3 bg-n-0 border-b border-n-200 shrink-0">
        <Link
          to="/protocolos"
          className="flex items-center gap-1.5 text-[12.5px] font-sans text-n-500 hover:text-n-800 transition-colors duration-[100ms] shrink-0"
        >
          <i className="ph ph-arrow-left text-[14px]" />
          {strings.EDITOR_BACK}
        </Link>

        <div className="w-px h-4 bg-n-200 shrink-0" />

        {/* Title */}
        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <input
              ref={titleInputRef}
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={handleTitleKeyDown}
              className="text-[16px] font-serif font-medium text-n-900 bg-transparent border-b border-p-500 focus:outline-none w-full max-w-[480px] pb-0.5"
              disabled={isRenaming}
            />
          ) : (
            <button
              onClick={startEditing}
              className="text-[16px] font-serif font-medium text-n-900 hover:text-p-700 transition-colors duration-[100ms] truncate max-w-[480px] block text-left"
              title="Haz clic para renombrar"
            >
              {protocol.title}
            </button>
          )}
        </div>

        {/* Dirty indicator */}
        {isDirty && (
          <span className="text-[12px] font-sans text-n-400 shrink-0 italic">
            {strings.EDITOR_UNSAVED}
          </span>
        )}

        {/* Status + version */}
        <Badge variant="draft">{strings.EDITOR_STATUS_DRAFT}</Badge>
        <span className="text-[12px] font-mono text-n-400 shrink-0">
          {strings.EDITOR_VERSION(versionNumber)}
        </span>

        {/* Save button */}
        <Button
          variant="primary"
          size="sm"
          onClick={() => setSaveModalOpen(true)}
          disabled={isSaving}
          className="shrink-0"
        >
          {isSaving ? (
            <>
              <i className="ph ph-spinner animate-spin mr-1.5" />
              {strings.EDITOR_SAVING}
            </>
          ) : (
            strings.EDITOR_SAVE_BUTTON
          )}
        </Button>
      </div>

      {/* ── Three-panel layout ─────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left — Palette */}
        <aside className="w-[116px] shrink-0 bg-n-25 border-r border-n-200 flex flex-col items-center pt-5 gap-1.5">
          <span className="text-[10px] font-mono uppercase tracking-[0.10em] text-n-400 mb-1">
            {strings.EDITOR_PALETTE_TITLE}
          </span>
          {PALETTE_ITEMS.map(({ type, icon, label, active }) =>
            active ? (
              <button
                key={type}
                onClick={() => handlePaletteClick(type)}
                title={PALETTE_TITLES[type] ?? label}
                className="w-full px-2"
              >
                <div className="flex items-center gap-2 px-2 py-1.5 rounded text-n-700 hover:bg-n-100 hover:text-n-900 cursor-pointer transition-colors duration-[100ms] select-none">
                  <i className={`ph ${icon} text-[14px]`} />
                  <span className="text-[11px] font-sans capitalize truncate">{label}</span>
                </div>
              </button>
            ) : (
              <div
                key={type}
                title={strings.EDITOR_PALETTE_DISABLED_TOOLTIP}
                className="w-full px-2"
              >
                <div className="flex items-center gap-2 px-2 py-1.5 rounded text-n-300 cursor-not-allowed select-none">
                  <i className={`ph ${icon} text-[14px]`} />
                  <span className="text-[11px] font-sans capitalize truncate">{label}</span>
                </div>
              </div>
            ),
          )}
        </aside>

        {/* Center — Canvas (editable blocks) */}
        <main className="flex-1 overflow-y-auto bg-n-50 p-6">
          {blocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <i className="ph ph-file-text text-[36px] text-n-300" />
              <p className="text-[13px] font-sans text-n-400 max-w-[28ch]">
                {strings.VIEWER_NO_CONTENT}
              </p>
            </div>
          ) : (
            <div className="max-w-[720px] mx-auto flex flex-col gap-1">
              {blocks.map((block, idx) => (
                <EditorBlockRenderer
                  key={block.id}
                  block={block}
                  isFirst={idx === 0}
                  isLast={idx === blocks.length - 1}
                />
              ))}
            </div>
          )}
        </main>

        {/* Right — Live Preview */}
        <aside className="w-[220px] shrink-0 bg-n-0 border-l border-n-200 overflow-y-auto p-4">
          <div className="text-[10px] font-mono uppercase tracking-[0.10em] text-n-400 mb-3">
            {strings.EDITOR_PREVIEW_TITLE}
          </div>
          <div className="transform scale-[0.62] origin-top-left w-[354px]">
            <ProtocolContainer
              {...(protocol.typeName ? { kicker: protocol.typeName } : {})}
              title={protocol.title}
              meta={strings.EDITOR_VERSION(versionNumber)}
            >
              {blocks.map((block) => (
                <BlockRenderer key={block.id} block={block} />
              ))}
            </ProtocolContainer>
          </div>
        </aside>
      </div>

      {/* ── Save version modal ─────────────────────────────────────────────── */}
      <Modal open={saveModalOpen} onOpenChange={(open) => !open && setSaveModalOpen(false)}>
        <ModalContent>
          <ModalHeader
            title={strings.EDITOR_SAVE_MODAL_TITLE}
            subtitle={strings.EDITOR_SAVE_MODAL_SUBTITLE}
          />
          <ModalBody>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12.5px] font-sans font-medium text-n-700">
                {strings.EDITOR_SAVE_MODAL_LABEL}
              </label>
              <input
                type="text"
                value={changeSummary}
                onChange={(e) => setChangeSummary(e.target.value)}
                placeholder={strings.EDITOR_SAVE_MODAL_PLACEHOLDER}
                className="h-[34px] px-3 text-[13px] font-sans border border-n-300 rounded-sm focus:outline-none focus:border-p-500 focus:shadow-[0_0_0_3px_rgba(45,87,96,0.12)] transition-all duration-[100ms]"
                onKeyDown={(e) => e.key === 'Enter' && handleSaveConfirm()}
                autoFocus
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" onClick={() => setSaveModalOpen(false)} disabled={isSaving}>
              {strings.EDITOR_SAVE_MODAL_CANCEL}
            </Button>
            <Button variant="primary" onClick={handleSaveConfirm} disabled={isSaving}>
              {isSaving ? (
                <>
                  <i className="ph ph-spinner animate-spin mr-1.5" />
                  {strings.EDITOR_SAVING}
                </>
              ) : (
                strings.EDITOR_SAVE_MODAL_CONFIRM
              )}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
