import { Injectable, Logger } from '@nestjs/common'

/**
 * Sends the set-password / first-login email to an invited user.
 *
 * There is no transactional-email provider wired yet, so this logs the link in
 * dev/test. Replace the body with a real send when email infrastructure lands;
 * the call site (UsersService.createUser) does not change.
 */
@Injectable()
export class InvitationMailerService {
  private readonly logger = new Logger(InvitationMailerService.name)

  async sendSetPasswordEmail(email: string, link: string): Promise<void> {
    this.logger.log(`Set-password email for ${email}: ${link}`)
    return Promise.resolve()
  }
}
