import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '@/database/database.module';
import { bookmarks } from '@/database/schema';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '@/database/schema';
import { BOOKMARK_COMIC_RELATIONS } from '@/lib/list-relations';
import { CreateBookmarkDto, UpdateBookmarkDto } from './bookmark.dto';

const DEFAULT_BOOKMARK_LIMIT = 100;
const MAX_BOOKMARK_LIMIT = 100;

@Injectable()
export class BookmarkService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private db: NodePgDatabase<typeof schema>,
  ) {}

  private resolveLimit(limit?: number) {
    return Number.isFinite(limit)
      ? Math.min(Math.max(limit as number, 1), MAX_BOOKMARK_LIMIT)
      : DEFAULT_BOOKMARK_LIMIT;
  }

  private resolveOffset(offset?: number) {
    return Number.isFinite(offset) ? Math.max(offset as number, 0) : 0;
  }

  async upsert(profileId: string, dto: CreateBookmarkDto) {
    const existing = await this.db.query.bookmarks.findFirst({
      where: and(
        eq(bookmarks.profileId, profileId),
        eq(bookmarks.comicId, dto.comicId),
      ),
    });

    if (existing) {
      const [updated] = await this.db
        .update(bookmarks)
        .set({
          status: dto.status,
          isFavorite: dto.isFavorite ?? existing.isFavorite,
          updatedAt: new Date(),
        })
        .where(eq(bookmarks.id, existing.id))
        .returning();
      return updated;
    }

    const [bookmark] = await this.db.insert(bookmarks).values({
      profileId,
      comicId: dto.comicId,
      status: dto.status || 'plan_to_read',
      isFavorite: dto.isFavorite || false,
    }).returning();

    return bookmark;
  }

  async findAll(profileId: string, limit?: number, offset?: number) {
    return this.db.query.bookmarks.findMany({
      where: eq(bookmarks.profileId, profileId),
      orderBy: [desc(bookmarks.updatedAt)],
      limit: this.resolveLimit(limit),
      offset: this.resolveOffset(offset),
      with: BOOKMARK_COMIC_RELATIONS,
    });
  }

  async findByStatus(profileId: string, status: string, limit?: number, offset?: number) {
    return this.db.query.bookmarks.findMany({
      where: and(
        eq(bookmarks.profileId, profileId),
        eq(bookmarks.status, status as any),
      ),
      orderBy: [desc(bookmarks.updatedAt)],
      limit: this.resolveLimit(limit),
      offset: this.resolveOffset(offset),
      with: BOOKMARK_COMIC_RELATIONS,
    });
  }

  async findFavorites(profileId: string, limit?: number, offset?: number) {
    return this.db.query.bookmarks.findMany({
      where: and(
        eq(bookmarks.profileId, profileId),
        eq(bookmarks.isFavorite, true),
      ),
      orderBy: [desc(bookmarks.updatedAt)],
      limit: this.resolveLimit(limit),
      offset: this.resolveOffset(offset),
      with: BOOKMARK_COMIC_RELATIONS,
    });
  }

  async findOne(profileId: string, comicId: number) {
    return this.db.query.bookmarks.findFirst({
      where: and(
        eq(bookmarks.profileId, profileId),
        eq(bookmarks.comicId, comicId),
      ),
      with: BOOKMARK_COMIC_RELATIONS,
    });
  }

  async update(profileId: string, comicId: number, dto: UpdateBookmarkDto) {
    const existing = await this.findOne(profileId, comicId);
    if (!existing) {
      throw new NotFoundException('Bookmark not found');
    }

    const [updated] = await this.db
      .update(bookmarks)
      .set({
        ...dto,
        updatedAt: new Date(),
      })
      .where(eq(bookmarks.id, existing.id))
      .returning();

    return updated;
  }

  async delete(profileId: string, comicId: number) {
    const existing = await this.findOne(profileId, comicId);
    if (!existing) {
      throw new NotFoundException('Bookmark not found');
    }

    await this.db.delete(bookmarks).where(eq(bookmarks.id, existing.id));
  }
}
