import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@/modules/auth/auth.guard';
import { ProfileGuard } from '@/modules/auth/profile.guard';
import { CurrentUser, UserSession } from '@/modules/auth/current-user.decorator';
import { enrichEntriesWithPaths } from '@/lib/enrich-paths';
import { ReadingHistoryService } from './reading-history.service';
import { RecordReadingDto } from './reading-history.dto';
import { RouteProtectionService } from '@/modules/route-protection/route-protection.service';

@ApiTags('Reading History')
@Controller('reading-history')
@UseGuards(AuthGuard, ProfileGuard)
@ApiBearerAuth()
export class ReadingHistoryController {
  constructor(
    private readingHistoryService: ReadingHistoryService,
    private routeProtectionService: RouteProtectionService,
  ) {}

  private async enrichEntry(entry: any): Promise<any> {
    if (!entry) {
      return entry;
    }

    const [enriched] = await enrichEntriesWithPaths([entry], this.routeProtectionService);
    return enriched;
  }

  @Post()
  @ApiOperation({ summary: 'Record reading progress' })
  async record(
    @CurrentUser() user: UserSession,
    @Body() dto: RecordReadingDto,
  ) {
    const entry = await this.readingHistoryService.record(user.profileId!, dto);
    return this.enrichEntry(entry);
  }

  @Get()
  @ApiOperation({ summary: 'Get full reading history' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async findAll(
    @CurrentUser() user: UserSession,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const entries = await this.readingHistoryService.findAll(
      user.profileId!,
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
    );
    return enrichEntriesWithPaths(entries, this.routeProtectionService);
  }

  @Get('recent')
  @ApiOperation({ summary: 'Get recent reading history' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async findRecent(
    @CurrentUser() user: UserSession,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const entries = await this.readingHistoryService.findRecent(
      user.profileId!,
      limit ? parseInt(limit, 10) : 10,
      offset ? parseInt(offset, 10) : 0,
    );
    return enrichEntriesWithPaths(entries, this.routeProtectionService);
  }

  @Get('comics')
  @ApiOperation({ summary: 'Get reading history grouped by comic' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'chaptersLimit', required: false, type: Number })
  async findGroupedByComic(
    @CurrentUser() user: UserSession,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('chaptersLimit') chaptersLimit?: string,
  ) {
    const result = await this.readingHistoryService.findGroupedByComic(
      user.profileId!,
      limit ? parseInt(limit, 10) : 20,
      offset ? parseInt(offset, 10) : 0,
      chaptersLimit ? parseInt(chaptersLimit, 10) : 4,
    );

    const items = await Promise.all(
      result.items.map(async (item) => ({
        ...item,
        entries: await enrichEntriesWithPaths(item.entries, this.routeProtectionService),
      })),
    );

    return {
      ...result,
      items,
    };
  }

  @Get('comic/:comicId')
  @ApiOperation({ summary: 'Get reading history for a comic' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async findByComic(
    @CurrentUser() user: UserSession,
    @Param('comicId', ParseIntPipe) comicId: number,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const entries = await this.readingHistoryService.findByComic(
      user.profileId!,
      comicId,
      limit ? parseInt(limit, 10) : 20,
      offset ? parseInt(offset, 10) : 0,
    );
    return enrichEntriesWithPaths(entries, this.routeProtectionService);
  }

  @Delete('comic/:comicId')
  @ApiOperation({ summary: 'Delete all reading history entries for a comic' })
  async deleteByComic(
    @CurrentUser() user: UserSession,
    @Param('comicId', ParseIntPipe) comicId: number,
  ) {
    return this.readingHistoryService.deleteByComic(user.profileId!, comicId);
  }

  @Get('comic/:comicId/last')
  @ApiOperation({ summary: 'Get last read chapter for a comic' })
  async findLastRead(
    @CurrentUser() user: UserSession,
    @Param('comicId', ParseIntPipe) comicId: number,
  ) {
    const entry = await this.readingHistoryService.findLastRead(user.profileId!, comicId);
    return this.enrichEntry(entry);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete reading history entry' })
  async delete(
    @CurrentUser() user: UserSession,
    @Param('id') id: string,
  ) {
    await this.readingHistoryService.delete(user.profileId!, id);
    return { success: true };
  }
}
