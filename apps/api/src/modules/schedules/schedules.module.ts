import { Module } from '@nestjs/common'
import { SchedulesController } from './schedules.controller.js'
import { SchedulesService } from './schedules.service.js'
import { SchedulesRepository } from './schedules.repository.js'

@Module({
  controllers: [SchedulesController],
  providers: [SchedulesService, SchedulesRepository],
  exports: [SchedulesService],
})
export class SchedulesModule {}
