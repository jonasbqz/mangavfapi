import { Test } from '@nestjs/testing';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisInsStore } from 'cache-manager-ioredis-yet';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import {
  describeRedisTarget,
  getRedisRaw,
  initRedisClient,
} from '../src/lib/redis-raw';

function maskRedisUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}:${parsed.port || '6379'}`;
  } catch {
    return 'invalid-url';
  }
}

async function verifyRawRedis(url: string) {
  const client = initRedisClient(url);
  if (!client) {
    throw new Error('initRedisClient returned null');
  }

  const host = client.options.host;
  const port = client.options.port;

  if (host === '127.0.0.1' || host === 'localhost') {
    throw new Error(`Redis apunta a localhost (${host}:${port}) en vez del servicio real`);
  }

  const pong = await client.ping();
  if (pong !== 'PONG') {
    throw new Error(`ping inesperado: ${pong}`);
  }

  const testKey = `monline:redis-verify:${Date.now()}`;
  await client.set(testKey, 'ok', 'PX', 10_000);
  const value = await client.get(testKey);
  if (value !== 'ok') {
    throw new Error(`set/get falló: ${value}`);
  }

  const counter = await client.incr(`${testKey}:counter`);
  if (counter !== 1) {
    throw new Error(`incr falló: ${counter}`);
  }

  await client.del(testKey, `${testKey}:counter`);

  return { host, port, pong };
}

async function verifyNestCache(url: string) {
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true }),
      CacheModule.registerAsync({
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: async (configService: ConfigService) => {
          const redisUrl = configService.get<string>('REDIS_URL')?.trim();
          const client = initRedisClient(redisUrl || '');
          return {
            store: redisInsStore(client as never, { ttl: 60 }),
          };
        },
      }),
    ],
  }).compile();

  const cache = moduleRef.get<Cache>(CACHE_MANAGER);
  const key = `cache-verify:${Date.now()}`;
  await cache.set(key, { ok: true }, 5000);
  const cached = await cache.get<{ ok: boolean }>(key);
  await cache.del(key);
  await moduleRef.close();

  if (!cached?.ok) {
    throw new Error('cache-manager no pudo leer el valor cacheado');
  }
}

async function main() {
  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    console.error('FAIL: REDIS_URL no está definida');
    process.exit(1);
  }

  console.log(`REDIS_URL target: ${maskRedisUrl(url)}`);
  console.log(`Parsed target: ${describeRedisTarget(url)}`);

  const raw = await verifyRawRedis(url);
  console.log(`OK raw redis: ${raw.host}:${raw.port} ping=${raw.pong}`);

  process.env.REDIS_URL = url;
  const singleton = getRedisRaw();
  if (!singleton) {
    throw new Error('getRedisRaw() devolvió null');
  }
  console.log(
    `OK singleton redis: ${singleton.options.host}:${singleton.options.port}`,
  );

  await verifyNestCache(url);
  console.log('OK nest cache-manager store');

  console.log('Redis verification passed');
}

main().catch((error) => {
  console.error('FAIL:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
