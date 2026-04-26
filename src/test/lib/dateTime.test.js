import { describe, expect, it } from 'vitest'
import {
  formatVietnamDate,
  formatVietnamDateTime,
  formatBangkokDateTime,
  getVietnamDateKey,
  getBangkokDateKey,
  toDateTimeLocalValue,
  toSupabaseDateTime,
  toUnixTimestamp,
} from '../../lib/dateTime'

describe('dateTime', () => {
  it('formats VN date time and keeps alias compatibility', () => {
    const value = '2026-04-27T02:45:00.000Z'
    const vi = formatVietnamDateTime(value)
    expect(vi).toContain('27')
    expect(formatBangkokDateTime(value)).toBe(vi)
  })

  it('formats VN date only', () => {
    const value = '2026-04-27T02:45:00.000Z'
    expect(formatVietnamDate(value)).toContain('27')
  })

  it('returns fallback text for invalid date formatters', () => {
    expect(formatVietnamDateTime('invalid-date', 'N/A')).toBe('N/A')
    expect(formatVietnamDate('invalid-date', 'Unknown')).toBe('Unknown')
  })

  it('returns consistent date key and alias key', () => {
    const value = '2026-04-27T02:45:00.000Z'
    expect(getVietnamDateKey(value)).toBe('2026-04-27')
    expect(getBangkokDateKey(value)).toBe('2026-04-27')
  })

  it('parses unix timestamp with shared parser', () => {
    const value = '2026-04-27T02:45:00.000Z'
    const ms = toUnixTimestamp(value)
    expect(typeof ms).toBe('number')
    expect(ms).toBeGreaterThan(0)
    expect(toUnixTimestamp('invalid-date')).toBeNull()
  })

  it('formats value for datetime-local input in VN timezone', () => {
    const value = '2026-04-27T02:45:00.000Z'
    expect(toDateTimeLocalValue(value)).toBe('2026-04-27T09:45')
    expect(toDateTimeLocalValue('invalid-date')).toBe('')
  })

  it('normalizes datetime value to ISO for supabase', () => {
    const value = '2026-04-27T02:45:00.000Z'
    expect(toSupabaseDateTime(value)).toBe('2026-04-27T02:45:00.000Z')
    expect(toSupabaseDateTime('not-a-date')).toBe('not-a-date')
    expect(toSupabaseDateTime('')).toBe('')
  })
})
