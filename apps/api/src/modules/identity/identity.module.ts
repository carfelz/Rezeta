import { Module } from '@nestjs/common'
import { UsersModule } from '../users/index.js'
import { IdentityRepository } from './identity.repository.js'
import { LoginTelemetryService } from './login-telemetry.service.js'
import { IdentityService } from './identity.service.js'
import { IdentityController } from './identity.controller.js'
import { StaffSecurityService } from './staff-security.service.js'
import { StaffSecurityController } from './staff-security.controller.js'
import { SsoConnectionRepository } from './sso-connection.repository.js'
import { SsoConnectionService } from './sso-connection.service.js'
import { StaffSsoConnectionsController } from './staff-sso.controller.js'
import { LoginRoutingService } from './login-routing.service.js'
import { LoginRoutingController } from './login-routing.controller.js'

@Module({
  imports: [UsersModule],
  controllers: [
    IdentityController,
    StaffSecurityController,
    StaffSsoConnectionsController,
    LoginRoutingController,
  ],
  providers: [
    IdentityRepository,
    LoginTelemetryService,
    IdentityService,
    StaffSecurityService,
    SsoConnectionRepository,
    SsoConnectionService,
    LoginRoutingService,
  ],
  exports: [LoginTelemetryService, IdentityRepository, SsoConnectionService],
})
export class IdentityModule {}
