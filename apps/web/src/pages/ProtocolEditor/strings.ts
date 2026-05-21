export const protocolEditorStrings = {
  // ── Header ──────────────────────────────────────────────────────────────────
  titleRenameTooltip: 'Haz clic para renombrar',
  blockCount: (n: number) => `${n} ${n === 1 ? 'bloque' : 'bloques'}`,
  sectionCount: (n: number) => `${n} ${n === 1 ? 'sección' : 'secciones'}`,
  saveButton: 'Guardar versión',
  save: 'Guardar',
  publish: (_n: number) => 'Publicar',
  preview: 'Vista previa',
  unsaved: 'Cambios sin guardar',
  unsavedChanges: 'Cambios sin publicar',
  saving: 'Guardando...',
  back: 'Protocolos',
  version: (n: number) => `v${n}`,
  statusDraft: 'Borrador',
  statusActive: 'Activo',

  // ── Palette ──────────────────────────────────────────────────────────────────
  paletteTitle: 'Bloques',
  paletteComingSoon: 'Disponible próximamente',
  previewTitle: 'Vista previa',
  paletteHeader: 'Bloques disponibles',
  paletteDisabledTooltip: 'Disponible próximamente',
  paletteAddSection: 'Añadir sección',
  paletteAddText: 'Añadir bloque de texto',
  paletteAddAlert: 'Añadir bloque de alerta',
  paletteAddChecklist: 'Añadir lista de verificación',
  paletteAddSteps: 'Añadir pasos secuenciales',
  paletteAddDecision: 'Añadir bloque de decisión',
  paletteAddDosage: 'Añadir tabla de dosificación',

  // ── History ───────────────────────────────────────────────────────────────────
  historyButton: 'Historial',
  historyCloseLabel: 'Cerrar historial',
  historyViewAll: 'Ver historial completo',
  historyTitle: 'Historial de versiones',
  historyEmpty: 'Sin versiones guardadas.',
  historyCurrent: 'Actual',
  historyNoSummary: 'Sin resumen',
  historyView: 'Ver contenido',
  historyCompare: 'Comparar con actual',
  historyRestore: 'Restaurar como nueva versión',
  historyRestoring: 'Restaurando…',
  historySelectPrompt: 'Selecciona una versión para ver su contenido.',
  historyPreviewTitle: 'Vista previa',

  // ── Canvas ────────────────────────────────────────────────────────────────────
  addBlockFooter: 'Añadir bloque',
  tocEmptySections: 'Sin secciones',
  sectionDefaultTitle: 'Nueva sección',

  // ── Save modal ────────────────────────────────────────────────────────────────
  saveModalTitle: 'Guardar versión',
  saveModalSubtitle: 'Añade un resumen del cambio (opcional).',
  saveModalLabel: 'Resumen del cambio',
  saveModalPlaceholder: 'Ej. Actualicé las dosis de primera línea',
  saveModalSaveDraft: 'Guardar como borrador',
  saveModalPublish: 'Guardar y publicar',
  saveModalCancel: 'Cancelar',

  // ── Publish modal ─────────────────────────────────────────────────────────────
  publishModalTitle: 'Publicar protocolo',
  publishModalSubtitle: 'Añade un resumen del cambio (opcional).',
  publishModalLabel: 'Resumen del cambio',
  publishModalPlaceholder: 'Ej. Actualicé las dosis de primera línea',
  publishModalCancel: 'Cancelar',

  // ── Draft recovery banner ─────────────────────────────────────────────────────
  draftRecovered: 'Se recuperó un borrador no guardado.',
  draftUse: 'Usar borrador',
  draftDiscard: 'Descartar',
  navigateAway: 'Tienes cambios sin guardar. ¿Descartar y salir?',

  // ── Mobile gate ───────────────────────────────────────────────────────────────
  mobileGateTitle: 'Editor no disponible en móvil',
  mobileGateBody:
    'El editor de protocolos requiere una pantalla más grande. Usa un computador o tablet horizontal.',

  // ── Shared with viewer (not found / no content) ───────────────────────────────
  notFound: 'Protocolo no encontrado.',
  noContent: 'Este protocolo no tiene contenido todavía.',
} as const
