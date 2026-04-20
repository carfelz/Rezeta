/**
 * Central Spanish UI strings.
 *
 * All user-facing text in the application must be sourced from here.
 * Do NOT hardcode Spanish strings in components — import from this module.
 *
 * Naming convention: SCREEN_ELEMENT or DOMAIN_CONTEXT
 */

export const strings = {
  // ── Branding ───────────────────────────────────────────────────────────────
  APP_NAME: 'Rezeta',
  APP_TAGLINE: 'Un solo sistema, todos tus centros.',

  // ── Auth — General ─────────────────────────────────────────────────────────
  AUTH_SIGN_OUT: 'Cerrar sesión',
  AUTH_SIGNING_OUT: 'Cerrando sesión...',

  // ── Auth — Signup ──────────────────────────────────────────────────────────
  SIGNUP_TITLE: 'Crea tu cuenta',
  SIGNUP_SUBTITLE: 'Empieza a gestionar tu práctica médica',
  SIGNUP_FIELD_EMAIL: 'Correo electrónico',
  SIGNUP_FIELD_EMAIL_PLACEHOLDER: 'doctor@ejemplo.com',
  SIGNUP_FIELD_PASSWORD: 'Contraseña',
  SIGNUP_FIELD_PASSWORD_PLACEHOLDER: '••••••••',
  SIGNUP_FIELD_CONFIRM_PASSWORD: 'Confirmar contraseña',
  SIGNUP_FIELD_CONFIRM_PASSWORD_PLACEHOLDER: '••••••••',
  SIGNUP_SUBMIT: 'Crear cuenta',
  SIGNUP_SUBMITTING: 'Creando cuenta...',
  SIGNUP_HAVE_ACCOUNT: '¿Ya tienes cuenta?',
  SIGNUP_LOGIN_LINK: 'Inicia sesión',

  // ── Auth — Login ───────────────────────────────────────────────────────────
  LOGIN_TITLE: 'Bienvenido a Rezeta',
  LOGIN_SUBTITLE: 'Inicia sesión para continuar',
  LOGIN_FIELD_EMAIL: 'Correo electrónico',
  LOGIN_FIELD_EMAIL_PLACEHOLDER: 'doctor@ejemplo.com',
  LOGIN_FIELD_PASSWORD: 'Contraseña',
  LOGIN_FIELD_PASSWORD_PLACEHOLDER: '••••••••',
  LOGIN_SUBMIT: 'Iniciar sesión',
  LOGIN_SUBMITTING: 'Iniciando sesión...',
  LOGIN_NO_ACCOUNT: '¿No tienes cuenta?',
  LOGIN_SIGNUP_LINK: 'Regístrate',

  // ── Auth — Firebase error codes → Spanish messages ─────────────────────────
  FIREBASE_ERROR_EMAIL_ALREADY_IN_USE: 'Ya existe una cuenta con este correo electrónico.',
  FIREBASE_ERROR_INVALID_EMAIL: 'El correo electrónico no es válido.',
  FIREBASE_ERROR_WEAK_PASSWORD: 'La contraseña es demasiado débil. Usa al menos 8 caracteres.',
  FIREBASE_ERROR_USER_NOT_FOUND: 'No existe una cuenta con este correo electrónico.',
  FIREBASE_ERROR_WRONG_PASSWORD: 'Correo o contraseña incorrectos.',
  FIREBASE_ERROR_INVALID_CREDENTIAL: 'Correo o contraseña incorrectos.',
  FIREBASE_ERROR_NETWORK_REQUEST_FAILED: 'Error de conexión. Verifica tu red e intenta de nuevo.',
  FIREBASE_ERROR_TOO_MANY_REQUESTS:
    'Demasiados intentos. Tu cuenta ha sido temporalmente bloqueada. Intenta más tarde.',
  FIREBASE_ERROR_UNKNOWN: 'Ocurrió un error inesperado. Por favor intenta de nuevo.',

  // ── Dashboard ──────────────────────────────────────────────────────────────
  DASHBOARD_GREETING: (fullName: string | null) => {
    const hour = new Date().getHours()
    const salutation =
      hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'
    if (!fullName) return `${salutation}, Dr.`
    // Extract last name (last word), dropping leading "Dr." if present
    const parts = fullName.replace(/^Dr\.\s*/i, '').trim().split(' ')
    const lastName = parts[parts.length - 1] ?? parts[0] ?? fullName
    return `${salutation}, Dr. ${lastName}.`
  },
  DASHBOARD_UNDER_CONSTRUCTION: 'Panel en construcción',
  DASHBOARD_UNDER_CONSTRUCTION_DESCRIPTION:
    'El resumen de actividad del día aparecerá aquí.',

  // ── Auth Gate ──────────────────────────────────────────────────────────────
  AUTH_GATE_LOADING: 'Cargando...',

  // ── Protocols — List ───────────────────────────────────────────────────────
  PROTOCOLS_PAGE_TITLE: 'Protocolos',
  PROTOCOLS_NEW_BUTTON: 'Nuevo protocolo',
  PROTOCOLS_EMPTY_TITLE: 'Sin protocolos todavía',
  PROTOCOLS_EMPTY_DESCRIPTION: 'Crea tu primer protocolo a partir de una plantilla o desde cero.',
  PROTOCOLS_EMPTY_CTA: 'Nuevo protocolo',
  PROTOCOLS_LIST_UPDATED: 'Actualizado',
  PROTOCOLS_LIST_VERSION: (n: number) => `v${n}`,
  PROTOCOLS_LOADING: 'Cargando protocolos...',
  PROTOCOLS_ERROR: 'No se pudo cargar los protocolos.',

  // ── Protocols — Template Picker ────────────────────────────────────────────
  TEMPLATE_PICKER_TITLE: '¿Desde dónde empezamos?',
  TEMPLATE_PICKER_SUBTITLE: 'Elige una plantilla o empieza desde cero.',
  TEMPLATE_PICKER_BLANK_LABEL: 'Desde cero',
  TEMPLATE_PICKER_BLANK_DESC: 'Protocolo en blanco sin estructura predefinida.',
  TEMPLATE_PICKER_SYSTEM_LABEL: 'Plantillas del sistema',
  TEMPLATE_PICKER_CANCEL: 'Cancelar',
  TEMPLATE_PICKER_CREATING: 'Creando...',

  // ── Protocols — Editor ─────────────────────────────────────────────────────
  EDITOR_SAVE_BUTTON: 'Guardar versión',
  EDITOR_UNSAVED: 'Cambios sin guardar',
  EDITOR_SAVING: 'Guardando...',
  EDITOR_PALETTE_TITLE: 'Bloques',
  EDITOR_PALETTE_COMING_SOON: 'Disponible próximamente',
  EDITOR_PREVIEW_TITLE: 'Vista previa',
  EDITOR_SAVE_MODAL_TITLE: 'Guardar versión',
  EDITOR_SAVE_MODAL_SUBTITLE: 'Añade un resumen del cambio (opcional).',
  EDITOR_SAVE_MODAL_LABEL: 'Resumen del cambio',
  EDITOR_SAVE_MODAL_PLACEHOLDER: 'Ej. Actualicé las dosis de primera línea',
  EDITOR_SAVE_MODAL_CONFIRM: 'Guardar versión',
  EDITOR_SAVE_MODAL_CANCEL: 'Cancelar',
  EDITOR_BACK: 'Protocolos',
  EDITOR_VERSION: (n: number) => `v${n}`,
  EDITOR_STATUS_DRAFT: 'Borrador',

  // ── Protocols — Block type labels (shown in type chip) ─────────────────────
  BLOCK_TYPE_SECTION: 'Sección',
  BLOCK_TYPE_TEXT: 'Texto',
  BLOCK_TYPE_CHECKLIST: 'Lista',
  BLOCK_TYPE_STEPS: 'Pasos',
  BLOCK_TYPE_DECISION: 'Decisión',
  BLOCK_TYPE_DOSAGE_TABLE: 'Dosificación',
  BLOCK_TYPE_ALERT: 'Alerta',
  BLOCK_TYPE_UNKNOWN: 'Bloque',

  // ── Protocols — Viewer ─────────────────────────────────────────────────────
  VIEWER_BACK: 'Protocolos',
  VIEWER_EDIT_BUTTON: 'Editar',
  VIEWER_VERSION: (n: number) => `v${n}`,
  VIEWER_UPDATED: 'Actualizado',
  VIEWER_NO_CONTENT: 'Este protocolo no tiene contenido todavía.',
  VIEWER_LOADING: 'Cargando protocolo...',
  VIEWER_NOT_FOUND: 'Protocolo no encontrado.',
} as const

/**
 * Map a Firebase error code to a human-readable Spanish message.
 */
export function firebaseErrorToSpanish(code: string): string {
  const map: Record<string, string> = {
    'auth/email-already-in-use': strings.FIREBASE_ERROR_EMAIL_ALREADY_IN_USE,
    'auth/invalid-email': strings.FIREBASE_ERROR_INVALID_EMAIL,
    'auth/weak-password': strings.FIREBASE_ERROR_WEAK_PASSWORD,
    'auth/user-not-found': strings.FIREBASE_ERROR_USER_NOT_FOUND,
    'auth/wrong-password': strings.FIREBASE_ERROR_WRONG_PASSWORD,
    'auth/invalid-credential': strings.FIREBASE_ERROR_INVALID_CREDENTIAL,
    'auth/network-request-failed': strings.FIREBASE_ERROR_NETWORK_REQUEST_FAILED,
    'auth/too-many-requests': strings.FIREBASE_ERROR_TOO_MANY_REQUESTS,
  }
  return map[code] ?? strings.FIREBASE_ERROR_UNKNOWN
}
