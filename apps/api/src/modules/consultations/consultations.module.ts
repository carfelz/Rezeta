import { Module } from '@nestjs/common'
import { ConsultationsController } from './consultations.controller.js'
import { ConsultationsService } from './consultations.service.js'
import { ConsultationsRepository } from './consultations.repository.js'

@Module({
  controllers: [ConsultationsController],
  providers: [ConsultationsService, ConsultationsRepository],
  exports: [ConsultationsService],
})
export class ConsultationsModule {}
