import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  forgetCheckedInEvent,
  forgetDismissedCheckInEvent,
  hasCheckedInEvent,
  hasDismissedCheckInEvent,
  rememberCheckedInEvent,
  rememberDismissedCheckInEvent,
} from '../../lib/checkinCache'

describe('checkinCache', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('stores checked-in event and avoids duplicates', () => {
    rememberCheckedInEvent('u1', 'e1')
    rememberCheckedInEvent('u1', 'e1')

    expect(hasCheckedInEvent('u1', 'e1')).toBe(true)
    expect(JSON.parse(localStorage.getItem('badminton-app.checked-in-events.u1'))).toEqual(['e1'])
  })

  it('forgets checked-in event and no-ops with missing params', () => {
    rememberCheckedInEvent('u1', 'e1')
    rememberCheckedInEvent('u1', 'e2')

    forgetCheckedInEvent('u1', 'e1')
    forgetCheckedInEvent('', 'e2')

    expect(hasCheckedInEvent('u1', 'e1')).toBe(false)
    expect(hasCheckedInEvent('u1', 'e2')).toBe(true)
  })

  it('returns false for checked-in cache when storage has invalid json', () => {
    localStorage.setItem('badminton-app.checked-in-events.u1', '{invalid-json')

    expect(hasCheckedInEvent('u1', 'e1')).toBe(false)
  })

  it('stores dismissed event and avoids duplicates', () => {
    rememberDismissedCheckInEvent('u1', 'e1')
    rememberDismissedCheckInEvent('u1', 'e1')

    expect(hasDismissedCheckInEvent('u1', 'e1')).toBe(true)
    expect(JSON.parse(localStorage.getItem('badminton-app.dismissed-checkin-events.u1'))).toEqual(['e1'])
  })

  it('forgets dismissed event and no-ops with missing params', () => {
    rememberDismissedCheckInEvent('u1', 'e1')
    rememberDismissedCheckInEvent('u1', 'e2')

    forgetDismissedCheckInEvent('u1', 'e1')
    forgetDismissedCheckInEvent('u1', '')

    expect(hasDismissedCheckInEvent('u1', 'e1')).toBe(false)
    expect(hasDismissedCheckInEvent('u1', 'e2')).toBe(true)
  })

  it('handles write errors safely', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })

    expect(() => rememberCheckedInEvent('u1', 'e1')).not.toThrow()
    expect(() => rememberDismissedCheckInEvent('u1', 'e1')).not.toThrow()
  })
})
