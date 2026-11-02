import { Hono } from 'hono'
import type { BookingService } from '#/application/booking-service.ts'
import { Conflict, InvalidInput, NotFound } from '#/domain/errors.ts'
import { presentBooking, presentRoom } from '#/http/presenters.ts'
import {
  bookingBodySchema,
  parse,
  rangeQuerySchema,
} from '#/http/validation.ts'

export function createApp(service: BookingService) {
  const app = new Hono()

  app.get('/rooms', async (c) => {
    const rooms = await service.listRooms()
    return c.json(rooms.map(presentRoom))
  })

  app.get('/rooms/:id/bookings', async (c) => {
    const range = parse(rangeQuerySchema, c.req.query())
    const bookings = await service.getPlanning(c.req.param('id'), range)
    return c.json(bookings.map(presentBooking))
  })

  app.get('/bookings/:id', async (c) => {
    const booking = await service.getBooking(c.req.param('id'))
    return c.json(presentBooking(booking))
  })

  app.get('/members/:id/bookings', async (c) => {
    const bookings = await service.listMemberBookings(c.req.param('id'))
    return c.json(bookings.map(presentBooking))
  })

  app.post('/rooms/:id/bookings', async (c) => {
    const body = parse(bookingBodySchema, await c.req.json().catch(() => null))
    const booking = await service.book({ roomId: c.req.param('id'), ...body })
    return c.json(presentBooking(booking), 201, {
      Location: `/bookings/${booking.id}`,
    })
  })

  app.notFound((c) => c.json({ error: 'Route not found' }, 404))

  app.onError((error, c) => {
    if (error instanceof InvalidInput) {
      return c.json({ error: error.message }, 400)
    }
    if (error instanceof NotFound) {
      return c.json({ error: error.message }, 404)
    }
    if (error instanceof Conflict) {
      return c.json({ error: error.message }, 409)
    }
    console.error(error)
    return c.json({ error: 'Internal server error' }, 500)
  })

  return app
}
