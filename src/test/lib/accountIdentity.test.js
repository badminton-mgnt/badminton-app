import { describe, expect, it } from 'vitest'
import {
  APP_SECRET_INTERNAL_EMAIL_DOMAIN,
  getVisibleUserEmail,
  isInternalAppSecretEmail,
} from '../../lib/accountIdentity'

describe('accountIdentity', () => {
  it('detects internal app-secret email', () => {
    expect(isInternalAppSecretEmail(`user@${APP_SECRET_INTERNAL_EMAIL_DOMAIN}`)).toBe(true)
    expect(isInternalAppSecretEmail(`USER@${APP_SECRET_INTERNAL_EMAIL_DOMAIN}`)).toBe(true)
    expect(isInternalAppSecretEmail('user@example.com')).toBe(false)
  })

  it('hides internal email from UI', () => {
    expect(getVisibleUserEmail(`user@${APP_SECRET_INTERNAL_EMAIL_DOMAIN}`)).toBeNull()
    expect(getVisibleUserEmail('')).toBeNull()
    expect(getVisibleUserEmail('normal.user@gmail.com')).toBe('normal.user@gmail.com')
  })
})
