import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { AuthGate } from '@/components/auth/AuthGate'
import { PublicOnlyGate } from '@/components/auth/PublicOnlyGate'
import { RequireCan } from '@/components/auth/RequireCan'
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
import { Users } from '@/pages/settings/Users'
import { AuditLog } from '@/pages/settings/AuditLog'
import { Schedules } from '@/pages/settings/Schedules'
import { AppPrototype } from '@/pages/settings/AppPrototype'
import { DesignSystemReference } from '@/pages/settings/DesignSystemReference'
import { Login } from '@/pages/Login'
import { SetPassword } from '@/pages/SetPassword'
import { NotFound } from '@/pages/NotFound'
import { Onboarding } from '@/pages/Onboarding'
import { OnboardingCustomize } from '@/pages/OnboardingCustomize'
import { OnboardingGate } from '@/components/auth/OnboardingGate'

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
    path: '/establecer-contrasena',
    element: (
      <PublicOnlyGate>
        <SetPassword />
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
      {
        path: 'agenda',
        element: (
          <RequireCan module="appointments">
            <Schedule />
          </RequireCan>
        ),
      },
      {
        path: 'pacientes',
        element: (
          <RequireCan module="patients">
            <Patients />
          </RequireCan>
        ),
      },
      {
        path: 'pacientes/:id',
        element: (
          <RequireCan module="patients">
            <PatientDetail />
          </RequireCan>
        ),
      },
      {
        path: 'consultas/nueva',
        element: (
          <RequireCan module="consultations">
            <NewConsultation />
          </RequireCan>
        ),
      },
      {
        path: 'protocolos',
        element: (
          <RequireCan module="protocols">
            <Protocols />
          </RequireCan>
        ),
      },
      {
        path: 'protocolos/:id',
        element: (
          <RequireCan module="protocols">
            <ProtocolViewer />
          </RequireCan>
        ),
      },
      {
        path: 'protocolos/:id/edit',
        element: (
          <RequireCan module="protocols">
            <ProtocolEditor />
          </RequireCan>
        ),
      },
      {
        path: 'facturacion',
        element: (
          <RequireCan module="billing">
            <Billing />
          </RequireCan>
        ),
      },
      {
        path: 'ajustes',
        element: (
          <RequireCan module="templates">
            <Settings />
          </RequireCan>
        ),
      },
      {
        path: 'ajustes/plantillas',
        element: (
          <RequireCan module="templates">
            <Templates />
          </RequireCan>
        ),
      },
      {
        path: 'ajustes/plantillas/new',
        element: (
          <RequireCan module="templates">
            <TemplateEditorNew />
          </RequireCan>
        ),
      },
      {
        path: 'ajustes/plantillas/:id/edit',
        element: (
          <RequireCan module="templates">
            <TemplateEditor />
          </RequireCan>
        ),
      },
      {
        path: 'ajustes/tipos',
        element: (
          <RequireCan module="categories">
            <Types />
          </RequireCan>
        ),
      },
      {
        path: 'ajustes/usuarios',
        element: (
          <RequireCan module="users">
            <Users />
          </RequireCan>
        ),
      },
      {
        path: 'ajustes/ubicaciones',
        element: (
          <RequireCan module="locations">
            <Locations />
          </RequireCan>
        ),
      },
      {
        path: 'ajustes/registros',
        element: (
          <RequireCan module="audit_log">
            <AuditLog />
          </RequireCan>
        ),
      },
      {
        path: 'ajustes/horarios',
        element: (
          <RequireCan module="schedules_config">
            <Schedules />
          </RequireCan>
        ),
      },
      {
        path: 'ajustes/design-system/prototype',
        element: (
          <RequireCan module="templates">
            <AppPrototype />
          </RequireCan>
        ),
      },
      {
        path: 'ajustes/design-system/reference',
        element: (
          <RequireCan module="templates">
            <DesignSystemReference />
          </RequireCan>
        ),
      },
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
    children: [
      {
        path: 'consultas/:id',
        element: (
          <RequireCan module="consultations">
            <Consultation />
          </RequireCan>
        ),
      },
    ],
  },

  // ── Catch-all 404 ──────────────────────────────────────────────────────────
  { path: '*', element: <NotFound /> },
])

export function App(): JSX.Element {
  return <RouterProvider router={router} />
}
