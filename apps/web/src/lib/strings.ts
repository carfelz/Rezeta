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
