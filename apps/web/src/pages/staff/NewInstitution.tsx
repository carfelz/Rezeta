import { useState } from 'react'
import { useCreateInstitution } from '@/hooks/staff/use-create-institution'
import { Button, Callout, Field, Input, NativeSelect } from '@/components/ui'
import type { CreateInstitutionDto, InstitutionCreatedDto } from '@rezeta/shared'
import { staffStrings } from './strings'

type TenantType = CreateInstitutionDto['type']
type TenantPlan = CreateInstitutionDto['plan']

export function NewInstitution(): JSX.Element {
  const mutation = useCreateInstitution()
  const [institutionName, setInstitutionName] = useState('')
  const [type, setType] = useState<TenantType>('solo')
  const [plan, setPlan] = useState<TenantPlan>('free')
  const [adminFullName, setAdminFullName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<InstitutionCreatedDto | null>(null)

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setError(null)
    try {
      const result = await mutation.mutateAsync({
        institutionName: institutionName.trim(),
        type,
        plan,
        adminFullName: adminFullName.trim(),
        adminEmail: adminEmail.trim(),
      })
      setCreated(result)
    } catch {
      setError(staffStrings.error)
    }
  }

  const canSubmit =
    institutionName.trim().length >= 2 &&
    adminFullName.trim().length >= 2 &&
    adminEmail.trim().length > 0

  return (
    <div>
      <h1 className="text-h1">{staffStrings.pageTitle}</h1>
      <p className="mt-1 mb-6 text-sm text-n-500">{staffStrings.pageSubtitle}</p>

      {created && (
        <Callout variant="success" icon={<i className="ph ph-check-circle" />} className="mb-4">
          <div className="font-semibold">{staffStrings.successTitle}</div>
          <div>{staffStrings.successBody(created.email)}</div>
        </Callout>
      )}

      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          void handleSubmit(e)
        }}
      >
        <Field label={staffStrings.fieldInstitutionName} required id="institution-name">
          <Input
            id="institution-name"
            type="text"
            value={institutionName}
            onChange={(e) => setInstitutionName(e.target.value)}
            autoFocus
          />
        </Field>

        <Field label={staffStrings.fieldType} id="institution-type">
          <NativeSelect
            id="institution-type"
            value={type}
            onChange={(e) => setType(e.target.value as TenantType)}
          >
            {(Object.keys(staffStrings.typeOptions) as TenantType[]).map((key) => (
              <option key={key} value={key}>
                {staffStrings.typeOptions[key]}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <Field label={staffStrings.fieldPlan} id="institution-plan">
          <NativeSelect
            id="institution-plan"
            value={plan}
            onChange={(e) => setPlan(e.target.value as TenantPlan)}
          >
            {(Object.keys(staffStrings.planOptions) as TenantPlan[]).map((key) => (
              <option key={key} value={key}>
                {staffStrings.planOptions[key]}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <Field label={staffStrings.fieldAdminName} required id="admin-full-name">
          <Input
            id="admin-full-name"
            type="text"
            value={adminFullName}
            onChange={(e) => setAdminFullName(e.target.value)}
          />
        </Field>

        <Field label={staffStrings.fieldAdminEmail} required id="admin-email">
          <Input
            id="admin-email"
            type="email"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
          />
        </Field>

        {error && (
          <Callout variant="danger" icon={<i className="ph ph-warning" />}>
            {error}
          </Callout>
        )}

        <div>
          <Button type="submit" variant="primary" disabled={!canSubmit || mutation.isPending}>
            {mutation.isPending ? staffStrings.submitting : staffStrings.submit}
          </Button>
        </div>
      </form>
    </div>
  )
}
