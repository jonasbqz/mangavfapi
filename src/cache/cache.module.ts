import { Global, Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-ioredis-yet';
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

        console.log('Connecting to Redis...');

        return {
          store: await redisStore({
            url: redisUrl,
            ttl: 60,
            maxRetriesPerRequest: 3,
            enableOfflineQueue: true,
            connectTimeout: 5000,
            retryStrategy: (times: number) => {
              if (times > 10) {
                return 10000;
              }
              return Math.min(times * 500, 5000);
            },
          } as Parameters<typeof redisStore>[0]),
        };
      },
    }),
  ],
  providers: [CacheService],
  exports: [CacheModule, CacheService],
})
export class RedisCacheModule {}
