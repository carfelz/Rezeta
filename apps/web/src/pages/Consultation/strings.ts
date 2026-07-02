export const consultationPageStrings = {
  loading: 'Cargando consulta…',
  loadError: 'No se pudo cargar la consulta.',
  backButton: 'Volver',
  complementaryInfoLabel: 'Información complementaria',
} as const

export const protocolPanelStrings = {
  noProtocolTitle: 'Esta consulta aún no tiene protocolos',
  addProtocol: 'Agregar protocolo',
} as const

export const postSignPanelStrings = {
  header: 'Después de firmar',
  invoiceCreatedLabel: (total: string) => `Factura borrador creada · ${total}`,
  issueButton: 'Emitir factura',
  issuingButton: 'Emitiendo…',
  issuedLabel: 'Factura emitida',
  viewInBillingLink: 'Ver en Facturación',
  skippedNoFeeMessage: 'No se creó factura: no hay tarifa configurada para esta ubicación.',
  configureFeeLink: 'Configurar tarifa',
  createManualLink: 'Crear factura manual',
  failedMessage: 'No se pudo crear la factura.',
} as const

export const newConsultationStrings = {
  pageTitle: 'Nueva consulta',
  openEmptyButton: 'Iniciar consulta',
  creatingButton: 'Creando…',
  breadcrumbPatients: 'Pacientes',
  breadcrumbNewConsultation: 'Nueva consulta',
  breadcrumbDatePrefix: 'Consulta',
  selectPatientLocationError: 'Selecciona paciente y ubicación antes de continuar.',
  createError: 'No se pudo crear la consulta. Inténtalo de nuevo.',
  readyTitle: 'Todo listo para comenzar',
  readyDescription: 'Puedes añadir protocolos una vez que abras la consulta.',
} as const
