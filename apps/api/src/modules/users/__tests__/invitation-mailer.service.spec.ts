import { describe, it, expect, vi } from 'vitest'
import { Logger } from '@nestjs/common'
import { InvitationMailerService } from '../invitation-mailer.service.js'

describe('InvitationMailerService', () => {
  it('logs the set-password link (dev path)', async () => {
    const spy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)
    const mailer = new InvitationMailerService()
    await mailer.sendSetPasswordEmail('nurse@clinic.do', 'https://reset.example/abc')
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('nurse@clinic.do'))
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('https://reset.example/abc'))
    spy.mockRestore()
  })
})
