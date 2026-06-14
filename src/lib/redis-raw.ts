import Redis from 'ioredis';

let redisClient: Redis | null = null;
let lastErrorLogAt = 0;

function attachRedisErrorHandler(client: Redis): void {
  client.on('error', (error) => {
    const now = Date.now();
    if (now - lastErrorLogAt < 30_000) {
      return;
    }

    lastErrorLogAt = now;
    console.error('[redis] Connection error:', error.message);
  });
}

export function describeRedisTarget(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}:${parsed.port || '6379'}`;
  } catch {
    return 'unknown';
  }
}

export function initRedisClient(url: string): Redis | null {
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  if (redisClient) {
    return redisClient;
  }

  try {
    redisClient = new Redis(trimmed, {
      maxRetriesPerRequest: 3,
      enableOfflineQueue: true,
      connectTimeout: 5000,
      retryStrategy: (times) => {
        if (times > 10) {
          return 10_000;
        }
        return Math.min(times * 500, 5000);
      },
    });
    attachRedisErrorHandler(redisClient);
    return redisClient;
  } catch (error) {
    console.error(
      '[redis] Failed to initialize:',
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

export function getRedisRaw(): Redis | null {
  if (redisClient) {
    return redisClient;
  }

  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    return null;
  }

  return initRedisClient(url);
}
