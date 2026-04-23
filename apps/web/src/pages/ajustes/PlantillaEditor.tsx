import { useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  useProtocolTemplate,
  useCreateProtocolTemplate,
  useUpdateProtocolTemplate,
} from '@/hooks/protocol-templates/use-protocol-templates'
import {
  TemplateEditor,
  stateFromTemplate,
  type TemplateSchema,
} from '@/components/template/TemplateEditor'
import { strings } from '@/lib/strings'

// ─── New template wrapper ─────────────────────────────────────────────────────

export function PlantillaEditorNew(): JSX.Element {
  const navigate = useNavigate()
  const createMutation = useCreateProtocolTemplate()

  const initialState = useMemo(
    () => ({
      name: '',
      suggestedSpecialty: '',
      blocks: [],
      expandedBlockId: null,
      isDirty: false,
    }),
    [],
  )

  async function handleSave(name: string, suggestedSpecialty: string, schema: TemplateSchema) {
    const created = await createMutation.mutateAsync({
      name,
      suggestedSpecialty: suggestedSpecialty || undefined,
      schema,
    })
    void navigate(`/ajustes/plantillas/${created.id}/edit`, { replace: true })
  }

  return (
    <div style={{ padding: 'var(--space-8) var(--space-6)' }}>
      <nav style={{ marginBottom: 'var(--space-4)' }}>
        <button
          className="btn btn--ghost btn--sm"
          onClick={() => {
            void navigate('/ajustes/plantillas')
          }}
        >
          <i className="ph ph-arrow-left" style={{ marginRight: 4 }} />
          {strings.TEMPLATES_PAGE_TITLE}
        </button>
      </nav>
      <TemplateEditor
        initialState={initialState}
        isLocked={false}
        isSaving={createMutation.isPending}
        onSave={(name, specialty, schema) => {
          void handleSave(name, specialty, schema)
        }}
        onCancel={() => void navigate('/ajustes/plantillas')}
      />
    </div>
  )
}

// ─── Existing template editor ─────────────────────────────────────────────────

export function PlantillaEditor(): JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: template, isLoading, isError } = useProtocolTemplate(id ?? '')
  const updateMutation = useUpdateProtocolTemplate(id ?? '')

  // Show toast on successful save
  useEffect(() => {
    if (updateMutation.isSuccess) {
      // Simple inline feedback — a proper toast system would live in a shared notification store
      const toast = document.createElement('div')
      toast.textContent = strings.TEMPLATE_EDITOR_SAVED
      Object.assign(toast.style, {
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        background: 'var(--color-n-800)',
        color: 'white',
        padding: '10px 16px',
        borderRadius: 'var(--radius-md)',
        fontSize: '13px',
        zIndex: '999',
      })
      document.body.appendChild(toast)
      setTimeout(() => document.body.removeChild(toast), 2500)
    }
  }, [updateMutation.isSuccess])

  if (isLoading) {
    return (
      <div style={{ padding: 'var(--space-8)' }}>
        <p className="text-body" style={{ color: 'var(--color-n-500)' }}>
          {strings.TEMPLATES_LOADING}
        </p>
      </div>
    )
  }

  if (isError || !template) {
    return (
      <div style={{ padding: 'var(--space-8)' }}>
        <div className="callout callout--danger">
          <i className="ph ph-warning" style={{ fontSize: 18 }} />
          <div className="callout__body">{strings.TEMPLATES_ERROR}</div>
        </div>
      </div>
    )
  }

  const initialState = stateFromTemplate(template)

  async function handleSave(name: string, suggestedSpecialty: string, schema: TemplateSchema) {
    await updateMutation.mutateAsync({
      name,
      suggestedSpecialty: suggestedSpecialty || null,
      schema,
    })
  }

  return (
    <div style={{ padding: 'var(--space-8) var(--space-6)' }}>
      <nav style={{ marginBottom: 'var(--space-4)' }}>
        <button
          className="btn btn--ghost btn--sm"
          onClick={() => void navigate('/ajustes/plantillas')}
        >
          <i className="ph ph-arrow-left" style={{ marginRight: 4 }} />
          {strings.TEMPLATES_PAGE_TITLE}
        </button>
      </nav>
      <TemplateEditor
        key={template.id}
        initialState={initialState}
        isLocked={template.isLocked}
        blockingTypeIds={template.blockingTypeIds}
        isSaving={updateMutation.isPending}
        onSave={(name, specialty, schema) => {
          void handleSave(name, specialty, schema)
        }}
        onCancel={() => void navigate('/ajustes/plantillas')}
      />
    </div>
  )
}
