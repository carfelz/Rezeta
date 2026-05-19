import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PatternDetectionService } from './pattern-detection.service.js'

@Injectable()
export class PatternDetectionScheduler {
  private readonly logger = new Logger(PatternDetectionScheduler.name)

  constructor(private readonly patternDetection: PatternDetectionService) {}

  // Weekly pattern detection — Sunday at 3:00 AM
  @Cron('0 3 * * 0')
  async handleWeeklyDetection(): Promise<void> {
    this.logger.log('Cron triggered: weekly pattern detection')
    await this.patternDetection.runWeeklyDetection()
  }
}
