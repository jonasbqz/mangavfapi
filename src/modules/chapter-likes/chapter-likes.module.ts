import { Module } from '@nestjs/common';
import { ChapterLikesController } from './chapter-likes.controller';
import { ChapterLikesService } from './chapter-likes.service';
import { AuthModule } from '@/modules/auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ChapterLikesController],
  providers: [ChapterLikesService],
  exports: [ChapterLikesService],
})
export class ChapterLikesModule {}
