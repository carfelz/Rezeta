import { useState, useEffect, useMemo } from 'react'
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
import {
  Button,
  Callout,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastDescription,
} from '@/components/ui'

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
    <div className="p-8 px-6">
      <nav className="mb-4">
        <Button variant="ghost" size="sm" onClick={() => void navigate('/ajustes/plantillas')}>
          <i className="ph ph-arrow-left mr-1" />
          {strings.TEMPLATES_PAGE_TITLE}
        </Button>
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
  const [savedToast, setSavedToast] = useState(false)

  useEffect(() => {
    if (updateMutation.isSuccess) {
      setSavedToast(true)
      const t = setTimeout(() => setSavedToast(false), 2500)
      return () => clearTimeout(t)
    }
  }, [updateMutation.isSuccess])

  if (isLoading) {
    return (
      <div className="p-8">
        <p className="text-body text-n-500">{strings.TEMPLATES_LOADING}</p>
      </div>
    )
  }

  if (isError || !template) {
    return (
      <div className="p-8">
        <Callout variant="danger" icon={<i className="ph ph-warning" style={{ fontSize: 18 }} />}>
          {strings.TEMPLATES_ERROR}
        </Callout>
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
    <ToastProvider>
      <div className="p-8 px-6">
        <nav className="mb-4">
          <Button variant="ghost" size="sm" onClick={() => void navigate('/ajustes/plantillas')}>
            <i className="ph ph-arrow-left mr-1" />
            {strings.TEMPLATES_PAGE_TITLE}
          </Button>
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
      <Toast
        open={savedToast}
        onOpenChange={setSavedToast}
        variant="success"
        icon={<i className="ph ph-check-circle" />}
      >
        <ToastDescription>{strings.TEMPLATE_EDITOR_SAVED}</ToastDescription>
      </Toast>
      <ToastViewport />
    </ToastProvider>
  )
}
