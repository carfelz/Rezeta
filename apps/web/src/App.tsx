import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { Dashboard } from '@/pages/Dashboard'
import { Agenda } from '@/pages/Agenda'
import { Pacientes } from '@/pages/Pacientes'
import { PacienteDetalle } from '@/pages/PacienteDetalle'
import { Protocolos } from '@/pages/Protocolos'
import { Facturacion } from '@/pages/Facturacion'
import { Ajustes } from '@/pages/Ajustes'
import { Login } from '@/pages/Login'

const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'agenda', element: <Agenda /> },
      { path: 'pacientes', element: <Pacientes /> },
      { path: 'pacientes/:patientId', element: <PacienteDetalle /> },
      { path: 'protocolos', element: <Protocolos /> },
      { path: 'facturacion', element: <Facturacion /> },
      { path: 'ajustes', element: <Ajustes /> },
    ],
  },
])

export function App(): JSX.Element {
  return <RouterProvider router={router} />
}
