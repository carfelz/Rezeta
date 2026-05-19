import { Module } from '@nestjs/common'
import { ProtocolImprovementsController } from './protocol-improvements.controller.js'
import { ProtocolImprovementsService } from './protocol-improvements.service.js'
import { ProtocolImprovementsRepository } from './protocol-improvements.repository.js'
import { PatternDetectionService } from './pattern-detection.service.js'
import { PatternDetectionScheduler } from './pattern-detection.scheduler.js'
import { WeeklySummaryService } from './weekly-summary.service.js'
import { WeeklySummaryScheduler } from './weekly-summary.scheduler.js'

@Module({
  controllers: [ProtocolImprovementsController],
  providers: [
    ProtocolImprovementsService,
    ProtocolImprovementsRepository,
    PatternDetectionService,
    PatternDetectionScheduler,
    WeeklySummaryService,
    WeeklySummaryScheduler,
  ],
  exports: [ProtocolImprovementsService, PatternDetectionService],
})
export class ProtocolImprovementsModule {}
