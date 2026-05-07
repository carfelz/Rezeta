/** Firebase implementation of IAuthProvider. All firebase-admin imports are confined to this file. To migrate, replace this class with a new IAuthProvider implementation and update AUTH_PROVIDER in auth.module.ts. **/
import {
  Injectable,
  OnModuleInit,
  Inject,
  Logger,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as admin from 'firebase-admin'
import { ErrorCode } from '@rezeta/shared'
import type { AppConfig } from '../../config/configuration.js'
import type { IAuthProvider, VerifiedToken, SignedInToken } from './auth-provider.interface.js'

@Injectable()
export class FirebaseAuthProvider implements IAuthProvider, OnModuleInit {
  private readonly logger = new Logger(FirebaseAuthProvider.name)
  private app: admin.app.App | null = null

  constructor(@Inject(ConfigService) private config: ConfigService<AppConfig, true>) {}

  onModuleInit(): void {
    if (admin.apps.length > 0) {
      this.app = admin.apps[0] as admin.app.App
      return
    }

    let { projectId, clientEmail, privateKey } = this.config.get('firebase', { infer: true })

    if ((!projectId || !clientEmail || !privateKey) && process.env['FIREBASE_ADMIN_KEY']) {
      try {
        const parsed = JSON.parse(process.env['FIREBASE_ADMIN_KEY']) as {
          project_id?: string
          client_email?: string
          private_key?: string
        }
        projectId = projectId || parsed.project_id || ''
        clientEmail = clientEmail || parsed.client_email || ''
        privateKey = privateKey || parsed.private_key || ''
      } catch {
        this.logger.error('Failed to parse FIREBASE_ADMIN_KEY — must be valid JSON')
      }
    }

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn(
        'Firebase service account credentials missing — Auth guard will reject all requests. ' +
          'Set FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY, ' +
          'or FIREBASE_ADMIN_KEY (JSON blob for Cloud Run).',
      )
      return
    }

    this.app = admin.initializeApp({
      projectId,
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    })

    this.logger.log(`Firebase Admin initialized for project: ${projectId}`)
  }

  async verifyToken(token: string): Promise<VerifiedToken> {
    if (!this.app) {
      throw new InternalServerErrorException({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Auth provider not initialized',
      })
    }

    let decoded: admin.auth.DecodedIdToken
    try {
      decoded = await this.app.auth().verifyIdToken(token)
    } catch (err) {
      this.logger.debug(`Token verification failed: ${(err as Error).message}`)
      throw new UnauthorizedException({
        code: ErrorCode.TOKEN_INVALID,
        message: 'ID token is invalid or expired',
      })
    }

    return {
      externalUid: decoded.uid,
      email: decoded.email ?? '',
      rawClaims: decoded as unknown as Record<string, unknown>,
    }
  }

  async signInWithPassword(email: string, password: string): Promise<SignedInToken> {
    const webApiKey = this.config.get('firebase', { infer: true }).webApiKey
    if (!webApiKey) {
      throw new InternalServerErrorException({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Auth provider missing web API key',
      })
    }

    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(webApiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      },
    )

    if (!res.ok) {
      const body = (await res.json()) as { error?: { message?: string } }
      throw new UnauthorizedException(body.error?.message ?? 'Invalid credentials')
    }

    const data = (await res.json()) as { idToken: string; expiresIn: string }
    return { accessToken: data.idToken, expiresIn: parseInt(data.expiresIn, 10) }
  }

  async revokeUserSessions(externalUid: string): Promise<void> {
    if (!this.app) {
      throw new InternalServerErrorException({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Auth provider not initialized',
      })
    }
    try {
      await this.app.auth().revokeRefreshTokens(externalUid)
    } catch (err) {
      this.logger.error(`Failed to revoke sessions for ${externalUid}: ${(err as Error).message}`)
      throw new InternalServerErrorException({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Failed to revoke sessions',
      })
    }
  }

  async deleteUser(externalUid: string): Promise<void> {
    if (!this.app) {
      throw new InternalServerErrorException({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Auth provider not initialized',
      })
    }
    try {
      await this.app.auth().deleteUser(externalUid)
    } catch (err) {
      this.logger.error(`Failed to delete user ${externalUid}: ${(err as Error).message}`)
      throw new InternalServerErrorException({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Failed to delete user from auth provider',
      })
    }
  }
}
