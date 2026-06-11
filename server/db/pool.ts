import { Pool, type PoolClient, type PoolConfig } from 'pg'

export function dbConfig(): PoolConfig {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is required. Set it to your PostgreSQL connection string.')
  }
  return {
    connectionString,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    // Fail loudly instead of hanging forever when the DB host is unreachable
    // (e.g. a PaaS that blocks outbound port 5432) — pg has no timeout by default.
    connectionTimeoutMillis: Number(process.env.DATABASE_CONNECT_TIMEOUT_MS || 15000),
  }
}

export function createPool(): Pool {
  return new Pool(dbConfig())
}

/** Run `fn` inside a BEGIN/COMMIT transaction, rolling back on any error. */
export async function transaction<T>(pool: Pool, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
