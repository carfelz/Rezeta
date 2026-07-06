import { Module } from '@nestjs/common'
import { ConsultationRecordsController } from './consultation-records.controller.js'
import { ConsultationRecordsService } from './consultation-records.service.js'
import { ConsultationRecordsRepository } from './consultation-records.repository.js'

@Module({
  controllers: [ConsultationRecordsController],
  providers: [ConsultationRecordsService, ConsultationRecordsRepository],
  exports: [ConsultationRecordsService],
})
export class ConsultationRecordsModule {}
