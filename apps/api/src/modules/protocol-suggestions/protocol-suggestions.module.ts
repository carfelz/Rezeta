import { Module } from '@nestjs/common'
import { ProtocolSuggestionsController } from './protocol-suggestions.controller.js'
import { ProtocolSuggestionsService } from './protocol-suggestions.service.js'
import { ProtocolSuggestionsRepository } from './protocol-suggestions.repository.js'
import { PatternDetectionService } from './pattern-detection.service.js'
import { PatternDetectionScheduler } from './pattern-detection.scheduler.js'

@Module({
  controllers: [ProtocolSuggestionsController],
  providers: [
    ProtocolSuggestionsService,
    ProtocolSuggestionsRepository,
    PatternDetectionService,
    PatternDetectionScheduler,
  ],
  exports: [ProtocolSuggestionsService, PatternDetectionService],
})
export class ProtocolSuggestionsModule {}
