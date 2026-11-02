import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Pool } from 'pg'

const SQL_DIRECTORY = join(import.meta.dir, '..', '..', 'sql')

export async function applyMigrations(pool: Pool): Promise<string[]> {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`)
  const done = await pool.query<{ name: string }>(
    'SELECT name FROM schema_migrations',
  )
  const applied = new Set(done.rows.map((row) => row.name))

  const folder = join(SQL_DIRECTORY, 'migrations')
  const files = (await readdir(folder))
    .filter((name) => name.endsWith('.sql'))
    .sort()
  const newlyApplied: string[] = []

  for (const file of files) {
    if (applied.has(file)) {
      continue
    }
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(await readFile(join(folder, file), 'utf8'))
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [
        file,
      ])
      await client.query('COMMIT')
      newlyApplied.push(file)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
  return newlyApplied
}

export async function seedDatabase(pool: Pool): Promise<void> {
  await pool.query(await readFile(join(SQL_DIRECTORY, 'seed.sql'), 'utf8'))
}
