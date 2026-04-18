import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core'
import { configuration } from './config/configuration.js'
import { PrismaService } from './lib/prisma.service.js'
import { FirebaseService } from './lib/firebase.service.js'
import { FirebaseAuthGuard } from './common/guards/firebase-auth.guard.js'
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor.js'
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor.js'
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js'
import { PatientsModule } from './modules/patients/index.js'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    PatientsModule,
  ],
  providers: [
    PrismaService,
    FirebaseService,
    // Global guard — every route requires a valid Firebase token
    { provide: APP_GUARD, useClass: FirebaseAuthGuard },
    // Global interceptors
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor },
    // Global exception filter
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
  exports: [PrismaService, FirebaseService],
})
export class AppModule {}
