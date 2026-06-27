import { Module } from '@nestjs/common';
import { ReadingHistoryController } from './reading-history.controller';
import { ReadingHistoryService } from './reading-history.service';
import { AuthModule } from '@/modules/auth/auth.module';
import { RouteProtectionModule } from '@/modules/route-protection/route-protection.module';
import { RedisCacheModule } from '@/cache/cache.module';

@Module({
  imports: [AuthModule, RouteProtectionModule, RedisCacheModule],
  controllers: [ReadingHistoryController],
  providers: [ReadingHistoryService],
  exports: [ReadingHistoryService],
})
export class ReadingHistoryModule {}
