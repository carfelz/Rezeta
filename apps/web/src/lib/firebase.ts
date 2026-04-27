import { initializeApp, getApps } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'

const apiKey = import.meta.env['VITE_FIREBASE_API_KEY'] as string | undefined
const emulatorHost = import.meta.env['VITE_FIREBASE_AUTH_EMULATOR_HOST'] as string | undefined

// Initialize or reuse the Firebase app
const app = apiKey
  ? getApps().length === 0
    ? initializeApp({
        apiKey,
        authDomain: import.meta.env['VITE_FIREBASE_AUTH_DOMAIN'] as string,
        projectId: import.meta.env['VITE_FIREBASE_PROJECT_ID'] as string,
        ...(import.meta.env['VITE_FIREBASE_APP_ID']
          ? { appId: import.meta.env['VITE_FIREBASE_APP_ID'] as string }
          : {}),
        ...(import.meta.env['VITE_FIREBASE_MESSAGING_SENDER_ID']
          ? { messagingSenderId: import.meta.env['VITE_FIREBASE_MESSAGING_SENDER_ID'] as string }
          : {}),
      })
    : getApps()[0]!
  : emulatorHost
    ? // Emulator-only mode: no real API key needed
      getApps().length === 0
      ? initializeApp({
          apiKey: 'emulator-fake-key',
          projectId: (import.meta.env['VITE_FIREBASE_PROJECT_ID'] as string) ?? 'rezeta-dev',
        })
      : getApps()[0]!
    : null

export const auth = app ? getAuth(app) : null

// Connect to emulator when configured (run after getAuth so the instance exists)
if (auth && emulatorHost) {
  connectAuthEmulator(auth, `http://${emulatorHost}`, { disableWarnings: true })
}
