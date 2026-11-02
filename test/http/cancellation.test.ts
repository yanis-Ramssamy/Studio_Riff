import { beforeEach, describe, expect, test } from 'bun:test'
import { buildApp, resetDatabase } from '../support/app.ts'
import { onDay } from '../support/fixtures.ts'

const api = buildApp()

beforeEach(resetDatabase)

describe('DELETE /bookings/:id', () => {
  test('cancels a booking more than 24 hours ahead', async () => {
    const response = await api.delete('/bookings/booking-1')
    const booking = await (await api.get('/bookings/booking-1')).json()

    expect(response.status).toBe(204)
    expect(booking.status).toBe('cancelled')
  })

  test('marks a cancellation under 24 hours as late', async () => {
    const response = await api.delete('/bookings/booking-3')
    const booking = await (await api.get('/bookings/booking-3')).json()

    expect(response.status).toBe(204)
    expect(booking.status).toBe('late_cancelled')
  })

  test('answers 409 when the booking is already cancelled', async () => {
    await api.delete('/bookings/booking-1')
    expect((await api.delete('/bookings/booking-1')).status).toBe(409)
  })

  test('answers 404 for an unknown booking', async () => {
    expect((await api.delete('/bookings/booking-99')).status).toBe(404)
  })

  test('only lets one of two simultaneous cancellations succeed', async () => {
    const attempts = [
      api.delete('/bookings/booking-1'),
      api.delete('/bookings/booking-1'),
    ]
    const statuses = (await Promise.all(attempts)).map((r) => r.status).sort()

    expect(statuses).toEqual([204, 409])
  })

  test('frees the slot for another member', async () => {
    await api.delete('/bookings/booking-1')
    const response = await api.post('/rooms/room-1/bookings', {
      memberId: 'member-3',
      ...onDay('03', 18, 20),
    })
    expect(response.status).toBe(201)
  })

  test('lets the member book again', async () => {
    await api.delete('/bookings/booking-1')
    const response = await api.post('/rooms/room-2/bookings', {
      memberId: 'member-1',
      ...onDay('06', 14, 16),
    })
    expect(response.status).toBe(201)
  })

  test('keeps the booking in the history of the member', async () => {
    await api.delete('/bookings/booking-1')
    const bookings = await (await api.get('/members/member-1/bookings')).json()

    expect(bookings.map((b: { status: string }) => b.status)).toEqual([
      'cancelled',
      'confirmed',
    ])
  })
})
