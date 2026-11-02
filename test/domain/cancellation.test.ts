import { describe, expect, test } from 'bun:test'
import { cancelBooking } from '#/domain/cancellation.ts'
import { Conflict } from '#/domain/errors.ts'
import { aBooking, NOW } from '../support/fixtures.ts'

describe('cancellation', () => {
  test('is a plain cancellation more than 24 hours before the start', () => {
    const booking = aBooking('2026-11-03T18:00:00Z', '2026-11-03T20:00:00Z')
    expect(cancelBooking(booking, NOW).status).toBe('cancelled')
  })

  test('is late less than 24 hours before the start', () => {
    const booking = aBooking('2026-11-02T19:00:00Z', '2026-11-02T21:00:00Z')
    expect(cancelBooking(booking, NOW).status).toBe('late_cancelled')
  })

  test('is still a plain cancellation exactly 24 hours before the start', () => {
    const booking = aBooking('2026-11-03T09:00:00Z', '2026-11-03T11:00:00Z')
    expect(cancelBooking(booking, NOW).status).toBe('cancelled')
  })

  test('cannot happen twice', () => {
    const booking = aBooking('2026-11-03T18:00:00Z', '2026-11-03T20:00:00Z')
    const cancelled = cancelBooking(booking, NOW)
    expect(() => cancelBooking(cancelled, NOW)).toThrow(Conflict)
  })
})
