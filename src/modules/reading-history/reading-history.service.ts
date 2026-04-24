import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, desc, sql } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '@/database/database.module';
import { readingHistory } from '@/database/schema';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '@/database/schema';
import { RecordReadingDto } from './reading-history.dto';

@Injectable()
export class ReadingHistoryService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private db: NodePgDatabase<typeof schema>,
  ) {}

  async record(profileId: string, dto: RecordReadingDto) {
    const existing = await this.db.query.readingHistory.findFirst({
      where: and(
        eq(readingHistory.profileId, profileId),
        eq(readingHistory.comicId, dto.comicId),
        eq(readingHistory.chapterId, dto.chapterId),
      ),
    });

    if (existing) {
      const [updated] = await this.db
        .update(readingHistory)
        .set({
          progressPercentage: dto.progressPercentage ?? existing.progressPercentage,
          readAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(readingHistory.id, existing.id))
        .returning();
      return updated;
    }

    const [entry] = await this.db.insert(readingHistory).values({
      profileId,
      comicId: dto.comicId,
      chapterId: dto.chapterId,
      progressPercentage: dto.progressPercentage || 0,
      readAt: new Date(),
    }).returning();

    return entry;
  }

  async findAll(profileId: string, limit = 50, offset = 0) {
    const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 50) : 50;
    const safeOffset = Number.isFinite(offset) ? Math.max(offset, 0) : 0;

    return this.db.query.readingHistory.findMany({
      where: eq(readingHistory.profileId, profileId),
      orderBy: [desc(readingHistory.readAt)],
      limit: safeLimit,
      offset: safeOffset,
      with: {
        comic: true,
        chapter: true,
      },
    });
  }

  async findRecent(profileId: string, limit = 10, offset = 0) {
    const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 50) : 10;
    const safeOffset = Number.isFinite(offset) ? Math.max(offset, 0) : 0;

    return this.db.query.readingHistory.findMany({
      where: eq(readingHistory.profileId, profileId),
      orderBy: [desc(readingHistory.readAt)],
      limit: safeLimit,
      offset: safeOffset,
      with: {
        comic: true,
        chapter: true,
      },
    });
  }

  async findGroupedByComic(
    profileId: string,
    limit = 20,
    offset = 0,
    chaptersLimit = 4,
  ) {
    const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 50) : 20;
    const safeOffset = Number.isFinite(offset) ? Math.max(offset, 0) : 0;
    const safeChaptersLimit = Number.isFinite(chaptersLimit)
      ? Math.min(Math.max(chaptersLimit, 1), 4)
      : 4;
    const lastReadAt = sql<Date>`max(${readingHistory.readAt})`;

    const groupedComics = await this.db
      .select({
        comicId: readingHistory.comicId,
        lastReadAt,
      })
      .from(readingHistory)
      .where(eq(readingHistory.profileId, profileId))
      .groupBy(readingHistory.comicId)
      .orderBy(desc(lastReadAt))
      .limit(safeLimit + 1)
      .offset(safeOffset);

    const pageComics = groupedComics.slice(0, safeLimit);

    const items = await Promise.all(
      pageComics.map(async (comicHistory) => {
        const entries = await this.db.query.readingHistory.findMany({
          where: and(
            eq(readingHistory.profileId, profileId),
            eq(readingHistory.comicId, comicHistory.comicId),
          ),
          orderBy: [desc(readingHistory.readAt)],
          limit: safeChaptersLimit,
          with: {
            comic: true,
            chapter: true,
          },
        });

        return {
          comicId: comicHistory.comicId,
          lastReadAt: comicHistory.lastReadAt,
          entries,
        };
      }),
    );

    return {
      items,
      hasMore: groupedComics.length > safeLimit,
      nextOffset: safeOffset + pageComics.length,
    };
  }

  async findByComic(profileId: string, comicId: number) {
    return this.db.query.readingHistory.findMany({
      where: and(
        eq(readingHistory.profileId, profileId),
        eq(readingHistory.comicId, comicId),
      ),
      orderBy: [desc(readingHistory.readAt)],
      with: {
        comic: true,
        chapter: true,
      },
    });
  }

  async findLastRead(profileId: string, comicId: number) {
    return this.db.query.readingHistory.findFirst({
      where: and(
        eq(readingHistory.profileId, profileId),
        eq(readingHistory.comicId, comicId),
      ),
      orderBy: [desc(readingHistory.readAt)],
      with: {
        comic: true,
        chapter: true,
      },
    });
  }

  async delete(profileId: string, id: string) {
    const existing = await this.db.query.readingHistory.findFirst({
      where: and(
        eq(readingHistory.id, id),
        eq(readingHistory.profileId, profileId),
      ),
    });

    if (!existing) {
      throw new NotFoundException('Reading history entry not found');
    }

    await this.db.delete(readingHistory).where(eq(readingHistory.id, id));
  }
}
