import { describe, expect, test } from 'bun:test'
import { InvalidInput } from '#/domain/errors.ts'
import { checkSlot, overlaps } from '#/domain/slot.ts'
import { slot } from '../support/fixtures.ts'

describe('slot rules', () => {
  test.each([
    ['shortest slot', '2026-11-04T10:00:00Z', '2026-11-04T11:00:00Z'],
    ['longest slot', '2026-11-04T14:00:00Z', '2026-11-04T18:00:00Z'],
    ['latest start', '2026-11-04T23:00:00Z', '2026-11-05T00:00:00Z'],
  ])('accepts the %s', (_name, start, end) => {
    expect(() => checkSlot(slot(start, end))).not.toThrow()
  })

  test.each([
    [
      'does not start on the hour',
      '2026-11-04T14:30:00Z',
      '2026-11-04T16:30:00Z',
    ],
    ['starts before 10:00', '2026-11-04T09:00:00Z', '2026-11-04T11:00:00Z'],
    [
      'lasts less than one hour',
      '2026-11-04T14:00:00Z',
      '2026-11-04T14:30:00Z',
    ],
    [
      'lasts more than four hours',
      '2026-11-04T14:00:00Z',
      '2026-11-04T19:00:00Z',
    ],
    ['ends before it starts', '2026-11-04T14:00:00Z', '2026-11-04T12:00:00Z'],
  ])('rejects a slot that %s', (_name, start, end) => {
    expect(() => checkSlot(slot(start, end))).toThrow(InvalidInput)
  })
})

describe('overlap', () => {
  const base = slot('2026-11-04T14:00:00Z', '2026-11-04T16:00:00Z')

  test('detects two slots sharing some time', () => {
    const other = slot('2026-11-04T15:00:00Z', '2026-11-04T17:00:00Z')
    expect(overlaps(base, other)).toBe(true)
  })

  test('allows a slot starting exactly when the previous one ends', () => {
    const next = slot('2026-11-04T16:00:00Z', '2026-11-04T18:00:00Z')
    expect(overlaps(base, next)).toBe(false)
  })
})
