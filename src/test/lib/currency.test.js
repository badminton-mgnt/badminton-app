import { describe, expect, it } from 'vitest'
import { formatVndAmount } from '../../lib/currency'

describe('currency', () => {
  it('formats integer amounts with grouping', () => {
    expect(formatVndAmount(1234567)).toBe('1,234,567')
  })

  it('rounds decimal amounts to whole number', () => {
    expect(formatVndAmount(1234.6)).toBe('1,235')
  })

  it('falls back to zero for invalid values', () => {
    expect(formatVndAmount(undefined)).toBe('0')
    expect(formatVndAmount('bad-value')).toBe('0')
  })
})
