import { Module } from '@nestjs/common'
import { AppointmentsController } from './appointments.controller.js'
import { AppointmentsService } from './appointments.service.js'
import { AppointmentsRepository } from './appointments.repository.js'

@Module({
  controllers: [AppointmentsController],
  providers: [AppointmentsService, AppointmentsRepository],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
