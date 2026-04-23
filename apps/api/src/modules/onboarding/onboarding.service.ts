import { Injectable, Inject, InternalServerErrorException, BadRequestException } from '@nestjs/common'
import type { AuthUser, OnboardingCustomInput } from '@rezeta/shared'
import { TenantSeedingService } from '../tenant-seeding/tenant-seeding.service.js'
import { AuthService } from '../auth/auth.service.js'
import { AuthRepository } from '../auth/auth.repository.js'
import { getStarterFixtures } from '../../lib/starter-fixtures/index.js'

export interface StarterCandidate {
  clientId: string
  name: string
  typeName: string
  schema: object
}

@Injectable()
export class OnboardingService {
  constructor(
    @Inject(TenantSeedingService) private seeder: TenantSeedingService,
    @Inject(AuthService) private authService: AuthService,
    @Inject(AuthRepository) private authRepository: AuthRepository,
  ) {}

  getStarters(locale: 'es' | 'en' = 'es'): StarterCandidate[] {
    return getStarterFixtures(locale).map((f, i) => ({
      clientId: `starter-${i}`,
      name: f.name,
      typeName: f.typeName,
      schema: f.schema,
    }))
  }

  async seedDefault(userId: string, firebaseUid: string, locale: 'es' | 'en' = 'es'): Promise<AuthUser> {
    // Resolve tenantId from the authenticated user's tenant
    const user = await this.authRepository.findByFirebaseUid(firebaseUid)
    if (!user) throw new InternalServerErrorException('User not found after auth')
    await this.seeder.seedDefault(user.tenantId, locale)
    const refreshed = await this.authRepository.findByFirebaseUid(firebaseUid)
    if (!refreshed) throw new InternalServerErrorException('User not found after seeding')
    return this.authService.toAuthUser(refreshed)
  }

  async seedCustom(firebaseUid: string, input: OnboardingCustomInput): Promise<AuthUser> {
    // Validate cross-references before hitting the DB
    const templateClientIds = new Set(input.templates.map((t) => t.clientId))
    for (const type of input.types) {
      if (!templateClientIds.has(type.templateClientId)) {
        throw new BadRequestException({
          code: 'UNKNOWN_TEMPLATE_CLIENT_ID',
          message: `Type "${type.name}" references unknown templateClientId "${type.templateClientId}"`,
        })
      }
    }

    const user = await this.authRepository.findByFirebaseUid(firebaseUid)
    if (!user) throw new InternalServerErrorException('User not found after auth')
    await this.seeder.seedCustom(
      user.tenantId,
      input.templates.map((t) => ({
        clientId: t.clientId,
        name: t.name,
        ...(t.suggestedSpecialty !== undefined ? { suggestedSpecialty: t.suggestedSpecialty } : {}),
        schema: t.schema,
      })),
      input.types,
    )
    const refreshed = await this.authRepository.findByFirebaseUid(firebaseUid)
    if (!refreshed) throw new InternalServerErrorException('User not found after seeding')
    return this.authService.toAuthUser(refreshed)
  }
}
