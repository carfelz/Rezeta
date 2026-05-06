import { Module } from '@nestjs/common'
import { ProtocolRecommendationsController } from './protocol-recommendations.controller.js'
import { ProtocolRecommendationsService } from './protocol-recommendations.service.js'
import { ProtocolRecommendationsRepository } from './protocol-recommendations.repository.js'

@Module({
  controllers: [ProtocolRecommendationsController],
  providers: [ProtocolRecommendationsService, ProtocolRecommendationsRepository],
  exports: [ProtocolRecommendationsService],
})
export class ProtocolRecommendationsModule {}
