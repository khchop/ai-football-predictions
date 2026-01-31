import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { loggers } from '@/lib/logger/modules';
import * as schema from './schema';

// Health monitoring interface
interface PoolHealth {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
  maxConnections: number;
  utilizationPercent: number;
}

// Lazy initialization of database pool
let pool: Pool | null = null;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;
let monitoringStarted = false;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is not configured');
    }
    pool = new Pool({
      connectionString,
      max: parseInt(process.env.DB_POOL_MAX || '20', 10),
      min: parseInt(process.env.DB_POOL_MIN || '2', 10),
      idleTimeoutMillis: 30000, // Close idle connections after 30s
      connectionTimeoutMillis: 5000, // Timeout after 5s if can't connect
      keepAlive: true, // Enable TCP keep-alive to prevent connection drops
      keepAliveInitialDelayMillis: 10000, // Start keep-alive after 10s
    });

     // Handle pool errors
     pool.on('error', (err) => {
       loggers.db.error({ error: err instanceof Error ? err.message : String(err) }, 'Unexpected pool error');
     });

     // Start health monitoring on first pool initialization
     startMonitoring();
  }
  return pool;
}

// Pool health monitoring
function monitorPoolHealth(poolInstance: Pool): void {
  const health: PoolHealth = {
    totalCount: poolInstance.totalCount,
    idleCount: poolInstance.idleCount,
    waitingCount: poolInstance.waitingCount,
    maxConnections: poolInstance.options.max || 20,
    utilizationPercent: Math.round(
      ((poolInstance.totalCount - poolInstance.idleCount) / (poolInstance.options.max || 20)) * 100
    ),
  };

  loggers.db.debug(health, 'Pool health check');

  // Alert on concerning conditions
  if (health.waitingCount > 5) {
    loggers.db.warn(health, 'High connection wait queue detected');
  }
  if (health.utilizationPercent > 90) {
    loggers.db.warn(health, 'Pool utilization exceeds 90%');
  }
  if (health.totalCount === health.maxConnections && health.idleCount === 0) {
    loggers.db.error(health, 'Pool exhausted - all connections in use');
  }
}

function startMonitoring(): void {
  if (!monitoringStarted && pool) {
    const poolInstance = pool; // Capture pool to avoid null check issues in closure
    setInterval(() => monitorPoolHealth(poolInstance), 30000);
    monitoringStarted = true;
    loggers.db.info('Pool health monitoring started - checking every 30s');
  }
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
     monitoringStarted = false;
     loggers.db.info('Pool closed');
   }
 }

// Export schema for convenience
export * from './schema';
export { schema };
