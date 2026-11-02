import { beforeEach, describe, expect, test } from 'bun:test'
import { buildApp, resetDatabase } from '../support/app.ts'

const api = buildApp()

beforeEach(resetDatabase)

describe('GET /rooms', () => {
  test('lists the four rooms with their maintenance period', async () => {
    const response = await api.get('/rooms')
    const rooms = await response.json()

    expect(response.status).toBe(200)
    expect(rooms).toHaveLength(4)
    expect(rooms[3]).toEqual({
      id: 'room-4',
      name: 'Salle Björk',
      capacity: 3,
      maintenance: {
        start: '2026-11-05T00:00:00Z',
        end: '2026-11-08T00:00:00Z',
      },
    })
  })
})

describe('GET /rooms/:id/bookings', () => {
  test('returns the bookings of the room', async () => {
    const response = await api.get('/rooms/room-1/bookings')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual([
      {
        id: 'booking-1',
        roomId: 'room-1',
        memberId: 'member-1',
        start: '2026-11-03T18:00:00Z',
        end: '2026-11-03T20:00:00Z',
        status: 'confirmed',
      },
    ])
  })

  test('keeps only the bookings inside the requested period', async () => {
    const inside = await api.get(
      '/rooms/room-2/bookings?from=2026-11-02T00:00:00Z&to=2026-11-03T00:00:00Z',
    )
    const outside = await api.get(
      '/rooms/room-2/bookings?from=2026-11-04T00:00:00Z&to=2026-11-05T00:00:00Z',
    )

    const ids = (await inside.json()).map((b: { id: string }) => b.id)
    expect(ids).toEqual(['booking-3'])
    expect(await outside.json()).toEqual([])
  })

  test('answers 404 for an unknown room', async () => {
    expect((await api.get('/rooms/room-99/bookings')).status).toBe(404)
  })

  test('answers 400 for an invalid date', async () => {
    const response = await api.get('/rooms/room-1/bookings?from=tomorrow')
    expect(response.status).toBe(400)
  })
})

describe('GET /bookings/:id', () => {
  test('returns one booking', async () => {
    const response = await api.get('/bookings/booking-2')

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      id: 'booking-2',
      roomId: 'room-3',
    })
  })

  test('answers 404 for an unknown booking', async () => {
    expect((await api.get('/bookings/booking-99')).status).toBe(404)
  })
})

describe('GET /members/:id/bookings', () => {
  test('lists the bookings of a member by start date', async () => {
    const response = await api.get('/members/member-2/bookings')
    const bookings = await response.json()

    expect(response.status).toBe(200)
    expect(bookings.map((b: { id: string }) => b.id)).toEqual([
      'booking-4',
      'booking-3',
    ])
  })

  test('answers 404 for an unknown member', async () => {
    expect((await api.get('/members/member-99/bookings')).status).toBe(404)
  })
})
