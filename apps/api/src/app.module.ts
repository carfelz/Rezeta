import { Global, Module, Controller, Get } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core'
import { resolve } from 'path'
import { configuration } from './config/configuration.js'
import { PrismaService } from './lib/prisma.service.js'
import { AuthModule } from './lib/auth/index.js'
import { PdfService } from './lib/pdf.service.js'
import { ReferenceGuardService } from './common/references/reference-guard.service.js'
import { AuthGuard } from './common/guards/auth.guard.js'
import { TenantGuard } from './common/guards/tenant.guard.js'
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor.js'
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor.js'
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js'
import { PatientsModule } from './modules/patients/index.js'
import { LocationsModule } from './modules/locations/index.js'
import { ProtocolTemplatesModule } from './modules/protocol-templates/index.js'
import { ProtocolsModule } from './modules/protocols/index.js'
import { AuthFeatureModule } from './modules/auth/index.js'
import { UsersModule } from './modules/users/index.js'
import { TenantSeedingModule } from './modules/tenant-seeding/index.js'
import { ProtocolCategoriesModule } from './modules/protocol-categories/index.js'
import { OnboardingModule } from './modules/onboarding/index.js'
import { AppointmentsModule } from './modules/appointments/index.js'
import { ConsultationsModule } from './modules/consultations/index.js'
import { ConsultationRecordsModule } from './modules/consultation-records/index.js'
import { OrdersModule } from './modules/orders/index.js'
import { ProtocolImprovementsModule } from './modules/protocol-improvements/index.js'
import { ProtocolRecommendationsModule } from './modules/protocol-recommendations/index.js'
import { InvoicesModule } from './modules/invoices/index.js'
import { SchedulesModule } from './modules/schedules/index.js'
import { LogsModule } from './modules/logs/index.js'
import { AuditLogModule } from './common/audit-log/audit-log.module.js'
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
    ScheduleModule.forRoot(),
    AuditLogModule,
    AuthModule,
    AuthFeatureModule,
    UsersModule,
    PatientsModule,
    LocationsModule,
    ProtocolTemplatesModule,
    ProtocolCategoriesModule,
    ProtocolsModule,
    TenantSeedingModule,
    OnboardingModule,
    AppointmentsModule,
    ConsultationsModule,
    ConsultationRecordsModule,
    OrdersModule,
    ProtocolImprovementsModule,
    ProtocolRecommendationsModule,
    InvoicesModule,
    SchedulesModule,
    LogsModule,
  ],
  controllers: [AppController],
  providers: [
    PrismaService,
    // Global guards — order matters: AuthGuard runs first, then TenantGuard
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    // Global interceptors
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor },
    // Global exception filter
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    // Shared services
    PdfService,
    ReferenceGuardService,
  ],
  exports: [PrismaService, PdfService, ReferenceGuardService],
})
export class AppModule {}
