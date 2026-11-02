import { RedisClient } from 'bun'
import { Pool } from 'pg'
import { BookingService } from '#/application/booking-service.ts'
import { requireEnv } from '#/config.ts'
import { createApp } from '#/http/app.ts'
import { PostgresBookingStore } from '#/infrastructure/postgres-booking-store.ts'
import { ValkeyPlanningCache } from '#/infrastructure/valkey-planning-cache.ts'

const pool = new Pool({ connectionString: requireEnv('DATABASE_URL') })
const valkey = new RedisClient(requireEnv('VALKEY_URL'))

const service = new BookingService(
  new PostgresBookingStore(pool),
  new ValkeyPlanningCache(valkey),
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
  valkey.close()
  await pool.end()
  process.exit(0)
}
process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
