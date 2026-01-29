import { Module, forwardRef } from '@nestjs/common';
import { ChapterController } from './chapter.controller';
import { ChapterService } from './chapter.service';
import { ComicModule } from '../comic/comic.module';

@Module({
  imports: [forwardRef(() => ComicModule)],
  controllers: [ChapterController],
  providers: [ChapterService],
  exports: [ChapterService],
})
export class ChapterModule {}
