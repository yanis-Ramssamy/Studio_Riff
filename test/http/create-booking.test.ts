import { beforeEach, describe, expect, test } from 'bun:test'
import { buildApp, resetDatabase } from '../support/app.ts'
import { onDay } from '../support/fixtures.ts'

const api = buildApp()

beforeEach(resetDatabase)

describe('POST /rooms/:id/bookings', () => {
  test('creates a booking and points to it in Location', async () => {
    const response = await api.post('/rooms/room-1/bookings', {
      memberId: 'member-3',
      ...onDay('04', 14, 16),
    })
    const booking = await response.json()

    expect(response.status).toBe(201)
    expect(response.headers.get('Location')).toBe(`/bookings/${booking.id}`)
    expect(booking).toMatchObject({
      roomId: 'room-1',
      memberId: 'member-3',
      start: '2026-11-04T14:00:00Z',
      end: '2026-11-04T16:00:00Z',
      status: 'confirmed',
    })
    expect((await api.get(`/bookings/${booking.id}`)).status).toBe(200)
  })

  test.each([
    ['a body that is not JSON', 'not json'],
    ['a missing member', onDay('04', 14, 16)],
    [
      'an unexpected field',
      { memberId: 'member-3', ...onDay('04', 14, 16), note: 'x' },
    ],
    [
      'a date without timezone',
      {
        memberId: 'member-3',
        start: '2026-11-04T14:00:00',
        end: '2026-11-04T16:00:00',
      },
    ],
    [
      'a slot that does not start on the hour',
      {
        memberId: 'member-3',
        start: '2026-11-04T14:30:00Z',
        end: '2026-11-04T16:30:00Z',
      },
    ],
    [
      'a slot longer than four hours',
      { memberId: 'member-3', ...onDay('04', 12, 18) },
    ],
    [
      'a slot starting before 10:00',
      { memberId: 'member-3', ...onDay('04', 8, 10) },
    ],
  ])('answers 400 for %s', async (_name, body) => {
    expect((await api.post('/rooms/room-1/bookings', body)).status).toBe(400)
  })

  test('answers 404 for an unknown room or member', async () => {
    const unknownRoom = await api.post('/rooms/room-99/bookings', {
      memberId: 'member-3',
      ...onDay('04', 14, 16),
    })
    const unknownMember = await api.post('/rooms/room-1/bookings', {
      memberId: 'member-99',
      ...onDay('04', 14, 16),
    })

    expect(unknownRoom.status).toBe(404)
    expect(unknownMember.status).toBe(404)
  })
})
