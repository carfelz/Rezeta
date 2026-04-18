import { Injectable, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as admin from 'firebase-admin'
import type { AppConfig } from '../config/configuration.js'

@Injectable()
export class FirebaseService implements OnModuleInit {
  private app!: admin.app.App

  constructor(private config: ConfigService<AppConfig, true>) {}

  onModuleInit() {
    const { projectId, clientEmail, privateKey } = this.config.get('firebase', { infer: true })

    // Re-use existing app in hot-reload environments
    this.app =
      admin.apps.length > 0
        ? (admin.apps[0] as admin.app.App)
        : admin.initializeApp({
            credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
          })
  }

  async verifyIdToken(token: string): Promise<admin.auth.DecodedIdToken> {
    return this.app.auth().verifyIdToken(token)
  }
}
