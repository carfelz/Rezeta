import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { AuthGate } from '@/components/auth/AuthGate'
import { PublicOnlyGate } from '@/components/auth/PublicOnlyGate'
import { Dashboard } from '@/pages/Dashboard'
import { Agenda } from '@/pages/Agenda'
import { Pacientes } from '@/pages/Pacientes'
import { Consulta } from '@/pages/Consulta'
import { ConsultaNueva } from '@/pages/ConsultaNueva'
import { Protocolos } from '@/pages/Protocolos'
import { ProtocolViewer } from '@/pages/ProtocolViewer'
import { ProtocolEditor } from '@/pages/ProtocolEditor'
import { Facturacion } from '@/pages/Facturacion'
import { Ajustes } from '@/pages/Ajustes'
import { Plantillas } from '@/pages/ajustes/Plantillas'
import { PlantillaEditor, PlantillaEditorNew } from '@/pages/ajustes/PlantillaEditor'
import { Tipos } from '@/pages/ajustes/Tipos'
import { Ubicaciones } from '@/pages/ajustes/Ubicaciones'
import { AppPrototype } from '@/pages/ajustes/AppPrototype'
import { DesignSystemReference } from '@/pages/ajustes/DesignSystemReference'
import { Login } from '@/pages/Login'
import { Signup } from '@/pages/Signup'
import { Bienvenido } from '@/pages/Bienvenido'
import { BienvenidoPersonalizar } from '@/pages/BienvenidoPersonalizar'
import { BienvenidoGate } from '@/components/auth/BienvenidoGate'

const router = createBrowserRouter([
  // ── Public-only routes (redirect authenticated users away) ────────────────
  {
    path: '/login',
    element: (
      <PublicOnlyGate>
        <Login />
      </PublicOnlyGate>
    ),
  },
  {
    path: '/signup',
    element: (
      <PublicOnlyGate>
        <Signup />
      </PublicOnlyGate>
    ),
  },

  // ── Onboarding routes (auth required, redirect away if already seeded) ──────
  {
    element: (
      <AuthGate>
        <BienvenidoGate />
      </AuthGate>
    ),
    children: [
      { path: 'bienvenido', element: <Bienvenido /> },
      { path: 'bienvenido/personalizar', element: <BienvenidoPersonalizar /> },
    ],
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
      { path: 'consultas/nueva', element: <ConsultaNueva /> },
      { path: 'consultas/:id', element: <Consulta /> },
      { path: 'protocolos', element: <Protocolos /> },
      { path: 'protocolos/:id', element: <ProtocolViewer /> },
      { path: 'protocolos/:id/edit', element: <ProtocolEditor /> },
      { path: 'facturacion', element: <Facturacion /> },
      { path: 'ajustes', element: <Ajustes /> },
      { path: 'ajustes/plantillas', element: <Plantillas /> },
      { path: 'ajustes/plantillas/new', element: <PlantillaEditorNew /> },
      { path: 'ajustes/plantillas/:id/edit', element: <PlantillaEditor /> },
      { path: 'ajustes/tipos', element: <Tipos /> },
      { path: 'ajustes/ubicaciones', element: <Ubicaciones /> },
      { path: 'ajustes/design-system/prototype', element: <AppPrototype /> },
      { path: 'ajustes/design-system/reference', element: <DesignSystemReference /> },
    ],
  },
])

export function App(): JSX.Element {
  return <RouterProvider router={router} />
}
