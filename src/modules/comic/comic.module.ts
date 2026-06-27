import { Module } from '@nestjs/common';
import { ComicController } from './comic.controller';
import { ComicScanController } from './comic-scan.controller';
import { ComicService } from './comic.service';
import { SearchAbuseService } from './search-abuse.service';
import { RouteProtectionModule } from '@/modules/route-protection/route-protection.module';
import { TrafficEventsModule } from '@/modules/traffic/traffic-events.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { RedisCacheModule } from '@/cache/cache.module';

@Module({
  imports: [RouteProtectionModule, TrafficEventsModule, AuthModule, RedisCacheModule],
  controllers: [ComicController, ComicScanController],
  providers: [ComicService, SearchAbuseService],
  exports: [ComicService],
})
export class ComicModule {}
