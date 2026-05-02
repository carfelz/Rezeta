import { Module } from '@nestjs/common'
import { ConsultationsController } from './consultations.controller.js'
import { ConsultationsService } from './consultations.service.js'
import { ConsultationsRepository } from './consultations.repository.js'
import { InvoicesModule } from '../invoices/index.js'

@Module({
  imports: [InvoicesModule],
  controllers: [ConsultationsController],
  providers: [ConsultationsService, ConsultationsRepository],
  exports: [ConsultationsService],
})
export class ConsultationsModule {}
