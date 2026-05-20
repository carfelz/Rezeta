import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  useProtocolTemplate,
  useCreateProtocolTemplate,
  useUpdateProtocolTemplate,
} from '@/hooks/protocol-templates/use-protocol-templates'
import {
  TemplateEditor as TemplateEditorWidget,
  stateFromTemplate,
  type TemplateSchema,
} from '@/components/template/TemplateEditor'
import { templatesStrings, templateEditorStrings } from './strings'
import { Button, Callout } from '@/components/ui'
import { toast } from 'sonner'

// ─── New template wrapper ─────────────────────────────────────────────────────

export function TemplateEditorNew(): JSX.Element {
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
          {templatesStrings.pageTitle}
        </Button>
      </nav>
      <TemplateEditorWidget
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

export function TemplateEditor(): JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: template, isLoading, isError } = useProtocolTemplate(id ?? '')
  const updateMutation = useUpdateProtocolTemplate(id ?? '')

  if (isLoading) {
    return (
      <div className="p-8">
        <p className="text-body text-n-500">{templatesStrings.loading}</p>
      </div>
    )
  }

  if (isError || !template) {
    return (
      <div className="p-8">
        <Callout variant="danger" icon={<i className="ph ph-warning" style={{ fontSize: 18 }} />}>
          {templatesStrings.error}
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
    toast.success(templateEditorStrings.saved)
  }

  return (
    <div className="p-8 px-6">
      <nav className="mb-4">
        <Button variant="ghost" size="sm" onClick={() => void navigate('/ajustes/plantillas')}>
          <i className="ph ph-arrow-left mr-1" />
          {templatesStrings.pageTitle}
        </Button>
      </nav>
      <TemplateEditorWidget
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
