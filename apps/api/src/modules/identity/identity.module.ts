import { Module } from '@nestjs/common'
import { IdentityRepository } from './identity.repository.js'
import { LoginTelemetryService } from './login-telemetry.service.js'
import { IdentityService } from './identity.service.js'
import { IdentityController } from './identity.controller.js'

@Module({
  controllers: [IdentityController],
  providers: [IdentityRepository, LoginTelemetryService, IdentityService],
  exports: [LoginTelemetryService, IdentityRepository],
})
export class IdentityModule {}
