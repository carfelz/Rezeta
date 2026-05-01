import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'

const app =
  getApps().length === 0
    ? initializeApp({
        apiKey: import.meta.env['VITE_FIREBASE_API_KEY'] as string,
        authDomain: import.meta.env['VITE_FIREBASE_AUTH_DOMAIN'] as string,
        projectId: import.meta.env['VITE_FIREBASE_PROJECT_ID'] as string,
        appId: import.meta.env['VITE_FIREBASE_APP_ID'] as string,
        messagingSenderId: import.meta.env['VITE_FIREBASE_MESSAGING_SENDER_ID'] as string,
      })
    : getApps()[0]!

export const auth = getAuth(app)
