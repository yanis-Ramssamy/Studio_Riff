import { Pool } from 'pg'
import { requireEnv } from '#/config.ts'
import { applyMigrations } from '#/infrastructure/sql-files.ts'

const pool = new Pool({ connectionString: requireEnv('DATABASE_URL') })
const applied = await applyMigrations(pool)
console.log(
  applied.length > 0 ? `Applied: ${applied.join(', ')}` : 'Nothing to apply',
)
await pool.end()
