import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { UpdateProfileSchema, type UpdateProfileDto } from '@rezeta/shared'
import { useAuth } from '@/hooks/use-auth'
import { useAuthStore } from '@/store/auth.store'
import { useUpdateProfile } from '@/hooks/users/use-update-profile'
import { logger } from '@/lib/logger'
import { settingsStrings, templatesStrings, typesStrings } from './settings/strings'
import {
  Button,
  Card,
  CardTitle,
  Field,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Callout,
} from '@/components/ui'

function ProfileEditModal({ onClose }: { onClose: () => void }): JSX.Element {
  const { user } = useAuth()
  const mutation = useUpdateProfile()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateProfileDto>({
    resolver: zodResolver(UpdateProfileSchema),
    defaultValues: {
      fullName: user?.fullName ?? '',
      specialty: user?.specialty ?? null,
      licenseNumber: user?.licenseNumber ?? null,
    },
  })

  async function onSubmit(data: UpdateProfileDto): Promise<void> {
    setServerError(null)
    try {
      await mutation.mutateAsync(data)
      onClose()
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      logger.error(error.message, { stack: error.stack, context: 'Settings.updateProfile' })
      setServerError(settingsStrings.profileUpdateError)
    }
  }

  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <ModalContent>
        <ModalHeader title={settingsStrings.profileEditTitle} />
        <form
          onSubmit={(e) => {
            void handleSubmit(onSubmit)(e)
          }}
        >
          <ModalBody className="flex flex-col gap-4">
            <Field
              label={settingsStrings.accountNameLabel}
              required
              error={errors.fullName?.message}
            >
              <Input
                type="text"
                autoFocus
                autoComplete="name"
                error={!!errors.fullName}
                {...register('fullName')}
              />
            </Field>
            <Field label={settingsStrings.accountSpecialtyLabel} error={errors.specialty?.message}>
              <Input
                type="text"
                autoComplete="organization-title"
                error={!!errors.specialty}
                {...register('specialty')}
              />
            </Field>
            <Field
              label={settingsStrings.accountLicenseLabel}
              error={errors.licenseNumber?.message}
            >
              <Input type="text" error={!!errors.licenseNumber} {...register('licenseNumber')} />
            </Field>
            {serverError && (
              <Callout variant="danger" icon={<i className="ph ph-warning" />}>
                {serverError}
              </Callout>
            )}
          </ModalBody>
          <ModalFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              {settingsStrings.cancelButton}
            </Button>
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting ? settingsStrings.savingButton : settingsStrings.saveButton}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  )
}

export function Settings(): JSX.Element {
  const { user } = useAuth()
  const { signOut } = useAuthStore()
  const navigate = useNavigate()
  const [editingProfile, setEditingProfile] = useState(false)

  async function handleSignOut() {
    await signOut()
    void navigate('/login', { replace: true })
  }

  return (
    <div>
      {editingProfile && <ProfileEditModal onClose={() => setEditingProfile(false)} />}

      <h1 className="text-h1 mb-6">{settingsStrings.pageTitle}</h1>

      {user && (
        <Card className="max-w-[560px] mb-6">
          <div className="flex items-start justify-between mb-4">
            <CardTitle>{settingsStrings.accountSectionTitle}</CardTitle>
            <Button variant="secondary" size="sm" onClick={() => setEditingProfile(true)}>
              <i className="ph ph-pencil mr-1.5" />
              {settingsStrings.editButton}
            </Button>
          </div>
          <div className="flex flex-col gap-3">
            <div>
              <span className="text-overline">{settingsStrings.accountNameLabel}</span>
              <div className="text-body">
                {user.fullName ?? <span className="text-n-400">{settingsStrings.notSet}</span>}
              </div>
            </div>
            <div>
              <span className="text-overline">{settingsStrings.accountEmailLabel}</span>
              <div className="text-body">{user.email}</div>
            </div>
            {user.specialty ? (
              <div>
                <span className="text-overline">{settingsStrings.accountSpecialtyLabel}</span>
                <div className="text-body">{user.specialty}</div>
              </div>
            ) : null}
            {user.licenseNumber ? (
              <div>
                <span className="text-overline">{settingsStrings.accountLicenseLabel}</span>
                <div className="text-body text-mono">{user.licenseNumber}</div>
              </div>
            ) : null}
          </div>
        </Card>
      )}

      <Card className="max-w-[560px] mb-6 p-0">
        <Link
          to="/ajustes/ubicaciones"
          className="flex items-center gap-3 px-5 py-4 no-underline text-n-800 border-b border-n-100 hover:bg-n-25 transition-colors duration-[100ms]"
        >
          <i className="ph ph-map-pin text-h3 text-p-500" />
          <div>
            <div className="text-sm font-semibold">{settingsStrings.locationsTitle}</div>
            <div className="text-xs text-n-500">{settingsStrings.locationsDescription}</div>
          </div>
          <i className="ph ph-caret-right ml-auto text-n-400" />
        </Link>
        <Link
          to="/ajustes/plantillas"
          className="flex items-center gap-3 px-5 py-4 no-underline text-n-800 border-b border-n-100 hover:bg-n-25 transition-colors duration-[100ms]"
        >
          <i className="ph ph-file-text text-h3 text-p-500" />
          <div>
            <div className="text-sm font-semibold">{templatesStrings.pageTitle}</div>
            <div className="text-xs text-n-500">{settingsStrings.templatesDescription}</div>
          </div>
          <i className="ph ph-caret-right ml-auto text-n-400" />
        </Link>
        <Link
          to="/ajustes/tipos"
          className="flex items-center gap-3 px-5 py-4 no-underline text-n-800 border-b border-n-100 hover:bg-n-25 transition-colors duration-[100ms]"
        >
          <i className="ph ph-tag text-h3 text-p-500" />
          <div>
            <div className="text-sm font-semibold">{typesStrings.pageTitle}</div>
            <div className="text-xs text-n-500">{settingsStrings.typesDescription}</div>
          </div>
          <i className="ph ph-caret-right ml-auto text-n-400" />
        </Link>
        <Link
          to="/ajustes/registros"
          className="flex items-center gap-3 px-5 py-4 no-underline text-n-800 border-b border-n-100 hover:bg-n-25 transition-colors duration-[100ms]"
        >
          <i className="ph ph-clipboard-text text-h3 text-p-500" />
          <div>
            <div className="text-sm font-semibold">{settingsStrings.auditLogTitle}</div>
            <div className="text-xs text-n-500">{settingsStrings.auditLogDescription}</div>
          </div>
          <i className="ph ph-caret-right ml-auto text-n-400" />
        </Link>
        <Link
          to="/ajustes/horarios"
          className="flex items-center gap-3 px-5 py-4 no-underline text-n-800 hover:bg-n-25 transition-colors duration-[100ms]"
        >
          <i className="ph ph-calendar-check text-h3 text-p-500" />
          <div>
            <div className="text-sm font-semibold">{settingsStrings.schedulesTitle}</div>
            <div className="text-xs text-n-500">{settingsStrings.schedulesDescription}</div>
          </div>
          <i className="ph ph-caret-right ml-auto text-n-400" />
        </Link>
      </Card>

      <Button
        variant="secondary"
        onClick={() => {
          void handleSignOut()
        }}
      >
        <i className="ph ph-sign-out mr-2" />
        {settingsStrings.authSignOut}
      </Button>
    </div>
  )
}
