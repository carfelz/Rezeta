import { describe, it, expect, vi, afterEach } from 'vitest'
import { loginStrings } from '@/pages/Login/strings'
import { signupStrings } from '@/pages/Signup/strings'
import { protocolsStrings } from '@/pages/Protocols/strings'
import { onboardingStrings } from '@/pages/Onboarding/strings'
import { dashboardStrings } from '@/pages/Dashboard/strings'
import { protocolEditorStrings } from '@/pages/ProtocolEditor/strings'
import { templatesStrings, templateEditorStrings, typesStrings } from '@/pages/settings/strings'
import { protocolViewerStrings } from '@/pages/ProtocolViewer/strings'
import { blockEditorStrings } from '@/components/protocols/strings'
import { firebaseErrorToSpanish, firebaseErrorStrings } from '@/lib/toasts'
import { protocolStatusLabel, PROTOCOL_STATUS_LABELS } from '@/lib/protocol-status'

describe('loginStrings', () => {
  it('exports appName', () => {
    expect(loginStrings.appName).toBe('Rezeta')
  })
})

describe('signupStrings', () => {
  it('exports title', () => {
    expect(signupStrings.title).toBeDefined()
    expect(typeof signupStrings.title).toBe('string')
  })

  it('exports submit', () => {
    expect(signupStrings.submit).toBeDefined()
  })
})

describe('loginStrings', () => {
  it('exports title', () => {
    expect(loginStrings.title).toBeDefined()
  })

  it('exports submit', () => {
    expect(loginStrings.submit).toBeDefined()
  })
})

describe('protocolsStrings', () => {
  it('exports emptyTitle', () => {
    expect(protocolsStrings.emptyTitle).toBe('Sin protocolos todavía')
  })

  it('listVersion returns version string', () => {
    expect(protocolsStrings.listVersion(3)).toBe('v3')
  })
})

describe('onboardingStrings', () => {
  it('welcomeHeading handles null name', () => {
    const heading = onboardingStrings.welcomeHeading(null)
    expect(typeof heading).toBe('string')
    expect(heading.length).toBeGreaterThan(0)
  })

  it('welcomeHeading includes name when provided', () => {
    const heading = onboardingStrings.welcomeHeading('Dr. García')
    expect(heading).toContain('Dr. García')
  })
})

describe('dashboardStrings', () => {
  it('greeting returns a string for null name', () => {
    const result = dashboardStrings.greeting(null)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('greeting includes extracted last name', () => {
    const result = dashboardStrings.greeting('Dr. Carlos Feliz')
    expect(result).toContain('Feliz')
  })

  it('greeting works without Dr. prefix', () => {
    const result = dashboardStrings.greeting('Ana López')
    expect(result).toContain('López')
  })

  describe('greeting time-of-day branches', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it('uses Buenos días when hour < 12', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-05-07T08:00:00'))
      expect(dashboardStrings.greeting('Carlos')).toContain('Buenos días')
    })

    it('uses Buenas tardes when 12 <= hour < 19', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-05-07T15:00:00'))
      expect(dashboardStrings.greeting('Carlos')).toContain('Buenas tardes')
    })

    it('uses Buenas noches when hour >= 19', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-05-07T22:00:00'))
      expect(dashboardStrings.greeting('Carlos')).toContain('Buenas noches')
    })
  })
})

describe('protocolEditorStrings', () => {
  it('publish returns label without version number', () => {
    expect(protocolEditorStrings.publish(1)).toBe('Publicar')
    expect(protocolEditorStrings.publish(2)).toBe('Publicar')
  })

  it('version returns version label', () => {
    expect(protocolEditorStrings.version(1)).toBe('v1')
  })
})

describe('blockEditorStrings', () => {
  it('sectionDeleteConfirm with children', () => {
    const msg = blockEditorStrings.sectionDeleteConfirm(3)
    expect(msg).toContain('3')
    expect(msg).toContain('bloques')
  })

  it('sectionDeleteConfirm with 1 child (singular)', () => {
    const msg = blockEditorStrings.sectionDeleteConfirm(1)
    expect(msg).toContain('1')
    expect(msg).toContain('bloque')
    expect(msg).not.toContain('bloques')
  })

  it('sectionDeleteConfirm with no children', () => {
    const msg = blockEditorStrings.sectionDeleteConfirm(0)
    expect(typeof msg).toBe('string')
    expect(msg.length).toBeGreaterThan(0)
  })
})

