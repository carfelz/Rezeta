import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { useAuthStore } from '@/store/auth.store'
import { strings } from '@/lib/strings'

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
      <h1 className="text-h1" style={{ marginBottom: 'var(--space-6)' }}>Ajustes</h1>

      {user && (
        <div className="card" style={{ maxWidth: 560, marginBottom: 'var(--space-6)' }}>
          <div className="card__title">Mi cuenta</div>
          <div style={{ marginTop: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
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
        </div>
      )}

      {/* Quick-links to settings sub-sections */}
      <div
        className="card"
        style={{ maxWidth: 560, marginBottom: 'var(--space-6)', padding: 0 }}
      >
        <Link
          to="/ajustes/plantillas"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            padding: 'var(--space-4) var(--space-5)',
            textDecoration: 'none',
            color: 'var(--color-n-800)',
            borderBottom: '1px solid var(--color-n-100)',
          }}
        >
          <i className="ph ph-file-text" style={{ fontSize: 18, color: 'var(--color-p-500)' }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{strings.TEMPLATES_PAGE_TITLE}</div>
            <div style={{ fontSize: 12, color: 'var(--color-n-500)' }}>
              Gestiona las plantillas de protocolos de tu práctica
            </div>
          </div>
          <i className="ph ph-caret-right" style={{ marginLeft: 'auto', color: 'var(--color-n-400)' }} />
        </Link>
        <Link
          to="/ajustes/tipos"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            padding: 'var(--space-4) var(--space-5)',
            textDecoration: 'none',
            color: 'var(--color-n-800)',
          }}
        >
          <i className="ph ph-tag" style={{ fontSize: 18, color: 'var(--color-p-500)' }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{strings.TYPES_PAGE_TITLE}</div>
            <div style={{ fontSize: 12, color: 'var(--color-n-500)' }}>
              Categorías que agrupan tus protocolos
            </div>
          </div>
          <i className="ph ph-caret-right" style={{ marginLeft: 'auto', color: 'var(--color-n-400)' }} />
        </Link>
      </div>

      <button
        className="btn btn--secondary"
        onClick={() => { void handleSignOut() }}
      >
        <i className="ph ph-sign-out" style={{ marginRight: 6 }} />
        {strings.AUTH_SIGN_OUT}
      </button>
    </div>
  )
}
