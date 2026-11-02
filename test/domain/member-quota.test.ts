import { describe, expect, test } from 'bun:test'
import { Conflict } from '#/domain/errors.ts'
import { checkMemberQuota } from '#/domain/member-quota.ts'

describe('member quota', () => {
  test.each([0, 1])('accepts a member with %i upcoming bookings', (count) => {
    expect(() => checkMemberQuota(count)).not.toThrow()
  })

  test('refuses a member who already has 2 upcoming bookings', () => {
    expect(() => checkMemberQuota(2)).toThrow(Conflict)
  })
})
