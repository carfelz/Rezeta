import { Global, Module, Controller, Get } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core'
import { resolve } from 'path'
import { configuration } from './config/configuration.js'
import { PrismaService } from './lib/prisma.service.js'
import { FirebaseService } from './lib/firebase.service.js'
import { FirebaseAuthGuard } from './common/guards/firebase-auth.guard.js'
import { TenantGuard } from './common/guards/tenant.guard.js'
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor.js'
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor.js'
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js'
import { PatientsModule } from './modules/patients/index.js'
import { LocationsModule } from './modules/locations/index.js'
import { ProtocolTemplatesModule } from './modules/protocol-templates/index.js'
import { ProtocolsModule } from './modules/protocols/index.js'
import { AuthModule } from './modules/auth/index.js'
import { UsersModule } from './modules/users/index.js'
import { TenantSeedingModule } from './modules/tenant-seeding/index.js'
import { ProtocolTypesModule } from './modules/protocol-types/index.js'
import { OnboardingModule } from './modules/onboarding/index.js'
import { AppointmentsModule } from './modules/appointments/index.js'
import { ConsultationsModule } from './modules/consultations/index.js'
import { OrdersModule } from './modules/orders/index.js'
import { ProtocolSuggestionsModule } from './modules/protocol-suggestions/index.js'
import { Public } from './common/decorators/public.decorator.js'

@Controller()
class AppController {
  @Public()
  @Get('health')
  health(): { status: string; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() }
  }
}

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      // Path relative to compiled runtime directory (dist/apps/api/src → monorepo root)
      envFilePath: resolve(__dirname, '../../..', '.env'),
    }),
    AuthModule,
    UsersModule,
    PatientsModule,
    LocationsModule,
    ProtocolTemplatesModule,
    ProtocolTypesModule,
    ProtocolsModule,
    TenantSeedingModule,
    OnboardingModule,
    AppointmentsModule,
    ConsultationsModule,
    OrdersModule,
    ProtocolSuggestionsModule,
  ],
  controllers: [AppController],
  providers: [
    PrismaService,
    FirebaseService,
    // Global guards — order matters: FirebaseAuthGuard runs first, then TenantGuard
    { provide: APP_GUARD, useClass: FirebaseAuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    // Global interceptors
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor },
    // Global exception filter
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
  exports: [PrismaService, FirebaseService],
})
export class AppModule {}
