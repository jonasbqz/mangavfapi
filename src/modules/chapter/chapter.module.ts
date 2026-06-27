import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '@/modules/auth/auth.module';
import { JwtDownloadModule } from '@/modules/jwt-download/jwt-download.module';
import { ChapterController } from './chapter.controller';
import { ChapterService } from './chapter.service';
import { ComicModule } from '@/modules/comic/comic.module';
import { RouteProtectionModule } from '@/modules/route-protection/route-protection.module';
import { TrafficEventsModule } from '@/modules/traffic/traffic-events.module';

@Module({
  imports: [
    AuthModule,
    forwardRef(() => ComicModule),
    JwtDownloadModule,
    RouteProtectionModule,
    TrafficEventsModule,
  ],
  controllers: [ChapterController],
  providers: [ChapterService],
  exports: [ChapterService],
})
export class ChapterModule {}
