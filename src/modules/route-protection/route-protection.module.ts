import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/database/database.module';
import { RedisCacheModule } from '@/cache/cache.module';
import { RouteProtectionService } from './route-protection.service';

@Module({
  imports: [DatabaseModule, RedisCacheModule],
  providers: [RouteProtectionService],
  exports: [RouteProtectionService],
})
export class RouteProtectionModule {}
