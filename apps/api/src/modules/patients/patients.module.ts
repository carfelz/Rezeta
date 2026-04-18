import { Module } from '@nestjs/common'
import { PatientsController } from './patients.controller.js'
import { PatientsService } from './patients.service.js'
import { PatientsRepository } from './patients.repository.js'

@Module({
  controllers: [PatientsController],
  providers: [PatientsService, PatientsRepository],
})
export class PatientsModule {}
