import { Global, Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisInsStore } from 'cache-manager-ioredis-yet';
import { describeRedisTarget, initRedisClient } from '@/lib/redis-raw';
import { CacheService } from './cache.service';

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL')?.trim();

        if (!redisUrl) {
          console.warn('REDIS_URL not configured, using in-memory cache');
          return {
            ttl: 60 * 1000, // 1 minute default TTL
          };
        }

        const client = initRedisClient(redisUrl);
        if (!client) {
          console.warn(
            'REDIS_URL is set but Redis client could not be initialized, using in-memory cache',
          );
          return {
            ttl: 60 * 1000,
          };
        }

        console.log(`Connecting to Redis at ${describeRedisTarget(redisUrl)}...`);

        return {
          store: redisInsStore(client as never, {
            ttl: 60, // default TTL in seconds
          }),
        };
      },
    }),
  ],
  providers: [CacheService],
  exports: [CacheModule, CacheService],
})
export class RedisCacheModule {}
