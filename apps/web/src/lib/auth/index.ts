import { FirebaseAuthClient } from './firebase-auth-client'
import type { IAuthClient } from './auth-client.interface'

export type { AuthSession, IAuthClient } from './auth-client.interface'

/** Singleton — swap this line on migration day. */
export const authClient: IAuthClient = new FirebaseAuthClient()