describe('templatesStrings', () => {
  it('listBlockedBy singular', () => {
    expect(templatesStrings.listBlockedBy(1)).toContain('tipo')
    expect(templatesStrings.listBlockedBy(1)).not.toContain('tipos')
  })

  it('listBlockedBy plural', () => {
    expect(templatesStrings.listBlockedBy(3)).toContain('tipos')
  })

  it('listDeleteConfirm includes name', () => {
    const msg = templatesStrings.listDeleteConfirm('Mi plantilla')
    expect(msg).toContain('Mi plantilla')
  })
})

describe('templateEditorStrings', () => {
  it('deleteSectionConfirm singular', () => {
    const msg = templateEditorStrings.deleteSectionConfirm('Mi sección', 1)
    expect(msg).toContain('Mi sección')
    expect(msg).toContain('1')
  })

  it('deleteSectionConfirm plural', () => {
    const msg = templateEditorStrings.deleteSectionConfirm('Mi sección', 3)
    expect(msg).toContain('bloques')
    expect(msg).toContain('hijos')
  })
})

describe('typesStrings', () => {
  it('listDeleteConfirm includes name', () => {
    const msg = typesStrings.listDeleteConfirm('Emergencia')
    expect(msg).toContain('Emergencia')
  })

  it('deleteSeeded message is defined', () => {
    expect(typesStrings.deleteSeeded).toBeTruthy()
  })

  it('seededBadge label is defined', () => {
    expect(typesStrings.seededBadge).toBeTruthy()
  })
})

describe('protocolViewerStrings', () => {
  it('version returns version label', () => {
    expect(protocolViewerStrings.version(7)).toBe('v7')
  })
})

describe('firebaseErrorToSpanish', () => {
  it('maps auth/email-already-in-use', () => {
    const msg = firebaseErrorToSpanish('auth/email-already-in-use')
    expect(msg).toBe(firebaseErrorStrings.emailAlreadyInUse)
  })

  it('maps auth/invalid-email', () => {
    expect(firebaseErrorToSpanish('auth/invalid-email')).toBe(firebaseErrorStrings.invalidEmail)
  })

  it('maps auth/weak-password', () => {
    expect(firebaseErrorToSpanish('auth/weak-password')).toBe(firebaseErrorStrings.weakPassword)
  })

  it('maps auth/user-not-found', () => {
    expect(firebaseErrorToSpanish('auth/user-not-found')).toBe(firebaseErrorStrings.userNotFound)
  })

  it('maps auth/wrong-password', () => {
    expect(firebaseErrorToSpanish('auth/wrong-password')).toBe(firebaseErrorStrings.wrongPassword)
  })

  it('maps auth/invalid-credential', () => {
    expect(firebaseErrorToSpanish('auth/invalid-credential')).toBe(
      firebaseErrorStrings.invalidCredential,
    )
  })

  it('maps auth/network-request-failed', () => {
    expect(firebaseErrorToSpanish('auth/network-request-failed')).toBe(
      firebaseErrorStrings.networkRequestFailed,
    )
  })

  it('maps auth/too-many-requests', () => {
    expect(firebaseErrorToSpanish('auth/too-many-requests')).toBe(
      firebaseErrorStrings.tooManyRequests,
    )
  })

  it('returns UNKNOWN for unrecognized codes', () => {
    expect(firebaseErrorToSpanish('auth/some-unknown-code')).toBe(firebaseErrorStrings.unknown)
  })
})

describe('protocolStatusLabel', () => {
  it('maps active to Spanish', () => {
    expect(protocolStatusLabel('active')).toBe(PROTOCOL_STATUS_LABELS.active)
  })

  it('maps draft to Spanish', () => {
    expect(protocolStatusLabel('draft')).toBe(PROTOCOL_STATUS_LABELS.draft)
  })

  it('maps archived to Spanish', () => {
    expect(protocolStatusLabel('archived')).toBe(PROTOCOL_STATUS_LABELS.archived)
  })

  it('returns the input string for unrecognized status', () => {
    expect(protocolStatusLabel('weird')).toBe('weird')
  })
})
