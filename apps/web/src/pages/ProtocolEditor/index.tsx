import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate, Link, useBlocker } from 'react-router-dom'
import { AddBlockButton, ConfirmDialog } from '@/components/ui'
import { EditorBlockRenderer } from '@/components/protocols/EditorBlockRenderer'
import type { ProtocolBlock } from '@/components/protocols/BlockRenderer'
import { useProtocols } from '@/hooks/protocols/use-protocols'
import { protocolEditorStrings } from './strings'
import {
  useEditorStore,
  extractRequiredBlockIds,
  saveLocalDraft,
  loadLocalDraft,
  clearLocalDraft,
} from '@/store/editor.store'
import { makeBlock, makeSectionBlock } from './block-factory'
import { countBlockStats } from './helpers'
import { DraftBanner } from './DraftBanner'
import { EditorHeader } from './EditorHeader'
import { EditorTOC } from './EditorTOC'
import { EditorPalette } from './EditorPalette'
import { HistoryDrawer } from './HistoryDrawer'
import { PublishModal } from './PublishModal'
import { SaveModal } from './SaveModal'

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
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [changeSummary, setChangeSummary] = useState('')
  const [saveSummary, setSaveSummary] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [draftBanner, setDraftBanner] = useState<{
    blocks: ProtocolBlock[]
    savedAt: number
  } | null>(null)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024)

  const { data: versionHistory, isLoading: historyLoading } = useGetVersionHistory(id ?? '')
  const { data: selectedVersion, isLoading: versionPreviewLoading } = useGetVersion(
    id ?? '',
    selectedVersionId,
  )
  const { mutate: restoreVersion, isPending: isRestoring } = useRestoreVersion(id ?? '')

  // ── Initialize editor ───────────────────────────────────────────────────
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

  // ── Autosave ────────────────────────────────────────────────────────────
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

  // ── Mobile gate ─────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (): void => setIsMobile(window.innerWidth < 1024)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // ── Keyboard shortcut: Cmd+S / Ctrl+S ───────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (isDirtyRef.current) setSaveModalOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ── Navigation guard ────────────────────────────────────────────────────
  // The blocker stays in `blocked` state while the ConfirmDialog (rendered
  // below) is open; the dialog resolves it via proceed()/reset().
  const blocker = useBlocker(isDirty)

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
        <p className="text-[14px] font-sans text-n-600">{protocolEditorStrings.notFound}</p>
        <Link to="/protocolos" className="text-[13px] font-sans text-p-500 hover:text-p-700">
          ← {protocolEditorStrings.back}
        </Link>
      </div>
    )
  }

  const protocolTitle = protocol.title
  const protocolTemplateSchema: unknown = protocol.templateSchema
  const versionNumber = protocol.currentVersion?.versionNumber ?? 1
  const hasBeenPublished = protocol.status === 'active'
  const nextPublishVersion = hasBeenPublished ? versionNumber + 1 : 1
  const { total: totalBlocks, sections: sectionCount } = countBlockStats(blocks)
  const topLevelSections = blocks.filter(
    (b): b is Extract<ProtocolBlock, { type: 'section' }> => b.type === 'section',
  )

  // ── Title editing ───────────────────────────────────────────────────────
  const startEditing = (): void => {
    setTitleDraft(protocolTitle)
    setEditingTitle(true)
  }
  const commitTitle = (): void => {
    const trimmed = titleDraft.trim()
    if (trimmed.length >= 2 && trimmed !== protocolTitle) rename({ title: trimmed })
    setEditingTitle(false)
  }

  // ── Save helpers ────────────────────────────────────────────────────────
  const buildContent = (): {
    version: string
    template_version: string
    blocks: ProtocolBlock[]
  } => ({
    version: '1.0',
    template_version: '1.0',
    blocks,
  })

  const handleSaveDraft = (summary?: string): void => {
    saveVersion(
      { content: buildContent(), changeSummary: summary?.trim() || null, publish: false },
      {
        onSuccess: () => {
          setSaveModalOpen(false)
          setSaveSummary('')
          markSaved()
          if (id) clearLocalDraft(id)
        },
      },
    )
  }

  const handleSaveModalPublish = (): void => {
    saveVersion(
      { content: buildContent(), changeSummary: saveSummary.trim() || null, publish: true },
      {
        onSuccess: () => {
          setSaveModalOpen(false)
          setSaveSummary('')
          markSaved()
          if (id) clearLocalDraft(id)
        },
      },
    )
  }

  const handlePublishConfirm = (): void => {
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

  // ── Draft banner ────────────────────────────────────────────────────────
  const applyDraft = (): void => {
    if (!draftBanner || !id) return
    const requiredIds = extractRequiredBlockIds(protocolTemplateSchema)
    initEditor(id, draftBanner.blocks, requiredIds)
    setDraftBanner(null)
  }

  const discardDraft = (): void => {
    if (id) clearLocalDraft(id)
    setDraftBanner(null)
  }

  // ── Palette click ───────────────────────────────────────────────────────
  const handlePaletteClick = (type: string): void => {
    if (type === 'section') {
      const sectionBlock = makeSectionBlock()
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

  const scrollToSection = (sectionId: string): void => {
    const el = document.getElementById(`section-${sectionId}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleRestore = (versionId: string): void => {
    restoreVersion(versionId, {
      onSuccess: () => {
        setHistoryOpen(false)
        setSelectedVersionId(null)
      },
    })
  }

  if (isMobile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-6 text-center">
        <i className="ph ph-desktop text-[48px] text-n-300" />
        <h2 className="text-h2 text-n-800">{protocolEditorStrings.mobileGateTitle}</h2>
        <p className="text-body-sm text-n-500 max-w-[36ch]">
          {protocolEditorStrings.mobileGateBody}
        </p>
        <Link to="/protocolos" className="text-[13px] font-sans text-p-500 hover:text-p-700">
          ← {protocolEditorStrings.back}
        </Link>
      </div>
    )
  }

  return (
    <div>
      {draftBanner && <DraftBanner onUse={applyDraft} onDiscard={discardDraft} />}

      <div className="flex items-center gap-2 text-[13px] font-sans text-n-500 mb-5">
        <Link to="/protocolos" className="hover:text-n-800 transition-colors duration-[100ms]">
          {protocolEditorStrings.back}
        </Link>
        <i className="ph ph-caret-right text-[11px] text-n-300" />
        <span className="text-n-700 font-medium truncate">{protocol.title}</span>
        <span className="font-mono text-n-400 shrink-0">
          · {protocolEditorStrings.version(versionNumber)}
        </span>
      </div>

      <EditorHeader
        title={protocol.title}
        typeName={protocol.categoryName}
        updatedAt={protocol.updatedAt}
        totalBlocks={totalBlocks}
        sectionCount={sectionCount}
        status={protocol.status}
        isDirty={isDirty}
        isSaving={isSaving}
        isRenaming={isRenaming}
        editingTitle={editingTitle}
        titleDraft={titleDraft}
        onTitleDraftChange={setTitleDraft}
        onStartEditing={startEditing}
        onCommitTitle={commitTitle}
        onCancelTitleEdit={() => setEditingTitle(false)}
        nextPublishVersion={nextPublishVersion}
        onPreview={() => void navigate(`/protocolos/${id}`)}
        onSaveDraft={() => setSaveModalOpen(true)}
        onPublishClick={() => setPublishModalOpen(true)}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '220px 1fr 260px',
          gap: '20px',
          alignItems: 'start',
        }}
      >
        <EditorTOC sections={topLevelSections} onSectionClick={scrollToSection} />

        <div>
          {blocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <i className="ph ph-file-text text-[36px] text-n-300" />
              <p className="text-[13px] font-sans text-n-400 max-w-[28ch]">
                {protocolEditorStrings.noContent}
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

          <AddBlockButton
            onClick={() => handlePaletteClick('section')}
            label={protocolEditorStrings.addBlockFooter}
          />
        </div>

        <EditorPalette
          onPaletteClick={handlePaletteClick}
          versionHistory={versionHistory}
          historyLoading={historyLoading}
          onShowFullHistory={() => setHistoryOpen(true)}
        />
      </div>

      {historyOpen && (
        <HistoryDrawer
          versionHistory={versionHistory}
          historyLoading={historyLoading}
          selectedVersionId={selectedVersionId}
          selectedVersion={selectedVersion}
          versionPreviewLoading={versionPreviewLoading}
          onSelectVersion={setSelectedVersionId}
          onClose={() => setHistoryOpen(false)}
          onRestore={handleRestore}
          isRestoring={isRestoring}
          currentVersionId={protocol.currentVersion?.id ?? null}
        />
      )}

      <PublishModal
        open={publishModalOpen}
        changeSummary={changeSummary}
        onChangeSummary={setChangeSummary}
        onClose={() => setPublishModalOpen(false)}
        onConfirm={handlePublishConfirm}
        isSaving={isSaving}
        nextPublishVersion={nextPublishVersion}
      />

      <SaveModal
        open={saveModalOpen}
        changeSummary={saveSummary}
        onChangeSummary={setSaveSummary}
        onClose={() => {
          setSaveModalOpen(false)
          setSaveSummary('')
        }}
        onSaveDraft={() => handleSaveDraft(saveSummary)}
        onPublish={handleSaveModalPublish}
        isSaving={isSaving}
      />

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        title={protocolEditorStrings.navigateAwayTitle}
        description={protocolEditorStrings.navigateAwayBody}
        confirmLabel={protocolEditorStrings.navigateAwayConfirm}
        cancelLabel={protocolEditorStrings.navigateAwayCancel}
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      />
    </div>
  )
}
