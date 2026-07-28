import { Module } from '@nestjs/common'
import { IdentityRepository } from './identity.repository.js'
import { LoginTelemetryService } from './login-telemetry.service.js'

@Module({
  providers: [IdentityRepository, LoginTelemetryService],
  exports: [LoginTelemetryService, IdentityRepository],
})
export class IdentityModule {}
