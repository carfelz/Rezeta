import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'

const apiKey = import.meta.env['VITE_FIREBASE_API_KEY'] as string | undefined

// When VITE_STUB_AUTH=true (local dev without Firebase), skip initialization.
// auth will be a no-op placeholder — AuthProvider won't call it in stub mode.
const app =
  apiKey
    ? getApps().length === 0
      ? initializeApp({
          apiKey,
          authDomain: import.meta.env['VITE_FIREBASE_AUTH_DOMAIN'] as string,
          projectId: import.meta.env['VITE_FIREBASE_PROJECT_ID'] as string,
        })
      : getApps()[0]!
    : null

export const auth = app ? getAuth(app) : null
