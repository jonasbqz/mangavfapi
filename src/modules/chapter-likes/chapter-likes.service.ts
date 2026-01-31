import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc, count, sql } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '@/database/database.module';
import { chapterLikes, chapters } from '@/database/schema';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '@/database/schema';
import { CacheService, CACHE_TTL, CACHE_KEYS } from '@/cache/cache.service';

@Injectable()
export class ChapterLikesService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private db: NodePgDatabase<typeof schema>,
    private cacheService: CacheService,
  ) {}

  async toggle(profileId: string, chapterId: number): Promise<{ liked: boolean; likesCount: number }> {
    const existing = await this.db.query.chapterLikes.findFirst({
      where: and(
        eq(chapterLikes.profileId, profileId),
        eq(chapterLikes.chapterId, chapterId),
      ),
    });

    if (existing) {
      // Remove like
      await this.db.delete(chapterLikes).where(eq(chapterLikes.id, existing.id));

      // Decrement likes count in chapters table
      await this.db
        .update(chapters)
        .set({ likes: sql`${chapters.likes} - 1` })
        .where(eq(chapters.id, chapterId));

      // Invalidate cache
      await this.invalidateLikesCache(chapterId);

      const likesCount = await this.getChapterLikesCountFromDb(chapterId);
      return { liked: false, likesCount };
    }

    // Add like
    await this.db.insert(chapterLikes).values({
      profileId,
      chapterId,
    });

    // Increment likes count in chapters table
    await this.db
      .update(chapters)
      .set({ likes: sql`${chapters.likes} + 1` })
      .where(eq(chapters.id, chapterId));

    // Invalidate cache
    await this.invalidateLikesCache(chapterId);

    const likesCount = await this.getChapterLikesCountFromDb(chapterId);
    return { liked: true, likesCount };
  }

  async checkLike(profileId: string, chapterId: number): Promise<boolean> {
    const existing = await this.db.query.chapterLikes.findFirst({
      where: and(
        eq(chapterLikes.profileId, profileId),
        eq(chapterLikes.chapterId, chapterId),
      ),
    });
    return !!existing;
  }

  async getChapterLikesCount(chapterId: number): Promise<number> {
    const cacheKey = `${CACHE_KEYS.CHAPTER_LIKES_COUNT}:${chapterId}`;

    return this.cacheService.wrap(
      cacheKey,
      () => this.getChapterLikesCountFromDb(chapterId),
      CACHE_TTL.VERY_SHORT, // 5 minutes
    );
  }

  private async getChapterLikesCountFromDb(chapterId: number): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(chapterLikes)
      .where(eq(chapterLikes.chapterId, chapterId));
    return result[0]?.count ?? 0;
  }

  private async invalidateLikesCache(chapterId: number): Promise<void> {
    await this.cacheService.del(`${CACHE_KEYS.CHAPTER_LIKES_COUNT}:${chapterId}`);
  }

  async getUserChapterLikes(profileId: string) {
    return this.db.query.chapterLikes.findMany({
      where: eq(chapterLikes.profileId, profileId),
      orderBy: [desc(chapterLikes.createdAt)],
      with: {
        chapter: true,
      },
    });
  }

  async getUserChapterLikesCount(profileId: string): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(chapterLikes)
      .where(eq(chapterLikes.profileId, profileId));
    return result[0]?.count ?? 0;
  }
}
