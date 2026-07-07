import { Module } from '@nestjs/common'
import { PatientsController } from './patients.controller.js'
import { PatientsService } from './patients.service.js'
import { PatientsRepository } from './patients.repository.js'
import { ConsultationRecordsModule } from '../consultation-records/consultation-records.module.js'

@Module({
  imports: [ConsultationRecordsModule],
  controllers: [PatientsController],
  providers: [PatientsService, PatientsRepository],
})
export class PatientsModule {}
