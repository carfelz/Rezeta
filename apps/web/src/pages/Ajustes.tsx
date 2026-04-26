import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { useAuthStore } from '@/store/auth.store'
import { strings } from '@/lib/strings'
import { Button, Card, CardTitle } from '@/components/ui'

export function Ajustes(): JSX.Element {
  const { user } = useAuth()
  const { signOut } = useAuthStore()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    void navigate('/login', { replace: true })
  }

  return (
    <div>
      <h1 className="text-h1 mb-6">Ajustes</h1>

      {user && (
        <Card className="max-w-[560px] mb-6">
          <CardTitle>Mi cuenta</CardTitle>
          <div className="mt-4 flex flex-col gap-3">
            <div>
              <span className="text-overline">Nombre</span>
              <div className="text-body">{user.fullName}</div>
            </div>
            <div>
              <span className="text-overline">Correo electrónico</span>
              <div className="text-body">{user.email}</div>
            </div>
            {user.specialty && (
              <div>
                <span className="text-overline">Especialidad</span>
                <div className="text-body">{user.specialty}</div>
              </div>
            )}
            {user.licenseNumber && (
              <div>
                <span className="text-overline">No. de licencia</span>
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
            <div className="text-[13px] font-semibold">Ubicaciones</div>
            <div className="text-[12px] text-n-500">
              Centros médicos y consultorios donde ejerces
            </div>
          </div>
          <i className="ph ph-caret-right ml-auto text-n-400" />
        </Link>
        <Link
          to="/ajustes/plantillas"
          className="flex items-center gap-3 px-5 py-4 no-underline text-n-800 border-b border-n-100 hover:bg-n-25 transition-colors duration-[100ms]"
        >
          <i className="ph ph-file-text text-[18px] text-p-500" />
          <div>
            <div className="text-[13px] font-semibold">{strings.TEMPLATES_PAGE_TITLE}</div>
            <div className="text-[12px] text-n-500">
              Gestiona las plantillas de protocolos de tu práctica
            </div>
          </div>
          <i className="ph ph-caret-right ml-auto text-n-400" />
        </Link>
        <Link
          to="/ajustes/tipos"
          className="flex items-center gap-3 px-5 py-4 no-underline text-n-800 border-b border-n-100 hover:bg-n-25 transition-colors duration-[100ms]"
        >
          <i className="ph ph-tag text-[18px] text-p-500" />
          <div>
            <div className="text-[13px] font-semibold">{strings.TYPES_PAGE_TITLE}</div>
            <div className="text-[12px] text-n-500">Categorías que agrupan tus protocolos</div>
          </div>
          <i className="ph ph-caret-right ml-auto text-n-400" />
        </Link>
        <Link
          to="/ajustes/design-system/prototype"
          className="flex items-center gap-3 px-5 py-4 no-underline text-n-800 border-b border-n-100 hover:bg-n-25 transition-colors duration-[100ms]"
        >
          <i className="ph ph-monitor text-[18px] text-p-500" />
          <div>
            <div className="text-[13px] font-semibold">{strings.DESIGN_SYSTEM_PROTOTYPE_TITLE}</div>
            <div className="text-[12px] text-n-500">
              {strings.DESIGN_SYSTEM_PROTOTYPE_DESCRIPTION}
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
            <div className="text-[13px] font-semibold">{strings.DESIGN_SYSTEM_REFERENCE_TITLE}</div>
            <div className="text-[12px] text-n-500">
              {strings.DESIGN_SYSTEM_REFERENCE_DESCRIPTION}
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
        <i className="ph ph-sign-out mr-1.5" />
        {strings.AUTH_SIGN_OUT}
      </Button>
    </div>
  )
}
