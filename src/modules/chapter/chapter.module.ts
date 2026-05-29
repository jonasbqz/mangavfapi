import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { JwtDownloadModule } from '../jwt-download/jwt-download.module';
import { ChapterController } from './chapter.controller';
import { ChapterService } from './chapter.service';
import { ComicModule } from '../comic/comic.module';
import { RouteProtectionModule } from '../route-protection/route-protection.module';
import { TrafficEventsModule } from '../traffic/traffic-events.module';

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
