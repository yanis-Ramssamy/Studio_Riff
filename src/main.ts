import { Pool } from 'pg'
import { BookingService } from '#/application/booking-service.ts'
import { requireEnv } from '#/config.ts'
import { createApp } from '#/http/app.ts'
import { noCache } from '#/infrastructure/no-cache.ts'
import { PostgresBookingStore } from '#/infrastructure/postgres-booking-store.ts'

const pool = new Pool({ connectionString: requireEnv('DATABASE_URL') })

const service = new BookingService(
  new PostgresBookingStore(pool),
  noCache,
  { now: () => new Date() },
  () => crypto.randomUUID(),
)

const server = Bun.serve({
  hostname: '127.0.0.1',
  port: Number(process.env.PORT ?? 3000),
  fetch: createApp(service).fetch,
})
console.log(`Studio Riff API on ${server.url}`)

async function shutdown() {
  await server.stop()
  await pool.end()
  process.exit(0)
}
process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
