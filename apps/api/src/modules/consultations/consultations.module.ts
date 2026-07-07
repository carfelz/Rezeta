import { Module } from '@nestjs/common'
import {
  ConsultationsController,
  PatientConsultationsController,
} from './consultations.controller.js'
import { ConsultationsService } from './consultations.service.js'
import { ConsultationsRepository } from './consultations.repository.js'
import { InvoicesModule } from '../invoices/index.js'
import { ProtocolRecommendationsModule } from '../protocol-recommendations/index.js'
import { ConsultationRecordsModule } from '../consultation-records/index.js'

@Module({
  imports: [InvoicesModule, ProtocolRecommendationsModule, ConsultationRecordsModule],
  controllers: [ConsultationsController, PatientConsultationsController],
  providers: [ConsultationsService, ConsultationsRepository],
  exports: [ConsultationsService],
})
export class ConsultationsModule {}
