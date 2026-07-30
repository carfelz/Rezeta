/** Firebase implementation of IAuthClient. The only file in apps/web allowed to import 'firebase/auth' or 'firebase/app'. To migrate, replace with another IAuthClient implementation. */
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  verifyPasswordResetCode,
  confirmPasswordReset,
  multiFactor,
  getMultiFactorResolver,
  TotpMultiFactorGenerator,
  type Auth,
  type MultiFactorError,
  type MultiFactorResolver,
} from 'firebase/auth'
import { firebaseErrorToSpanish } from '../toasts'
import type { AuthSession, IAuthClient, TotpEnrollment } from './auth-client.interface'

const TOTP_ISSUER = 'Rezeta'
const TOTP_ENROLLMENT_DISPLAY_NAME = 'Authenticator app'

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
  /** Set by `signIn` when Firebase rejects with `auth/multi-factor-auth-required`; consumed (and cleared) by `completeTotpSignIn`. */
  private pendingMfaResolver: MultiFactorResolver | null = null

  onAuthStateChanged(cb: (session: AuthSession | null) => void): () => void {
    return onAuthStateChanged(this.auth, (user) => cb(user))
  }

  async getToken(): Promise<string | null> {
    const user = this.auth.currentUser
    return user ? user.getIdToken() : null
  }

  async signIn(email: string, password: string): Promise<void> {
    try {
      await signInWithEmailAndPassword(this.auth, email, password)
    } catch (err) {
      if ((err as { code?: string }).code === 'auth/multi-factor-auth-required') {
        this.pendingMfaResolver = getMultiFactorResolver(this.auth, err as MultiFactorError)
      }
      throw err
    }
  }

  async completeTotpSignIn(code: string): Promise<void> {
    const resolver = this.pendingMfaResolver
    if (!resolver) {
      throw new Error('No pending multi-factor sign-in')
    }
    const hint = resolver.hints.find((h) => h.factorId === TotpMultiFactorGenerator.FACTOR_ID)
    if (!hint) {
      throw new Error('No TOTP factor available for this account')
    }
    const assertion = TotpMultiFactorGenerator.assertionForSignIn(hint.uid, code)
    await resolver.resolveSignIn(assertion)
    this.pendingMfaResolver = null
  }

  async enrollTotp(): Promise<TotpEnrollment> {
    const user = this.auth.currentUser
    if (!user) throw new Error('No signed-in user')
    const session = await multiFactor(user).getSession()
    const secret = await TotpMultiFactorGenerator.generateSecret(session)
    return {
      secret: secret.secretKey,
      otpauthUrl: secret.generateQrCodeUrl(user.email ?? '', TOTP_ISSUER),
      verify: async (code: string) => {
        const assertion = TotpMultiFactorGenerator.assertionForEnrollment(secret, code)
        await multiFactor(user).enroll(assertion, TOTP_ENROLLMENT_DISPLAY_NAME)
      },
    }
  }

  async unenrollTotp(): Promise<void> {
    const user = this.auth.currentUser
    if (!user) throw new Error('No signed-in user')
    const factors = multiFactor(user)
    const totpFactor = factors.enrolledFactors.find((f) => f.factorId === TotpMultiFactorGenerator.FACTOR_ID)
    if (!totpFactor) return
    await factors.unenroll(totpFactor)
  }

  async signOut(): Promise<void> {
    try {
      await signOut(this.auth)
    } catch {
      // Swallow — caller already invariant-broken; best-effort cleanup.
    }
  }

  async verifyPasswordResetCode(oobCode: string): Promise<string> {
    return verifyPasswordResetCode(this.auth, oobCode)
  }

  async confirmPasswordReset(oobCode: string, newPassword: string): Promise<void> {
    await confirmPasswordReset(this.auth, oobCode, newPassword)
  }

  errorCodeToMessage(code: string): string {
    return firebaseErrorToSpanish(code)
  }
}
