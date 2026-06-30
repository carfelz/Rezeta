import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  useProtocolTemplate,
  useCreateProtocolTemplate,
  useUpdateProtocolTemplate,
} from '@/hooks/protocol-templates/use-protocol-templates'
import { useProtocolCategories } from '@/hooks/protocol-categories/use-protocol-categories'
import {
  TemplateEditor as TemplateEditorWidget,
  stateFromTemplate,
  type TemplateSchema,
} from '@/components/template/TemplateEditor'
import { templatesStrings, templateEditorStrings } from './strings'
import { Button, Callout, NativeSelect, Field } from '@/components/ui'
import { toast } from 'sonner'

// ─── New template wrapper ─────────────────────────────────────────────────────

export function TemplateEditorNew(): JSX.Element {
  const navigate = useNavigate()
  const createMutation = useCreateProtocolTemplate()
  const { data: categories } = useProtocolCategories()
  const [categoryId, setCategoryId] = useState('')

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
      categoryId,
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
      <div className="mb-4 max-w-xs">
        <Field label={templateEditorStrings.fieldCategory} required>
          <NativeSelect
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            aria-label={templateEditorStrings.fieldCategory}
          >
            <option value="">{templateEditorStrings.fieldCategoryPlaceholder}</option>
            {categories?.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <TemplateEditorWidget
        initialState={initialState}
        isLocked={false}
        isSaving={createMutation.isPending}
        isSaveDisabled={!categoryId}
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
  const { data: categories } = useProtocolCategories()
  const [categoryId, setCategoryId] = useState<string>('')

  // Prefill categoryId once template loads
  const resolvedCategoryId = template?.categoryId !== undefined && categoryId === ''
    ? template.categoryId
    : categoryId

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
      categoryId: resolvedCategoryId || undefined,
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
      <div className="mb-4 max-w-xs">
        <Field label={templateEditorStrings.fieldCategory} required>
          <NativeSelect
            value={resolvedCategoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            aria-label={templateEditorStrings.fieldCategory}
          >
            <option value="">{templateEditorStrings.fieldCategoryPlaceholder}</option>
            {categories?.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <TemplateEditorWidget
        key={template.id}
        initialState={initialState}
        isLocked={false}
        blockingTypeIds={[]}
        isSaving={updateMutation.isPending}
        isSaveDisabled={!resolvedCategoryId}
        onSave={(name, specialty, schema) => {
          void handleSave(name, specialty, schema)
        }}
        onCancel={() => void navigate('/ajustes/plantillas')}
      />
    </div>
  )
}
