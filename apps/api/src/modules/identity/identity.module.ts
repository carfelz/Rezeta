import { Module } from '@nestjs/common'
import { IdentityRepository } from './identity.repository.js'
import { LoginTelemetryService } from './login-telemetry.service.js'
import { IdentityService } from './identity.service.js'
import { IdentityController } from './identity.controller.js'
import { StaffSecurityService } from './staff-security.service.js'
import { StaffSecurityController } from './staff-security.controller.js'

@Module({
  controllers: [IdentityController, StaffSecurityController],
  providers: [IdentityRepository, LoginTelemetryService, IdentityService, StaffSecurityService],
  exports: [LoginTelemetryService, IdentityRepository],
})
export class IdentityModule {}
