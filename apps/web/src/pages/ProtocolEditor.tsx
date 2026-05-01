import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate, Link, useBlocker } from 'react-router-dom'
import {
  Button,
  Badge,
  AddBlockButton,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '@/components/ui'
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
  { type: 'text', icon: 'ph-text-align-left', label: 'Texto', active: true },
  { type: 'section', icon: 'ph-heading', label: 'Sección', active: true },
  { type: 'checklist', icon: 'ph-list-checks', label: 'Checklist', active: true },
  { type: 'dosage_table', icon: 'ph-table', label: 'Tabla de dosis', active: true },
  { type: 'decision', icon: 'ph-tree-structure', label: 'Árbol de decisión', active: true },
  { type: 'alert', icon: 'ph-warning-octagon', label: 'Alerta clínica', active: true },
  { type: 'steps', icon: 'ph-list-numbers', label: 'Pasos', active: true },
] as const

function makeid() {
  return `blk_${crypto.randomUUID().slice(0, 8)}`
}

function makeBlock(type: string): ProtocolBlock | null {
  if (type === 'text') return { id: makeid(), type: 'text', content: '' }
  if (type === 'alert') return { id: makeid(), type: 'alert', severity: 'info', content: '' }
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

function formatRelativeTime(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  if (diffMins < 2) return 'hace un momento'
  if (diffMins < 60) return `hace ${diffMins} min`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `hace ${diffHours} h`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'ayer'
  return `hace ${diffDays} días`
}

function countBlockStats(blocks: ProtocolBlock[]): { total: number; sections: number } {
  let total = 0
  let sections = 0
  for (const block of blocks) {
    total++
    if (block.type === 'section') {
      sections++
      const inner = countBlockStats(block.blocks)
      total += inner.total
    }
  }
  return { total, sections }
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ProtocolEditor(): JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const {
    useGetProtocol,
    useRenameProtocol,
    useSaveVersion,
    useGetVersionHistory,
    useGetVersion,
    useRestoreVersion,
  } = useProtocols()
  const { data: protocol, isLoading, error } = useGetProtocol(id ?? '')
  const { mutate: rename, isPending: isRenaming } = useRenameProtocol(id ?? '')
  const { mutate: saveVersion, isPending: isSaving } = useSaveVersion(id ?? '')

  const { blocks, isDirty, initEditor, insertBlock, markSaved, resetEditor } = useEditorStore()
  const selectedBlockId = useEditorStore((s) => s.selectedBlockId)

  const [historyOpen, setHistoryOpen] = useState(false)
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null)
  const [publishModalOpen, setPublishModalOpen] = useState(false)
  const [changeSummary, setChangeSummary] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [draftBanner, setDraftBanner] = useState<{
    blocks: ProtocolBlock[]
    savedAt: number
  } | null>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)

  const { data: versionHistory, isLoading: historyLoading } = useGetVersionHistory(id ?? '')
  const { data: selectedVersion, isLoading: versionPreviewLoading } = useGetVersion(
    id ?? '',
    selectedVersionId,
  )
  const { mutate: restoreVersion, isPending: isRestoring } = useRestoreVersion(id ?? '')

  // ── Initialize editor ─────────────────────────────────────────────────────

  const initialized = useRef(false)
  useEffect(() => {
    if (!protocol || initialized.current) return
    initialized.current = true

    const serverBlocks = (protocol.currentVersion?.content?.blocks ?? []) as ProtocolBlock[]
    const requiredIds = extractRequiredBlockIds(protocol.templateSchema)

    const draft = id ? loadLocalDraft(id) : null
    if (draft) setDraftBanner(draft)
    initEditor(id!, serverBlocks, requiredIds)

    return () => {
      resetEditor()
      initialized.current = false
    }
  }, [protocol?.id])

  // ── Autosave ──────────────────────────────────────────────────────────────

  const blocksRef = useRef(blocks)
  blocksRef.current = blocks
  const isDirtyRef = useRef(isDirty)
  isDirtyRef.current = isDirty

  useEffect(() => {
    if (!id) return
    const interval = setInterval(() => {
      if (isDirtyRef.current) saveLocalDraft(id, blocksRef.current)
    }, 30_000)
    return () => clearInterval(interval)
  }, [id])

  // ── Navigation guard ──────────────────────────────────────────────────────

  const blocker = useBlocker(isDirty)
  useEffect(() => {
    if (blocker.state === 'blocked') {
      if (window.confirm(strings.EDITOR_NAVIGATE_AWAY)) blocker.proceed()
      else blocker.reset()
    }
  }, [blocker])

  if (!id) {
    void navigate('/protocolos', { replace: true })
    return <></>
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[256px]">
        <i className="ph ph-spinner animate-spin text-[32px] text-n-400" />
      </div>
    )
  }

  if (error || !protocol) {
    return (
      <div className="flex flex-col items-center justify-center h-[256px] gap-4">
        <p className="text-[14px] font-sans text-n-600">{strings.VIEWER_NOT_FOUND}</p>
        <Link to="/protocolos" className="text-[13px] font-sans text-p-500 hover:text-p-700">
          ← {strings.EDITOR_BACK}
        </Link>
      </div>
    )
  }

  const versionNumber = protocol.currentVersion?.versionNumber ?? 1
  const { total: totalBlocks, sections: sectionCount } = countBlockStats(blocks)
  const topLevelSections = blocks.filter(
    (b): b is Extract<ProtocolBlock, { type: 'section' }> => b.type === 'section',
  )

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

  // ── Save helpers ──────────────────────────────────────────────────────────

  const buildContent = () => ({ version: '1.0', template_version: '1.0', blocks })

  const handleSaveDraft = () => {
    saveVersion(
      { content: buildContent(), changeSummary: null, publish: false },
      {
        onSuccess: () => {
          markSaved()
          if (id) clearLocalDraft(id)
        },
      },
    )
  }

  const handlePublishConfirm = () => {
    saveVersion(
      { content: buildContent(), changeSummary: changeSummary.trim() || null, publish: true },
      {
        onSuccess: () => {
          setPublishModalOpen(false)
          setChangeSummary('')
          markSaved()
          if (id) clearLocalDraft(id)
        },
      },
    )
  }

  // ── Draft banner ──────────────────────────────────────────────────────────

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
      const sectionBlock: ProtocolBlock = {
        id: `sec_${crypto.randomUUID().slice(0, 8)}`,
        type: 'section',
        title: '',
        blocks: [],
      }
      const topLevelMatch = blocks.findIndex((b) => b.id === selectedBlockId)
      if (topLevelMatch !== -1) {
        insertBlock(sectionBlock, selectedBlockId)
      } else {
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

  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(`section-${sectionId}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleRestore = () => {
    if (!selectedVersionId) return
    restoreVersion(selectedVersionId, {
      onSuccess: () => {
        setHistoryOpen(false)
        setSelectedVersionId(null)
      },
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* ── Draft recovery banner ──────────────────────────────────────────── */}
      {draftBanner && (
        <div className="flex items-center gap-3 -mx-12 -mt-8 mb-6 px-12 py-3 bg-warning-bg border-b border-warning-border text-[12.5px] font-sans text-warning-text">
          <i className="ph ph-clock-counter-clockwise text-[14px]" />
          <span className="flex-1">{strings.EDITOR_DRAFT_RECOVERED}</span>
          <button onClick={applyDraft} className="font-medium hover:underline">
            {strings.EDITOR_DRAFT_USE}
          </button>
          <button onClick={discardDraft} className="hover:underline opacity-70">
            {strings.EDITOR_DRAFT_DISCARD}
          </button>
        </div>
      )}

      {/* ── Breadcrumb ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-[13px] font-sans text-n-500 mb-5">
        <Link to="/protocolos" className="hover:text-n-800 transition-colors duration-[100ms]">
          {strings.EDITOR_BACK}
        </Link>
        <i className="ph ph-caret-right text-[11px] text-n-300" />
        <span className="text-n-700 font-medium truncate">{protocol.title}</span>
        <span className="font-mono text-n-400 shrink-0">
          · {strings.EDITOR_VERSION(versionNumber)}
        </span>
      </div>

      {/* ── Editorial page header ──────────────────────────────────────────── */}
      <div className="flex items-start gap-6 mb-6">
        <div className="flex-1 min-w-0">
          {/* Kicker */}
          <div className="text-[11.5px] font-mono uppercase tracking-[0.08em] text-n-400 mb-2">
            {[protocol.typeName, formatRelativeTime(protocol.updatedAt)]
              .filter(Boolean)
              .join(' · ')}
          </div>

          {/* Title — editable */}
          {editingTitle ? (
            <input
              ref={titleInputRef}
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={handleTitleKeyDown}
              className="text-[28px] font-serif font-medium text-n-900 bg-transparent border-b-2 border-p-500 outline-none w-full pb-1 mb-2 leading-tight"
              disabled={isRenaming}
            />
          ) : (
            <h1
              onClick={startEditing}
              className="text-[28px] font-serif font-medium text-n-900 mb-2 cursor-pointer hover:text-p-700 transition-colors duration-[100ms] leading-tight"
              title="Haz clic para renombrar"
            >
              {protocol.title}
            </h1>
          )}

          {/* Subtitle */}
          <p className="text-[13px] font-sans text-n-500">
            {totalBlocks} {totalBlocks === 1 ? 'bloque' : 'bloques'}
            {sectionCount > 0 &&
              ` · ${sectionCount} ${sectionCount === 1 ? 'sección' : 'secciones'}`}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0 pt-1">
          {isDirty && <Badge variant="review">{strings.EDITOR_UNSAVED_CHANGES}</Badge>}
          <Button variant="secondary" size="sm" onClick={() => void navigate(`/protocolos/${id}`)}>
            <i className="ph ph-eye mr-2" />
            {strings.EDITOR_VISTA_PREVIA}
          </Button>
          <Button variant="secondary" size="sm" onClick={handleSaveDraft} disabled={isSaving}>
            {isSaving ? <i className="ph ph-spinner animate-spin mr-2" /> : null}
            {strings.EDITOR_GUARDAR}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setPublishModalOpen(true)}
            disabled={isSaving}
          >
            <i className="ph ph-check mr-2" />
            {strings.EDITOR_PUBLICAR(versionNumber + 1)}
          </Button>
        </div>
      </div>

      {/* ── 3-column editor layout ─────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '220px 1fr 260px',
          gap: '20px',
          alignItems: 'start',
        }}
      >
        {/* ── Left: TOC ────────────────────────────────────────────────────── */}
        <div
          style={{
            position: 'sticky',
            top: 'calc(var(--layout-topbar-height) + 24px)',
            maxHeight: 'calc(100vh - var(--layout-topbar-height) - 48px)',
            overflowY: 'auto',
          }}
        >
          {topLevelSections.length === 0 ? (
            <p className="text-[12px] font-sans text-n-400 italic px-2 py-3">
              {strings.EDITOR_TOC_EMPTY_SECTIONS}
            </p>
          ) : (
            topLevelSections.map((section, idx) => (
              <button
                key={section.id}
                onClick={() => scrollToSection(section.id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left rounded-[3px] text-[12.5px] font-sans text-n-500 hover:bg-n-50 hover:text-n-800 transition-colors duration-[100ms]"
              >
                <span className="font-mono text-[10.5px] text-n-400 min-w-[18px] shrink-0">
                  {idx + 1}
                </span>
                <span className="truncate">
                  {section.title || strings.EDITOR_SECTION_DEFAULT_TITLE}
                </span>
              </button>
            ))
          )}
        </div>

        {/* ── Center: Canvas ───────────────────────────────────────────────── */}
        <div>
          {blocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <i className="ph ph-file-text text-[36px] text-n-300" />
              <p className="text-[13px] font-sans text-n-400 max-w-[28ch]">
                {strings.VIEWER_NO_CONTENT}
              </p>
            </div>
          ) : (
            blocks.map((block, idx) => (
              <EditorBlockRenderer
                key={block.id}
                block={block}
                isFirst={idx === 0}
                isLast={idx === blocks.length - 1}
              />
            ))
          )}

          {/* Add block footer */}
          <AddBlockButton
            onClick={() => handlePaletteClick('section')}
            label={strings.EDITOR_ADD_BLOCK_FOOTER}
          />
        </div>

        {/* ── Right: Palette + mini History ────────────────────────────────── */}
        <div
          style={{
            position: 'sticky',
            top: 'calc(var(--layout-topbar-height) + 24px)',
            maxHeight: 'calc(100vh - var(--layout-topbar-height) - 48px)',
            overflowY: 'auto',
          }}
        >
          {/* Palette */}
          <h4 className="text-[11.5px] font-sans font-semibold text-n-700 mb-3">
            {strings.EDITOR_PALETTE_HEADER}
          </h4>
          <div className="flex flex-col gap-2 mb-6">
            {PALETTE_ITEMS.map(({ type, icon, label, active }) =>
              active ? (
                <button
                  key={type}
                  onClick={() => handlePaletteClick(type)}
                  className="flex items-center gap-3 px-3 py-2 border border-n-200 rounded-[3px] bg-n-0 text-[12.5px] font-sans text-n-700 hover:border-n-400 hover:bg-n-25 transition-colors duration-[100ms] cursor-pointer text-left"
                >
                  <i className={`ph ${icon} text-p-500 text-[16px] shrink-0`} />
                  {label}
                </button>
              ) : (
                <div
                  key={type}
                  title={strings.EDITOR_PALETTE_DISABLED_TOOLTIP}
                  className="flex items-center gap-3 px-3 py-2 border border-n-200 rounded-[3px] bg-n-50 text-[12.5px] font-sans text-n-400 cursor-not-allowed"
                >
                  <i className={`ph ${icon} text-n-300 text-[16px] shrink-0`} />
                  {label}
                </div>
              ),
            )}
          </div>

          {/* Mini history */}
          <h4 className="text-[11.5px] font-sans font-semibold text-n-700 mb-3">
            {strings.EDITOR_HISTORY_BUTTON}
          </h4>
          {historyLoading ? (
            <div className="flex justify-center py-3">
              <i className="ph ph-spinner animate-spin text-[18px] text-n-400" />
            </div>
          ) : !versionHistory || versionHistory.length === 0 ? (
            <p className="text-[12px] font-sans text-n-400 italic">
              {strings.EDITOR_HISTORY_EMPTY}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {versionHistory.slice(0, 3).map((v) => (
                <div key={v.id} className="text-[12px] font-sans text-n-500">
                  <span className="font-semibold text-n-800">
                    {strings.EDITOR_VERSION(v.versionNumber)}
                  </span>
                  {' · '}
                  {new Date(v.createdAt).toLocaleDateString('es-DO', {
                    day: 'numeric',
                    month: 'short',
                  })}
                  {v.changeSummary && (
                    <span className="text-n-400 block truncate mt-1">{v.changeSummary}</span>
                  )}
                </div>
              ))}
              <button
                onClick={() => setHistoryOpen(true)}
                className="text-[12px] font-sans text-p-500 hover:text-p-700 text-left mt-1 transition-colors duration-[100ms]"
              >
                {strings.EDITOR_HISTORY_VIEW_ALL}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── History drawer ────────────────────────────────────────────────────── */}
      {historyOpen && (
        <div
          className="fixed right-0 top-0 bottom-0 w-[380px] bg-n-0 border-l border-n-200 flex flex-col z-50"
          style={{
            boxShadow: '0 1px 0 rgba(14,14,13,.04), -8px 0 24px -8px rgba(14,14,13,.10)',
          }}
        >
          <div className="flex items-center justify-between px-5 py-3 border-b border-n-200 shrink-0">
            <span className="text-[13.5px] font-sans font-semibold text-n-800">
              {strings.EDITOR_HISTORY_TITLE}
            </span>
            <button
              onClick={() => setHistoryOpen(false)}
              className="w-btn-sm h-btn-sm flex items-center justify-center rounded text-n-400 hover:text-n-700 hover:bg-n-50 transition-colors duration-[100ms]"
              aria-label="Cerrar historial"
            >
              <i className="ph ph-x text-[15px]" />
            </button>
          </div>

          <div className="flex flex-col overflow-y-auto shrink-0 max-h-[260px] border-b border-n-200">
            {historyLoading ? (
              <div className="flex justify-center py-6">
                <i className="ph ph-spinner animate-spin text-[20px] text-n-400" />
              </div>
            ) : !versionHistory || versionHistory.length === 0 ? (
              <p className="text-[12.5px] font-sans text-n-400 text-center py-6">
                {strings.EDITOR_HISTORY_EMPTY}
              </p>
            ) : (
              versionHistory.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVersionId(v.id === selectedVersionId ? null : v.id)}
                  className={`flex items-center gap-3 px-5 py-3 text-left border-b border-n-100 last:border-0 transition-colors duration-[100ms] ${
                    selectedVersionId === v.id ? 'bg-p-50' : 'hover:bg-n-25'
                  }`}
                >
                  <span className="text-[12.5px] font-mono font-medium text-n-800 shrink-0">
                    {strings.EDITOR_VERSION(v.versionNumber)}
                  </span>
                  {v.isCurrent && (
                    <span className="text-[10.5px] font-mono text-p-700 bg-p-50 border border-p-100 rounded px-2 py-1 shrink-0">
                      {strings.EDITOR_HISTORY_CURRENT}
                    </span>
                  )}
                  <span className="flex-1 text-[12px] font-sans text-n-500 truncate">
                    {v.changeSummary ?? strings.EDITOR_HISTORY_NO_SUMMARY}
                  </span>
                  <span className="text-[11px] font-mono text-n-400 shrink-0">
                    {new Date(v.createdAt).toLocaleDateString('es-DO', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                </button>
              ))
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {!selectedVersionId ? (
              <div className="flex items-center justify-center h-full p-6">
                <p className="text-[12.5px] font-sans text-n-400 text-center">
                  {strings.EDITOR_HISTORY_SELECT_PROMPT}
                </p>
              </div>
            ) : versionPreviewLoading ? (
              <div className="flex justify-center py-8">
                <i className="ph ph-spinner animate-spin text-[20px] text-n-400" />
              </div>
            ) : (
              <div className="p-4 flex flex-col gap-2">
                <div className="text-[10px] font-mono uppercase tracking-[0.10em] text-n-400 mb-1">
                  {strings.EDITOR_HISTORY_PREVIEW_TITLE}
                </div>
                {selectedVersion?.content.blocks.map((block) => (
                  <BlockRenderer key={block.id} block={block} />
                ))}
              </div>
            )}
          </div>

          {selectedVersionId &&
            versionHistory?.find((v) => v.id === selectedVersionId && !v.isCurrent) && (
              <div className="px-5 py-3 border-t border-n-200 shrink-0">
                <Button
                  variant="secondary"
                  onClick={handleRestore}
                  disabled={isRestoring}
                  className="w-full justify-center"
                >
                  {isRestoring ? (
                    <>
                      <i className="ph ph-spinner animate-spin mr-2" />
                      {strings.EDITOR_HISTORY_RESTORING}
                    </>
                  ) : (
                    <>
                      <i className="ph ph-clock-counter-clockwise mr-2" />
                      {strings.EDITOR_HISTORY_RESTORE}
                    </>
                  )}
                </Button>
              </div>
            )}
        </div>
      )}

      {/* ── Publish modal ─────────────────────────────────────────────────────── */}
      <Modal open={publishModalOpen} onOpenChange={(open) => !open && setPublishModalOpen(false)}>
        <ModalContent>
          <ModalHeader
            title={strings.EDITOR_PUBLISH_MODAL_TITLE}
            subtitle={strings.EDITOR_PUBLISH_MODAL_SUBTITLE}
          />
          <ModalBody>
            <div className="flex flex-col gap-2">
              <label className="text-[12.5px] font-sans font-medium text-n-700">
                {strings.EDITOR_PUBLISH_MODAL_LABEL}
              </label>
              <input
                type="text"
                value={changeSummary}
                onChange={(e) => setChangeSummary(e.target.value)}
                placeholder={strings.EDITOR_PUBLISH_MODAL_PLACEHOLDER}
                className="h-[34px] px-3 text-[13px] font-sans border border-n-300 rounded-sm focus:outline-none focus:border-p-500 focus:shadow-[0_0_0_3px_rgba(45,87,96,0.12)] transition-all duration-[100ms]"
                onKeyDown={(e) => e.key === 'Enter' && handlePublishConfirm()}
                autoFocus
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="secondary"
              onClick={() => setPublishModalOpen(false)}
              disabled={isSaving}
            >
              {strings.EDITOR_PUBLISH_MODAL_CANCEL}
            </Button>
            <Button variant="primary" onClick={handlePublishConfirm} disabled={isSaving}>
              {isSaving ? (
                <>
                  <i className="ph ph-spinner animate-spin mr-2" />
                  {strings.EDITOR_SAVING}
                </>
              ) : (
                <>
                  <i className="ph ph-check mr-2" />
                  {strings.EDITOR_PUBLICAR(versionNumber + 1)}
                </>
              )}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
