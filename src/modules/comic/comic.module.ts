import { Module } from '@nestjs/common';
import { ComicController } from './comic.controller';
import { ComicScanController } from './comic-scan.controller';
import { ComicService } from './comic.service';

@Module({
  controllers: [ComicController, ComicScanController],
  providers: [ComicService],
  exports: [ComicService],
})
export class ComicModule {}
