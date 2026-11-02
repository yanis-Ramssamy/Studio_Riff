import { describe, expect, test } from 'bun:test'
import { Conflict } from '#/domain/errors.ts'
import { checkRoomAvailable } from '#/domain/maintenance.ts'
import type { Room } from '#/domain/types.ts'
import { slot } from '../support/fixtures.ts'

const roomUnderMaintenance: Room = {
  id: 'room-4',
  name: 'Salle Björk',
  capacity: 3,
  maintenance: slot('2026-11-05T00:00:00Z', '2026-11-08T00:00:00Z'),
}

describe('maintenance', () => {
  test('refuses a slot that runs into the maintenance period', () => {
    const requested = slot('2026-11-04T23:00:00Z', '2026-11-05T02:00:00Z')
    expect(() => checkRoomAvailable(roomUnderMaintenance, requested)).toThrow(
      Conflict,
    )
  })

  test('accepts a slot ending when the maintenance starts', () => {
    const requested = slot('2026-11-04T22:00:00Z', '2026-11-05T00:00:00Z')
    expect(() =>
      checkRoomAvailable(roomUnderMaintenance, requested),
    ).not.toThrow()
  })

  test('accepts any slot for a room without maintenance', () => {
    const room = { ...roomUnderMaintenance, maintenance: null }
    const requested = slot('2026-11-06T10:00:00Z', '2026-11-06T12:00:00Z')
    expect(() => checkRoomAvailable(room, requested)).not.toThrow()
  })
})
