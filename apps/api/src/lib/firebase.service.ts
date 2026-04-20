import { Injectable, OnModuleInit, Inject, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as admin from 'firebase-admin'
import type { AppConfig } from '../config/configuration.js'

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name)
  private app!: admin.app.App

  constructor(@Inject(ConfigService) private config: ConfigService<AppConfig, true>) {}

  onModuleInit(): void {
    const { projectId, clientEmail, privateKey } = this.config.get('firebase', { infer: true })
    const emulatorHost = process.env['FIREBASE_AUTH_EMULATOR_HOST']

    // Re-use existing app in hot-reload environments (tsx watch)
    if (admin.apps.length > 0) {
      this.app = admin.apps[0] as admin.app.App
      this.logger.log('Re-using existing Firebase Admin app')
      return
    }

    if (emulatorHost) {
      // Emulator mode — no real credentials needed, Admin SDK picks up the env var automatically
      this.logger.warn(`Firebase Auth Emulator detected at ${emulatorHost}`)
      this.app = admin.initializeApp({ projectId: projectId || 'rezeta-dev' })
      return
    }

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn(
        'Firebase service account credentials missing — Auth guard will reject all requests. ' +
          'Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY or ' +
          'FIREBASE_AUTH_EMULATOR_HOST for local development.',
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

  async verifyIdToken(token: string): Promise<admin.auth.DecodedIdToken> {
    if (!this.app) {
      throw new Error('Firebase Admin not initialized')
    }
    return this.app.auth().verifyIdToken(token)
  }
}
