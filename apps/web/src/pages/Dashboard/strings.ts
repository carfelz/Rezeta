export const dashboardStrings = {
  greeting: (fullName: string | null) => {
    const hour = new Date().getHours()
    const salutation = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'
    if (!fullName) return `${salutation}, Dr.`
    // Extract last name (last word), dropping leading "Dr." if present
    const parts = fullName
      .replace(/^Dr\.\s*/i, '')
      .trim()
      .split(' ')
    /* v8 ignore next -- defensive nullish chain, .split always returns ≥1 element */
    const lastName = parts[parts.length - 1] ?? parts[0] ?? fullName
    return `${salutation}, Dr. ${lastName}.`
  },
  underConstruction: 'Panel en construcción',
  underConstructionDescription: 'El resumen de actividad del día aparecerá aquí.',

  // Subtitle
  subtitleWelcome: 'Bienvenido a Rezeta.',
  subtitleConsultations: (n: number) =>
    `Tienes ${n} consulta${n !== 1 ? 's' : ''} programada${n !== 1 ? 's' : ''} hoy.`,
  subtitleNextAppt: (mins: number) =>
    ` Tu próxima cita es en ${mins} minuto${mins !== 1 ? 's' : ''}.`,
  subtitleNoConsultations: 'No tienes consultas programadas hoy.',

  // KPI cards
  kpiConsultationsLabel: 'Consultas hoy',
  kpiConsultationsLoading: '…',
  kpiConsultationsCompleted: (pct: number) => `${pct}% completadas`,
  kpiConsultationsNone: 'Sin citas hoy',
  kpiPatientsLabel: 'Pacientes activos',
  kpiPatientsAdded: (n: number) => `+${n} este mes`,
  kpiPatientsNone: 'Sin nuevos este mes',
  kpiBillingLabel: (month: string) => `Facturación · ${month}`,
  kpiBillingNoPrev: 'Sin datos del mes anterior',
  kpiBillingDelta: (pct: number) => `${pct}% vs mes anterior`,
  kpiProtocolsLabel: 'Protocolos activos',
  kpiProtocolsActive: 'en uso',
  kpiProtocolsNone: 'aún no hay protocolos',

  // PageHeader buttons
  pageHeaderViewSchedule: 'Ver agenda',
  pageHeaderNewConsultation: 'Nueva consulta',

  // UpcomingAppointments
  upcomingTitle: 'Próximas citas',
  upcomingViewAll: 'Ver agenda completa →',
  upcomingEmpty: 'No hay citas programadas para hoy',

  // UpcomingRow
  upcomingRowPending: 'En espera',
  upcomingRowStart: 'Iniciar',
  upcomingRowContinue: 'Continuar',

  // RecentPatients
  recentPatientsTitle: 'Pacientes recientes',
  recentPatientsViewAll: 'Ver todos →',
  recentPatientsEmpty: 'Aún no tienes pacientes registrados.',
  recentPatientsNoDocument: 'Sin documento',

  // RecentProtocols
  recentProtocolsTitle: 'Protocolos recientes',
  recentProtocolsViewAll: 'Ver todos →',
  recentProtocolsEmpty: 'Aún no tienes protocolos. Crea uno desde la sección Protocolos.',
  recentProtocolsUpdated: 'actualizado',

  // ActivityFeed
  activityFeedTitle: 'Actividad reciente',
  activityFeedEmpty: 'Sin actividad reciente.',
} as const
