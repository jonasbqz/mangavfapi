import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { eq, and, desc, isNull, count } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '@/database/database.module';
import { comments } from '@/database/schema';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '@/database/schema';
import { CreateCommentDto, UpdateCommentDto } from './comments.dto';

const publicProfileColumns = {
  id: true,
  username: true,
  visibleName: true,
  avatarUrl: true,
} as const;

@Injectable()
export class CommentsService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private db: NodePgDatabase<typeof schema>,
  ) {}

  async create(profileId: string, dto: CreateCommentDto) {
    const [comment] = await this.db.insert(comments).values({
      profileId,
      comicId: dto.comicId,
      chapterId: dto.chapterId,
      parentId: dto.parentId,
      content: dto.content,
    }).returning();

    return this.findById(comment.id);
  }

  async findById(id: string) {
    return this.db.query.comments.findFirst({
      where: eq(comments.id, id),
      with: {
        profile: {
          columns: publicProfileColumns,
        },
      },
    });
  }

  async findByComic(comicId: number, limit = 50, offset = 0) {
    // Get top-level comments (no parent)
    const topLevelComments = await this.db.query.comments.findMany({
      where: and(
        eq(comments.comicId, comicId),
        isNull(comments.chapterId),
        isNull(comments.parentId),
      ),
      orderBy: [desc(comments.createdAt)],
      limit,
      offset,
      with: {
        profile: {
          columns: publicProfileColumns,
        },
        replies: {
          orderBy: [desc(comments.createdAt)],
          limit: 5,
          with: {
            profile: {
              columns: publicProfileColumns,
            },
          },
        },
      },
    });

    return topLevelComments;
  }

  async findByChapter(chapterId: number, limit = 50, offset = 0) {
    const chapterComments = await this.db.query.comments.findMany({
      where: and(
        eq(comments.chapterId, chapterId),
        isNull(comments.parentId),
      ),
      orderBy: [desc(comments.createdAt)],
      limit,
      offset,
      with: {
        profile: {
          columns: publicProfileColumns,
        },
        replies: {
          orderBy: [desc(comments.createdAt)],
          limit: 5,
          with: {
            profile: {
              columns: publicProfileColumns,
            },
          },
        },
      },
    });

    return chapterComments;
  }

  async findReplies(parentId: string, limit = 20, offset = 0) {
    return this.db.query.comments.findMany({
      where: eq(comments.parentId, parentId),
      orderBy: [desc(comments.createdAt)],
      limit,
      offset,
      with: {
        profile: {
          columns: publicProfileColumns,
        },
      },
    });
  }

  async findByUser(profileId: string, limit = 50, offset = 0) {
    return this.db.query.comments.findMany({
      where: eq(comments.profileId, profileId),
      orderBy: [desc(comments.createdAt)],
      limit,
      offset,
      with: {
        comic: {
          columns: {
            id: true,
            title: true,
            slug: true,
            coverImage: true,
          },
        },
      },
    });
  }

  async update(profileId: string, commentId: string, dto: UpdateCommentDto) {
    const comment = await this.findById(commentId);
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.profileId !== profileId) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    const [updated] = await this.db
      .update(comments)
      .set({
        content: dto.content,
        isEdited: true,
        updatedAt: new Date(),
      })
      .where(eq(comments.id, commentId))
      .returning();

    return this.findById(updated.id);
  }

  async delete(profileId: string, commentId: string) {
    const comment = await this.findById(commentId);
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.profileId !== profileId) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    await this.db.delete(comments).where(eq(comments.id, commentId));
  }

  async getComicCommentsCount(comicId: number): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(comments)
      .where(eq(comments.comicId, comicId));
    return result[0]?.count ?? 0;
  }

  async getUserCommentsCount(profileId: string): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(comments)
      .where(eq(comments.profileId, profileId));
    return result[0]?.count ?? 0;
  }
}
