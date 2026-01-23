import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { loggers } from '@/lib/logger/modules';
import * as schema from './schema';

// Lazy initialization of database pool
let pool: Pool | null = null;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is not configured');
    }
    pool = new Pool({
      connectionString,
      max: parseInt(process.env.DB_POOL_MAX || '10', 10),
      min: parseInt(process.env.DB_POOL_MIN || '2', 10),
      idleTimeoutMillis: 30000, // Close idle connections after 30s
      connectionTimeoutMillis: 5000, // Timeout after 5s if can't connect
    });
    
     // Handle pool errors
     pool.on('error', (err) => {
       loggers.db.error({ error: err instanceof Error ? err.message : String(err) }, 'Unexpected pool error');
     });
  }
  return pool;
}

// Get the database instance (lazy initialization)
export function getDb() {
  if (!dbInstance) {
    dbInstance = drizzle(getPool(), { schema });
  }
  return dbInstance;
}

// Close the pool gracefully (for shutdown)
export async function closePool(): Promise<void> {
   if (pool) {
     await pool.end();
     pool = null;
     dbInstance = null;
     loggers.db.info('Pool closed');
   }
 }

// Export schema for convenience
export * from './schema';
export { schema };
