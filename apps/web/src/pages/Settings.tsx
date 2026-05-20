import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { useAuthStore } from '@/store/auth.store'
import { settingsStrings, templatesStrings, typesStrings } from './settings/strings'
import { Button, Card, CardTitle } from '@/components/ui'

export function Settings(): JSX.Element {
  const { user } = useAuth()
  const { signOut } = useAuthStore()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    void navigate('/login', { replace: true })
  }

  return (
    <div>
      <h1 className="text-h1 mb-6">{settingsStrings.pageTitle}</h1>

      {user && (
        <Card className="max-w-[560px] mb-6">
          <CardTitle>{settingsStrings.accountSectionTitle}</CardTitle>
          <div className="mt-4 flex flex-col gap-3">
            <div>
              <span className="text-overline">{settingsStrings.accountNameLabel}</span>
              <div className="text-body">{user.fullName}</div>
            </div>
            <div>
              <span className="text-overline">{settingsStrings.accountEmailLabel}</span>
              <div className="text-body">{user.email}</div>
            </div>
            {user.specialty && (
              <div>
                <span className="text-overline">{settingsStrings.accountSpecialtyLabel}</span>
                <div className="text-body">{user.specialty}</div>
              </div>
            )}
            {user.licenseNumber && (
              <div>
                <span className="text-overline">{settingsStrings.accountLicenseLabel}</span>
                <div className="text-body text-mono">{user.licenseNumber}</div>
              </div>
            )}
          </div>
        </Card>
      )}

      <Card className="max-w-[560px] mb-6 p-0">
        <Link
          to="/ajustes/ubicaciones"
          className="flex items-center gap-3 px-5 py-4 no-underline text-n-800 border-b border-n-100 hover:bg-n-25 transition-colors duration-[100ms]"
        >
          <i className="ph ph-map-pin text-[18px] text-p-500" />
          <div>
            <div className="text-[13px] font-semibold">{settingsStrings.locationsTitle}</div>
            <div className="text-[12px] text-n-500">{settingsStrings.locationsDescription}</div>
          </div>
          <i className="ph ph-caret-right ml-auto text-n-400" />
        </Link>
        <Link
          to="/ajustes/plantillas"
          className="flex items-center gap-3 px-5 py-4 no-underline text-n-800 border-b border-n-100 hover:bg-n-25 transition-colors duration-[100ms]"
        >
          <i className="ph ph-file-text text-[18px] text-p-500" />
          <div>
            <div className="text-[13px] font-semibold">{templatesStrings.pageTitle}</div>
            <div className="text-[12px] text-n-500">{settingsStrings.templatesDescription}</div>
          </div>
          <i className="ph ph-caret-right ml-auto text-n-400" />
        </Link>
        <Link
          to="/ajustes/tipos"
          className="flex items-center gap-3 px-5 py-4 no-underline text-n-800 border-b border-n-100 hover:bg-n-25 transition-colors duration-[100ms]"
        >
          <i className="ph ph-tag text-[18px] text-p-500" />
          <div>
            <div className="text-[13px] font-semibold">{typesStrings.pageTitle}</div>
            <div className="text-[12px] text-n-500">{settingsStrings.typesDescription}</div>
          </div>
          <i className="ph ph-caret-right ml-auto text-n-400" />
        </Link>
        <Link
          to="/ajustes/registros"
          className="flex items-center gap-3 px-5 py-4 no-underline text-n-800 border-b border-n-100 hover:bg-n-25 transition-colors duration-[100ms]"
        >
          <i className="ph ph-clipboard-text text-[18px] text-p-500" />
          <div>
            <div className="text-[13px] font-semibold">{settingsStrings.auditLogTitle}</div>
            <div className="text-[12px] text-n-500">{settingsStrings.auditLogDescription}</div>
          </div>
          <i className="ph ph-caret-right ml-auto text-n-400" />
        </Link>
        <Link
          to="/ajustes/horarios"
          className="flex items-center gap-3 px-5 py-4 no-underline text-n-800 border-b border-n-100 hover:bg-n-25 transition-colors duration-[100ms]"
        >
          <i className="ph ph-calendar-check text-[18px] text-p-500" />
          <div>
            <div className="text-[13px] font-semibold">{settingsStrings.schedulesTitle}</div>
            <div className="text-[12px] text-n-500">{settingsStrings.schedulesDescription}</div>
          </div>
          <i className="ph ph-caret-right ml-auto text-n-400" />
        </Link>
        <Link
          to="/ajustes/design-system/prototype"
          className="flex items-center gap-3 px-5 py-4 no-underline text-n-800 border-b border-n-100 hover:bg-n-25 transition-colors duration-[100ms]"
        >
          <i className="ph ph-monitor text-[18px] text-p-500" />
          <div>
            <div className="text-[13px] font-semibold">
              {settingsStrings.designSystemPrototypeTitle}
            </div>
            <div className="text-[12px] text-n-500">
              {settingsStrings.designSystemPrototypeDescription}
            </div>
          </div>
          <i className="ph ph-caret-right ml-auto text-n-400" />
        </Link>
        <Link
          to="/ajustes/design-system/reference"
          className="flex items-center gap-3 px-5 py-4 no-underline text-n-800 hover:bg-n-25 transition-colors duration-[100ms]"
        >
          <i className="ph ph-squares-four text-[18px] text-p-500" />
          <div>
            <div className="text-[13px] font-semibold">
              {settingsStrings.designSystemReferenceTitle}
            </div>
            <div className="text-[12px] text-n-500">
              {settingsStrings.designSystemReferenceDescription}
            </div>
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
