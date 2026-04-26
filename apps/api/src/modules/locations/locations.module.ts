import { Module } from '@nestjs/common'
import { LocationsController } from './locations.controller.js'
import { LocationsService } from './locations.service.js'
import { LocationsRepository } from './locations.repository.js'

@Module({
  controllers: [LocationsController],
  providers: [LocationsService, LocationsRepository],
  exports: [LocationsService],
})
export class LocationsModule {}
