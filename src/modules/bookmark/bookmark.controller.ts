import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  NotFoundException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@/modules/auth/auth.guard';
import { ProfileGuard } from '@/modules/auth/profile.guard';
import { CurrentUser, UserSession } from '@/modules/auth/current-user.decorator';
import { enrichBookmarksWithPaths } from '@/lib/enrich-paths';
import { BookmarkService } from './bookmark.service';
import { CreateBookmarkDto, UpdateBookmarkDto } from './bookmark.dto';
import { RouteProtectionService } from '@/modules/route-protection/route-protection.service';

@ApiTags('Bookmarks')
@Controller('bookmarks')
@UseGuards(AuthGuard, ProfileGuard)
@ApiBearerAuth()
export class BookmarkController {
  constructor(
    private bookmarkService: BookmarkService,
    private routeProtectionService: RouteProtectionService,
  ) {}

  private async enrichBookmark(bookmark: any): Promise<any> {
    if (!bookmark?.comic) {
      return bookmark;
    }

    const [enriched] = await enrichBookmarksWithPaths([bookmark], this.routeProtectionService);
    return enriched;
  }

  @Post()
  @ApiOperation({ summary: 'Create or update bookmark' })
  async upsert(
    @CurrentUser() user: UserSession,
    @Body() dto: CreateBookmarkDto,
  ) {
    const bookmark = await this.bookmarkService.upsert(user.profileId!, dto);
    return this.enrichBookmark(bookmark);
  }

  @Get()
  @ApiOperation({ summary: 'Get all bookmarks' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async findAll(
    @CurrentUser() user: UserSession,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const bookmarks = await this.bookmarkService.findAll(
      user.profileId!,
      limit ? parseInt(limit, 10) : undefined,
      offset ? parseInt(offset, 10) : undefined,
    );
    return enrichBookmarksWithPaths(bookmarks, this.routeProtectionService);
  }

  @Get('favorites')
  @ApiOperation({ summary: 'Get favorite bookmarks' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async findFavorites(
    @CurrentUser() user: UserSession,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const bookmarks = await this.bookmarkService.findFavorites(
      user.profileId!,
      limit ? parseInt(limit, 10) : undefined,
      offset ? parseInt(offset, 10) : undefined,
    );
    return enrichBookmarksWithPaths(bookmarks, this.routeProtectionService);
  }

  @Get('status/:status')
  @ApiOperation({ summary: 'Get bookmarks by status' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async findByStatus(
    @CurrentUser() user: UserSession,
    @Param('status') status: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const bookmarks = await this.bookmarkService.findByStatus(
      user.profileId!,
      status,
      limit ? parseInt(limit, 10) : undefined,
      offset ? parseInt(offset, 10) : undefined,
    );
    return enrichBookmarksWithPaths(bookmarks, this.routeProtectionService);
  }

  @Get(':comicId')
  @ApiOperation({ summary: 'Get bookmark for a comic' })
  async findOne(
    @CurrentUser() user: UserSession,
    @Param('comicId', ParseIntPipe) comicId: number,
  ) {
    const bookmark = await this.bookmarkService.findOne(user.profileId!, comicId);
    if (!bookmark) {
      throw new NotFoundException('Bookmark not found');
    }
    return this.enrichBookmark(bookmark);
  }

  @Put(':comicId')
  @ApiOperation({ summary: 'Update bookmark' })
  async update(
    @CurrentUser() user: UserSession,
    @Param('comicId', ParseIntPipe) comicId: number,
    @Body() dto: UpdateBookmarkDto,
  ) {
    const bookmark = await this.bookmarkService.update(user.profileId!, comicId, dto);
    return this.enrichBookmark(bookmark);
  }

  @Delete(':comicId')
  @ApiOperation({ summary: 'Delete bookmark' })
  async delete(
    @CurrentUser() user: UserSession,
    @Param('comicId', ParseIntPipe) comicId: number,
  ) {
    await this.bookmarkService.delete(user.profileId!, comicId);
    return { success: true };
  }
}
