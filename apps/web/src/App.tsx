import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { AuthGate } from '@/components/auth/AuthGate'
import { PublicOnlyGate } from '@/components/auth/PublicOnlyGate'
import { Dashboard } from '@/pages/Dashboard'
import { Schedule } from '@/pages/Schedule'
import { Patients } from '@/pages/Patients'
import { PatientDetail } from '@/pages/PatientDetail'
import { Consultation } from '@/pages/Consultation'
import { NewConsultation } from '@/pages/NewConsultation'
import { Protocols } from '@/pages/Protocols'
import { ProtocolViewer } from '@/pages/ProtocolViewer'
import { ProtocolEditor } from '@/pages/ProtocolEditor'
import { Billing } from '@/pages/Billing'
import { Settings } from '@/pages/Settings'
import { Templates } from '@/pages/settings/Templates'
import { TemplateEditor, TemplateEditorNew } from '@/pages/settings/TemplateEditor'
import { Types } from '@/pages/settings/Types'
import { Locations } from '@/pages/settings/Locations'
import { AuditLog } from '@/pages/settings/AuditLog'
import { Schedules } from '@/pages/settings/Schedules'
import { AppPrototype } from '@/pages/settings/AppPrototype'
import { DesignSystemReference } from '@/pages/settings/DesignSystemReference'
import { Login } from '@/pages/Login'
import { NotFound } from '@/pages/NotFound'
import { Signup } from '@/pages/Signup'
import { Onboarding } from '@/pages/Onboarding'
import { OnboardingCustomize } from '@/pages/OnboardingCustomize'
import { OnboardingGate } from '@/components/auth/OnboardingGate'
import { StripPreview } from '@/pages/_preview/StripPreview'
import { EdgePreview } from '@/pages/_preview/EdgePreview'
import { CanvasPreview } from '@/pages/_preview/CanvasPreview'
import { OrderQueuePreview } from '@/pages/_preview/OrderQueuePreview'

const router = createBrowserRouter([
  // ── Dev-only auth-free previews ────────────────────────────────────────────
  { path: '/_preview/strip', element: <StripPreview /> },
  { path: '/_preview/edge', element: <EdgePreview /> },
  { path: '/_preview/canvas', element: <CanvasPreview /> },
  { path: '/_preview/order-queue', element: <OrderQueuePreview /> },
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
        <OnboardingGate />
      </AuthGate>
    ),
    errorElement: <NotFound />,
    children: [
      { path: 'bienvenido', element: <Onboarding /> },
      { path: 'bienvenido/personalizar', element: <OnboardingCustomize /> },
    ],
  },

  // ── Protected routes (wrapped in AuthGate) ─────────────────────────────────
  {
    element: (
      <AuthGate>
        <AppLayout />
      </AuthGate>
    ),
    errorElement: <NotFound />,
    children: [
      // Root redirect
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'agenda', element: <Schedule /> },
      { path: 'pacientes', element: <Patients /> },
      { path: 'pacientes/:id', element: <PatientDetail /> },
      { path: 'consultas/nueva', element: <NewConsultation /> },
      { path: 'protocolos', element: <Protocols /> },
      { path: 'protocolos/:id', element: <ProtocolViewer /> },
      { path: 'protocolos/:id/edit', element: <ProtocolEditor /> },
      { path: 'facturacion', element: <Billing /> },
      { path: 'ajustes', element: <Settings /> },
      { path: 'ajustes/plantillas', element: <Templates /> },
      { path: 'ajustes/plantillas/new', element: <TemplateEditorNew /> },
      { path: 'ajustes/plantillas/:id/edit', element: <TemplateEditor /> },
      { path: 'ajustes/tipos', element: <Types /> },
      { path: 'ajustes/ubicaciones', element: <Locations /> },
      { path: 'ajustes/registros', element: <AuditLog /> },
      { path: 'ajustes/horarios', element: <Schedules /> },
      { path: 'ajustes/design-system/prototype', element: <AppPrototype /> },
      { path: 'ajustes/design-system/reference', element: <DesignSystemReference /> },
    ],
  },

  // ── Full-bleed protected routes (no topbar, page owns the viewport) ────────
  {
    element: (
      <AuthGate>
        <AppLayout fullBleed />
      </AuthGate>
    ),
    errorElement: <NotFound />,
    children: [{ path: 'consultas/:id', element: <Consultation /> }],
  },

  // ── Catch-all 404 ──────────────────────────────────────────────────────────
  { path: '*', element: <NotFound /> },
])

export function App(): JSX.Element {
  return <RouterProvider router={router} />
}
