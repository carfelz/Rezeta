import { useAuth } from '@/hooks/use-auth'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'

export function Ajustes(): JSX.Element {
  const { user } = useAuth()

  async function handleSignOut() {
    if (auth) await signOut(auth)
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

      <button className="btn btn--danger" onClick={() => { void handleSignOut() }}>
        <i className="ph ph-sign-out" />
        Cerrar sesión
      </button>
    </div>
  )
}
