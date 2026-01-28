import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@/modules/auth/auth.guard';
import { ProfileGuard } from '@/modules/auth/profile.guard';
import { CurrentUser, UserSession } from '@/modules/auth/current-user.decorator';
import { CommentsService } from './comments.service';
import { CreateCommentDto, UpdateCommentDto } from './comments.dto';

@ApiTags('Comments')
@Controller('comments')
export class CommentsController {
  constructor(private commentsService: CommentsService) {}

  @Post()
  @UseGuards(AuthGuard, ProfileGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new comment' })
  async create(
    @CurrentUser() user: UserSession,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.create(user.profileId!, dto);
  }

  @Get('comic/:comicId')
  @ApiOperation({ summary: 'Get comments for a comic (public)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async findByComic(
    @Param('comicId', ParseIntPipe) comicId: number,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.commentsService.findByComic(
      comicId,
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Get('chapter/:chapterId')
  @ApiOperation({ summary: 'Get comments for a chapter (public)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async findByChapter(
    @Param('chapterId', ParseIntPipe) chapterId: number,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.commentsService.findByChapter(
      chapterId,
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Get('replies/:parentId')
  @ApiOperation({ summary: 'Get replies to a comment (public)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async findReplies(
    @Param('parentId', ParseUUIDPipe) parentId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.commentsService.findReplies(
      parentId,
      limit ? parseInt(limit, 10) : 20,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Get('user')
  @UseGuards(AuthGuard, ProfileGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get comments by current user' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async findByUser(
    @CurrentUser() user: UserSession,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.commentsService.findByUser(
      user.profileId!,
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Get('comic/:comicId/count')
  @ApiOperation({ summary: 'Get comments count for a comic (public)' })
  async getComicCommentsCount(
    @Param('comicId', ParseIntPipe) comicId: number,
  ) {
    const count = await this.commentsService.getComicCommentsCount(comicId);
    return { comicId, commentsCount: count };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific comment (public)' })
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.commentsService.findById(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, ProfileGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update own comment' })
  async update(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.commentsService.update(user.profileId!, id, dto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, ProfileGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete own comment' })
  async delete(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.commentsService.delete(user.profileId!, id);
    return { success: true };
  }
}
