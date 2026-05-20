/** Firebase implementation of IAuthClient. The only file in apps/web allowed to import 'firebase/auth' or 'firebase/app'. To migrate, replace with another IAuthClient implementation. */
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  type Auth,
} from 'firebase/auth'
import { firebaseErrorToSpanish } from '../toasts'
import type { AuthSession, IAuthClient } from './auth-client.interface'

function initApp(): FirebaseApp {
  if (getApps().length > 0) return getApps()[0]!
  return initializeApp({
    apiKey: import.meta.env['VITE_FIREBASE_API_KEY'] as string,
    authDomain: import.meta.env['VITE_FIREBASE_AUTH_DOMAIN'] as string,
    projectId: import.meta.env['VITE_FIREBASE_PROJECT_ID'] as string,
    appId: import.meta.env['VITE_FIREBASE_APP_ID'] as string,
    messagingSenderId: import.meta.env['VITE_FIREBASE_MESSAGING_SENDER_ID'] as string,
  })
}

export class FirebaseAuthClient implements IAuthClient {
  private auth: Auth = getAuth(initApp())

  onAuthStateChanged(cb: (session: AuthSession | null) => void): () => void {
    return onAuthStateChanged(this.auth, (user) => cb(user))
  }

  async getToken(): Promise<string | null> {
    const user = this.auth.currentUser
    return user ? user.getIdToken() : null
  }

  async signIn(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(this.auth, email, password)
  }

  async signUp(email: string, password: string): Promise<void> {
    await createUserWithEmailAndPassword(this.auth, email, password)
  }

  async signOut(): Promise<void> {
    try {
      await signOut(this.auth)
    } catch {
      // Swallow — caller already invariant-broken; best-effort cleanup.
    }
  }

  errorCodeToMessage(code: string): string {
    return firebaseErrorToSpanish(code)
  }
}
