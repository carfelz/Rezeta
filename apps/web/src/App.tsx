import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { AuthGate } from '@/components/auth/AuthGate'
import { PublicOnlyGate } from '@/components/auth/PublicOnlyGate'
import { Dashboard } from '@/pages/Dashboard'
import { Agenda } from '@/pages/Agenda'
import { Pacientes } from '@/pages/Pacientes'
import { PacienteDetalle } from '@/pages/PacienteDetalle'
import { Protocolos } from '@/pages/Protocolos'
import { ProtocolViewer } from '@/pages/ProtocolViewer'
import { ProtocolEditor } from '@/pages/ProtocolEditor'
import { Facturacion } from '@/pages/Facturacion'
import { Ajustes } from '@/pages/Ajustes'
import { Login } from '@/pages/Login'
import { Signup } from '@/pages/Signup'

const router = createBrowserRouter([
  // ── Public-only routes (redirect authenticated users away) ────────────────
  {
    path: '/login',
    element: <PublicOnlyGate><Login /></PublicOnlyGate>,
  },
  {
    path: '/signup',
    element: <PublicOnlyGate><Signup /></PublicOnlyGate>,
  },

  // ── Protected routes (wrapped in AuthGate) ─────────────────────────────────
  {
    element: (
      <AuthGate>
        <AppLayout />
      </AuthGate>
    ),
    children: [
      // Root redirect
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'agenda', element: <Agenda /> },
      { path: 'pacientes', element: <Pacientes /> },
      { path: 'pacientes/:patientId', element: <PacienteDetalle /> },
      { path: 'protocolos', element: <Protocolos /> },
      { path: 'protocolos/:id', element: <ProtocolViewer /> },
      { path: 'protocolos/:id/edit', element: <ProtocolEditor /> },
      { path: 'facturacion', element: <Facturacion /> },
      { path: 'ajustes', element: <Ajustes /> },
    ],
  },
])

export function App(): JSX.Element {
  return <RouterProvider router={router} />
}
