import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  NotFoundException,
} from '@nestjs/common';
import { ApiOperation, ApiTags, ApiQuery } from '@nestjs/swagger';
import { ComicService, ComicFilters } from './comic.service';

@ApiTags('Comics')
@Controller('comics')
export class ComicController {
  constructor(private comicService: ComicService) {}

  @Get()
  @ApiOperation({ summary: 'Get all comics with filters' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'type', required: false, enum: ['manga', 'manhwa', 'manhua'] })
  @ApiQuery({ name: 'status', required: false, enum: ['ongoing', 'completed', 'hiatus', 'cancelled'] })
  @ApiQuery({ name: 'genres', required: false, description: 'Comma-separated genre names' })
  @ApiQuery({ name: 'nsfw', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'orderBy', required: false, enum: ['created_at', 'views', 'updated_at'] })
  @ApiQuery({ name: 'isDesc', required: false, type: Boolean })
  async findAll(
    @Query('search') search?: string,
    @Query('type') type?: 'manga' | 'manhwa' | 'manhua',
    @Query('status') status?: 'ongoing' | 'completed' | 'hiatus' | 'cancelled',
    @Query('genres') genres?: string,
    @Query('nsfw') nsfw?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('orderBy') orderBy?: string,
    @Query('isDesc') isDesc?: string,
  ) {
    const filters: ComicFilters = {
      search,
      type,
      status,
      genreNames: genres ? genres.split(',').map(g => g.trim()).filter(Boolean) : undefined,
      isNsfw: nsfw === 'false' ? false : nsfw === 'true' ? true : undefined,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      orderBy: (orderBy as 'created_at' | 'views' | 'updated_at') || 'updated_at',
      isDesc: isDesc !== 'false',
    };

    return this.comicService.findAll(filters);
  }

  @Get('trending')
  @ApiOperation({ summary: 'Get trending comics' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'nsfw', required: false, type: Boolean, description: 'Filter NSFW content' })
  async getTrending(
    @Query('limit') limit?: string,
    @Query('nsfw') nsfw?: string,
  ) {
    const isNsfw = nsfw === 'false' ? false : nsfw === 'true' ? true : undefined;
    return this.comicService.getTrending(limit ? parseInt(limit, 10) : 10, isNsfw);
  }

  @Get('recent')
  @ApiOperation({ summary: 'Get recently updated comics' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'nsfw', required: false, type: Boolean, description: 'Filter NSFW content' })
  async getRecent(
    @Query('limit') limit?: string,
    @Query('nsfw') nsfw?: string,
  ) {
    const isNsfw = nsfw === 'false' ? false : nsfw === 'true' ? true : undefined;
    return this.comicService.getRecent(limit ? parseInt(limit, 10) : 10, isNsfw);
  }

  @Get('recent-chapters')
  @ApiOperation({ summary: 'Get comics with recent chapters for home page' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'nsfw', required: false, type: Boolean, description: 'Filter NSFW content' })
  async getRecentWithChapters(
    @Query('limit') limit?: string,
    @Query('nsfw') nsfw?: string,
  ) {
    const isNsfw = nsfw === 'false' ? false : nsfw === 'true' ? true : undefined;
    return this.comicService.getRecentWithChapters(limit ? parseInt(limit, 10) : 20, isNsfw);
  }

  @Get('genres')
  @ApiOperation({ summary: 'Get all genres' })
  @ApiQuery({ name: 'nsfw', required: false, type: Boolean, description: 'Include adult genres' })
  async getGenres(@Query('nsfw') nsfw?: string) {
    const includeAdult = nsfw === 'true';
    return this.comicService.getAllGenres(includeAdult);
  }

  @Get('popular')
  @ApiOperation({ summary: 'Get popular comics' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'nsfw', required: false, type: Boolean, description: 'Filter NSFW content' })
  async getPopular(
    @Query('limit') limit?: string,
    @Query('nsfw') nsfw?: string,
  ) {
    const isNsfw = nsfw === 'false' ? false : nsfw === 'true' ? true : undefined;
    return this.comicService.getPopular(limit ? parseInt(limit, 10) : 10, isNsfw);
  }

  @Get(':id/recommendations')
  @ApiOperation({ summary: 'Get comic recommendations based on genres' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'nsfw', required: false, type: Boolean, description: 'Filter NSFW content' })
  async getRecommendations(
    @Param('id', ParseIntPipe) id: number,
    @Query('limit') limit?: string,
    @Query('nsfw') nsfw?: string,
  ) {
    const isNsfw = nsfw === 'false' ? false : nsfw === 'true' ? true : undefined;
    return this.comicService.getRecommendations(id, limit ? parseInt(limit, 10) : 10, isNsfw);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get comic by ID' })
  async findById(@Param('id', ParseIntPipe) id: number) {
    await this.comicService.incrementViews(id);
    return this.comicService.findById(id);
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get comic by slug' })
  async findBySlug(@Param('slug') slug: string) {
    const comic = await this.comicService.findBySlug(slug);
    await this.comicService.incrementViews(comic.id);
    return comic;
  }
}
