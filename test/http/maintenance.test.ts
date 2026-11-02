import { beforeEach, describe, expect, test } from 'bun:test'
import { buildApp, resetDatabase } from '../support/app.ts'

const api = buildApp()

beforeEach(resetDatabase)

describe('room under maintenance', () => {
  test('refuses a booking that runs into the maintenance period', async () => {
    const response = await api.post('/rooms/room-4/bookings', {
      memberId: 'member-3',
      start: '2026-11-04T23:00:00Z',
      end: '2026-11-05T02:00:00Z',
    })
    expect(response.status).toBe(409)
  })

  test('accepts a booking that ends when the maintenance starts', async () => {
    const response = await api.post('/rooms/room-4/bookings', {
      memberId: 'member-3',
      start: '2026-11-04T22:00:00Z',
      end: '2026-11-05T00:00:00Z',
    })
    expect(response.status).toBe(201)
  })
})
