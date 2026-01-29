import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ComicService } from './comic.service';

@ApiTags('Comic Scans')
@Controller('datah/comic-scans')
export class ComicScanController {
  constructor(private comicService: ComicService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get comic scan by ID with chapters' })
  async findById(@Param('id', ParseIntPipe) id: number) {
    const comicScan = await this.comicService.getComicScanById(id);
    return { data: comicScan };
  }
}
