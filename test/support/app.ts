import { Pool } from 'pg'
import { BookingService } from '#/application/booking-service.ts'
import type { BookingStore, PlanningCache } from '#/application/ports.ts'
import { requireEnv } from '#/config.ts'
import { createApp } from '#/http/app.ts'
import { noCache } from '#/infrastructure/no-cache.ts'
import { PostgresBookingStore } from '#/infrastructure/postgres-booking-store.ts'
import { applyMigrations, seedDatabase } from '#/infrastructure/sql-files.ts'
import { NOW } from './fixtures.ts'

export const pool = new Pool({
  connectionString: requireEnv('TEST_DATABASE_URL'),
})

export async function resetDatabase() {
  await applyMigrations(pool)
  await seedDatabase(pool)
}

export function buildApp(
  cache: PlanningCache = noCache,
  store: BookingStore = new PostgresBookingStore(pool),
) {
  const service = new BookingService(store, cache, { now: () => NOW }, () =>
    crypto.randomUUID(),
  )
  const app = createApp(service)

  return {
    get: (path: string) => app.request(path),
    delete: (path: string) => app.request(path, { method: 'DELETE' }),
    post: (path: string, body: unknown) =>
      app.request(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: typeof body === 'string' ? body : JSON.stringify(body),
      }),
  }
}
