import { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import { auth } from '@/lib/firebase'

export function Login(): JSX.Element {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsLoading(true)
    try {
      if (!auth) throw new Error('Firebase not configured')
      await signInWithEmailAndPassword(auth, email, password)
      void navigate('/dashboard')
    } catch {
      setError('Correo o contraseña incorrectos.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-n-25)',
      }}
    >
      <div className="card" style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ marginBottom: 'var(--space-6)', textAlign: 'center' }}>
          <div
            style={{
              width: 44,
              height: 44,
              background: 'var(--color-p-500)',
              borderRadius: 8,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-serif)',
              fontSize: 24,
              fontWeight: 500,
              color: 'white',
              marginBottom: 'var(--space-4)',
            }}
          >
            R
          </div>
          <h1 className="text-h2">Bienvenido a Rezeta</h1>
          <p className="text-body-sm" style={{ color: 'var(--color-n-500)', marginTop: 4 }}>
            Inicia sesión para continuar
          </p>
        </div>

        <form onSubmit={(e) => { void handleSubmit(e) }} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="field">
            <label className="field__label">Correo electrónico</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="doctor@ejemplo.com"
              required
            />
          </div>

          <div className="field">
            <label className="field__label">Contraseña</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="callout callout--danger">
              <i className="ph ph-warning" />
              <div className="callout__body">{error}</div>
            </div>
          )}

          <button className="btn btn--primary btn--lg" type="submit" disabled={isLoading}>
            {isLoading ? 'Iniciando sesión...' : 'Iniciar sesión'}
          </button>
        </form>
      </div>
    </div>
  )
}
