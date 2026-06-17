import { Pool } from 'pg';

let sharedPool: Pool | null = null;

function readPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function resolvePoolMax(): number {
  if (process.env.DB_POOL_MAX) {
    return readPositiveInt(process.env.DB_POOL_MAX, 25);
  }

  const replicaCount = readPositiveInt(process.env.APP_REPLICA_COUNT, 1);
  const connectionBudget = readPositiveInt(process.env.DB_CONNECTION_BUDGET, 24);

  return Math.max(4, Math.min(10, Math.floor(connectionBudget / replicaCount)));
}

export function resolvePoolMin(poolMax: number): number {
  const configuredMin = readPositiveInt(process.env.DB_POOL_MIN, 0);
  if (process.env.DB_POOL_MIN) {
    return Math.min(configuredMin, poolMax);
  }

  return poolMax >= 10 ? 1 : 0;
}

export function isDatabaseConnectionError(error: unknown): boolean {
  const messages = [
    error instanceof Error ? error.message : String(error),
    error instanceof Error && error.cause instanceof Error
      ? error.cause.message
      : '',
  ];

  return messages.some(
    (message) =>
      message.includes('timeout exceeded when trying to connect') ||
      message.includes('Connection terminated unexpectedly') ||
      message.includes('ECONNREFUSED') ||
      message.includes('ENOTFOUND') ||
      message.includes('too many clients already'),
  );
}

export function getSharedPool(): Pool {
  if (!sharedPool) {
    const poolMax = resolvePoolMax();
    const poolMin = resolvePoolMin(poolMax);
    const replicaCount = readPositiveInt(process.env.APP_REPLICA_COUNT, 1);

    sharedPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: poolMax,
      min: poolMin,
      keepAlive: true,
      idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 30000),
      connectionTimeoutMillis: Number(
        process.env.DB_CONNECTION_TIMEOUT_MS || 15000,
      ),
    });

    console.log(
      `Database pool configured: max=${poolMax}, min=${poolMin}, replicas=${replicaCount}`,
    );

    if (!process.env.DB_POOL_MAX && replicaCount > 1) {
      console.warn(
        `DB pool auto-scaled for ${replicaCount} replicas. Set DB_POOL_MAX or DB_CONNECTION_BUDGET explicitly if needed.`,
      );
    }

    sharedPool.on('error', (error) => {
      console.error('Database pool idle client error:', error.message);
    });
  }

  return sharedPool;
}
