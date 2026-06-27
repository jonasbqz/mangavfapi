import {
  Controller,
  Get,
  Param,
  Res,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiProduces } from '@nestjs/swagger';
import { AuthGuard } from '@/modules/auth/auth.guard';
import { ProfileGuard } from '@/modules/auth/profile.guard';
import { VerifiedEmailGuard } from '@/modules/auth/verified-email.guard';
import { DownloadsService } from './downloads.service';

@ApiTags('Downloads')
@Controller('downloads')
@UseGuards(AuthGuard, ProfileGuard, VerifiedEmailGuard)
@ApiBearerAuth()
export class DownloadsController {
  constructor(private downloadsService: DownloadsService) {}

  @Get('chapters/:chapterId/pdf')
  @ApiOperation({ summary: 'Download chapter as PDF' })
  @ApiProduces('application/pdf')
  async downloadChapterPdf(
    @Param('chapterId', ParseIntPipe) chapterId: number,
    @Res() reply: any,
  ) {
    const { stream, filename } = await this.downloadsService.generateChapterPdf(chapterId);

    reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(stream);
  }
}
