import { beforeEach, describe, expect, test } from 'bun:test'
import { buildApp, resetDatabase } from '../support/app.ts'
import { onDay } from '../support/fixtures.ts'

const api = buildApp()

beforeEach(resetDatabase)

describe('overlapping bookings', () => {
  test('are refused with 409', async () => {
    const response = await api.post('/rooms/room-1/bookings', {
      memberId: 'member-3',
      ...onDay('03', 19, 21),
    })
    expect(response.status).toBe(409)
  })

  test('are accepted when a slot starts as the previous one ends', async () => {
    const response = await api.post('/rooms/room-1/bookings', {
      memberId: 'member-3',
      ...onDay('03', 20, 22),
    })
    expect(response.status).toBe(201)
  })

  test('cannot both succeed when sent at the same time', async () => {
    const attempts = ['member-2', 'member-3'].map((memberId) =>
      api.post('/rooms/room-1/bookings', { memberId, ...onDay('09', 14, 16) }),
    )
    const statuses = (await Promise.all(attempts)).map((r) => r.status).sort()

    expect(statuses).toEqual([201, 409])
  })
})
