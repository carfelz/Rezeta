export const billingStrings = {
  // ── Billing index ───────────────────────────────────────────────────────────
  pageTitle: 'Facturación',
  newInvoiceButton: 'Nueva factura',
  loadingInvoices: 'Cargando facturas...',
  errorLoadingInvoices: 'No se pudo cargar la lista de facturas.',
  emptyTitle: 'No hay facturas',
  emptyDescription:
    'Las facturas se generan automáticamente al firmar una consulta, o puedes crear una manualmente.',
  emptyCta: 'Nueva factura',
  tableColNumber: 'Número',
  tableColPatientLocation: 'Paciente / Ubicación',
  tableColStatus: 'Estado',
  tableColAmount: 'Monto',

  // ── InvoiceRow ──────────────────────────────────────────────────────────────
  downloadPdfLabel: 'Descargar PDF',
  editInvoiceLabel: 'Editar factura',
  deleteInvoiceLabel: 'Eliminar factura',
  netLabel: (amount: string) => `Neto: ${amount}`,

  // ── DeleteConfirmModal ──────────────────────────────────────────────────────
  deleteModalTitle: 'Eliminar factura',
  deleteModalSubtitle: (invoiceNumber: string) =>
    `¿Eliminar la factura ${invoiceNumber}? Esta acción no se puede deshacer.`,
  deleteCancelButton: 'Cancelar',
  deletingButton: 'Eliminando...',
  deleteConfirmButton: 'Eliminar factura',
  deleteErrorMessage: 'No se pudo eliminar la factura. Intenta de nuevo.',

  // ── InvoiceFormModal ────────────────────────────────────────────────────────
  createModalTitle: 'Nueva factura',
  editModalTitle: 'Editar factura',
  fieldPatient: 'Paciente',
  fieldPatientPlaceholder: 'Seleccionar paciente',
  fieldLocation: 'Ubicación',
  fieldLocationPlaceholder: 'Seleccionar ubicación',
  fieldCurrency: 'Moneda',
  fieldItems: 'Ítems',
  itemColDescription: 'Descripción',
  itemColQty: 'Cant.',
  itemColUnitPrice: 'Precio unit.',
  itemColTotal: 'Total',
  itemDescriptionPlaceholder: 'Descripción del servicio',
  removeItemLabel: 'Eliminar ítem',
  addItemLink: 'Añadir ítem',
  summarySubtotal: 'Subtotal',
  summaryCommission: (pct: number) => `Comisión (${pct}%)`,
  summaryNet: 'Neto al médico',
  fieldNotes: 'Notas',
  fieldNotesPlaceholder: 'Opcional',
  cancelButton: 'Cancelar',
  savingButton: 'Guardando...',
  saveButton: 'Guardar cambios',
  createButton: 'Crear factura',
  createErrorMessage: 'No se pudo crear la factura. Intenta de nuevo.',
  updateErrorMessage: 'No se pudo actualizar la factura. Intenta de nuevo.',
} as const
