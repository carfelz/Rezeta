import { useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
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
import type { ProtocolBlock } from '@/components/protocols/BlockRenderer'
import { useProtocols } from '@/hooks/protocols/use-protocols'
import { strings } from '@/lib/strings'

export function ProtocolEditor(): JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { useGetProtocol, useRenameProtocol, useSaveVersion } = useProtocols()

  const { data: protocol, isLoading, error } = useGetProtocol(id ?? '')
  const { mutate: rename, isPending: isRenaming } = useRenameProtocol(id ?? '')
  const { mutate: saveVersion, isPending: isSaving } = useSaveVersion(id ?? '')

  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [changeSummary, setChangeSummary] = useState('')
  const titleInputRef = useRef<HTMLInputElement>(null)

  if (!id) {
    void navigate('/protocolos', { replace: true })
    return <></>
  }

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

  const blocks = (protocol.currentVersion?.content?.blocks ?? []) as ProtocolBlock[]
  const versionNumber = protocol.currentVersion?.versionNumber ?? 1

  // ── Title editing ─────────────────────────────────────────────────────────

  const startEditing = () => {
    setTitleDraft(protocol.title)
    setEditingTitle(true)
    setTimeout(() => titleInputRef.current?.select(), 0)
  }

  const commitTitle = () => {
    const trimmed = titleDraft.trim()
    if (trimmed.length >= 2 && trimmed !== protocol.title) {
      rename({ title: trimmed })
    }
    setEditingTitle(false)
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commitTitle()
    if (e.key === 'Escape') setEditingTitle(false)
  }

  // ── Save version ──────────────────────────────────────────────────────────

  const handleSaveConfirm = () => {
    if (!protocol.currentVersion) return
    saveVersion(
      { content: protocol.currentVersion.content, changeSummary: changeSummary.trim() || null },
      {
        onSuccess: () => {
          setSaveModalOpen(false)
          setChangeSummary('')
        },
      },
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0" style={{ height: 'calc(100vh - 56px)' }}>
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
        {/* Left — Palette (disabled) */}
        <aside className="w-[116px] shrink-0 bg-n-25 border-r border-n-200 flex flex-col items-center pt-5 gap-2">
          <span className="text-[10px] font-mono uppercase tracking-[0.10em] text-n-400 mb-1">
            {strings.EDITOR_PALETTE_TITLE}
          </span>
          {['section', 'text', 'checklist', 'steps', 'decision', 'dosage_table', 'alert'].map(
            (type) => (
              <div key={type} title={strings.EDITOR_PALETTE_COMING_SOON} className="w-full px-2">
                <div className="flex items-center gap-2 px-2 py-1.5 rounded text-n-300 cursor-not-allowed select-none">
                  <PaletteIcon type={type} />
                  <span className="text-[11px] font-sans capitalize truncate">
                    {type.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ),
          )}
        </aside>

        {/* Center — Canvas (read-only blocks) */}
        <main className="flex-1 overflow-y-auto bg-n-50 p-6">
          {blocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <i className="ph ph-file-text text-[36px] text-n-300" />
              <p className="text-[13px] font-sans text-n-400 max-w-[28ch]">
                {strings.VIEWER_NO_CONTENT}
              </p>
            </div>
          ) : (
            <div className="max-w-[720px] mx-auto flex flex-col gap-3">
              {blocks.map((block) => (
                <BlockRenderer key={block.id} block={block} />
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
              {...(protocol.templateName ? { kicker: protocol.templateName } : {})}
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

function PaletteIcon({ type }: { type: string }): JSX.Element {
  const icons: Record<string, string> = {
    section: 'ph-rows',
    text: 'ph-text-t',
    checklist: 'ph-check-square',
    steps: 'ph-list-numbers',
    decision: 'ph-git-fork',
    dosage_table: 'ph-table',
    alert: 'ph-warning',
  }
  return <i className={`ph ${icons[type] ?? 'ph-square'} text-[14px]`} />
}
