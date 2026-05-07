import { Global, Module } from '@nestjs/common'
import { FirebaseAuthProvider } from './firebase-auth.provider.js'

export const AUTH_PROVIDER = 'AUTH_PROVIDER'

@Global()
@Module({
  providers: [
    // The only line that needs to change on migration day:
    { provide: AUTH_PROVIDER, useClass: FirebaseAuthProvider },
  ],
  exports: [AUTH_PROVIDER],
})
export class AuthModule {}
