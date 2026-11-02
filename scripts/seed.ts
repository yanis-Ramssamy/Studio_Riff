import { Pool } from 'pg'
import { requireEnv } from '#/config.ts'
import { seedDatabase } from '#/infrastructure/sql-files.ts'

const pool = new Pool({ connectionString: requireEnv('DATABASE_URL') })
await seedDatabase(pool)
console.log('Seed data inserted')
await pool.end()
