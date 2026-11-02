import { beforeEach, describe, expect, test } from 'bun:test'
import { buildApp, resetDatabase } from '../support/app.ts'
import { onDay } from '../support/fixtures.ts'

const api = buildApp()

beforeEach(resetDatabase)

describe('upcoming bookings of a member', () => {
  test('are limited to 2', async () => {
    const response = await api.post('/rooms/room-2/bookings', {
      memberId: 'member-1',
      ...onDay('06', 14, 16),
    })
    expect(response.status).toBe(409)
  })

  test('ignore bookings that already started', async () => {
    const response = await api.post('/rooms/room-1/bookings', {
      memberId: 'member-2',
      ...onDay('06', 14, 16),
    })
    expect(response.status).toBe(201)
  })

  test('cannot be exceeded by simultaneous requests', async () => {
    const attempts = [11, 12, 13].map((day) =>
      api.post('/rooms/room-1/bookings', {
        memberId: 'member-3',
        ...onDay(String(day), 14, 16),
      }),
    )
    const statuses = (await Promise.all(attempts)).map((r) => r.status).sort()

    expect(statuses).toEqual([201, 201, 409])
  })
})
