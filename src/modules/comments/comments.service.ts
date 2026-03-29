import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNull,
} from 'drizzle-orm';
import { DATABASE_CONNECTION } from '@/database/database.module';
import {
  commentAttachments,
  comments,
  commentVotes,
} from '@/database/schema';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '@/database/schema';
import {
  CreateCommentDto,
  GetCommentsQueryDto,
  UpdateCommentDto,
} from './comments.dto';
import { MediaService } from '@/modules/media/media.service';
import { StorageService } from '@/modules/media/storage.service';

type CommentSortMode = NonNullable<GetCommentsQueryDto['sort']>;

const publicProfileColumns = {
  id: true,
  userId: true,
  username: true,
  visibleName: true,
  avatarUrl: true,
  plan: true,
  premiumExpireAt: true,
} as const;

@Injectable()
export class CommentsService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private db: NodePgDatabase<typeof schema>,
    private readonly mediaService: MediaService,
    private readonly storageService: StorageService,
  ) {}

  private buildOrderBy(sort: CommentSortMode) {
    if (sort === 'oldest') {
      return [asc(comments.createdAt)];
    }
    if (sort === 'best') {
      return [desc(comments.score), desc(comments.createdAt)];
    }
    return [desc(comments.createdAt)];
  }

  private isPremium(
    profile: { plan: 'basic' | 'premium' | null; premiumExpireAt: Date | null },
  ) {
    return (
      profile.plan === 'premium' &&
      profile.premiumExpireAt !== null &&
      profile.premiumExpireAt.getTime() > Date.now()
    );
  }

  private normalizeAttachment(
    attachment: {
      mediaAsset: {
        id: string;
        sourceType: 'uploaded' | 'external';
        mediaType: 'image' | 'gif' | 'sticker';
        storageKey: string | null;
        originalUrl: string | null;
        mimeType: string | null;
        width: number | null;
        height: number | null;
        sizeBytes: number | null;
        createdAt: Date | null;
      };
      sortOrder: number;
    },
  ) {
    const asset = attachment.mediaAsset;
    return {
      id: asset.id,
      sourceType: asset.sourceType,
      mediaType: asset.mediaType,
      mimeType: asset.mimeType,
      width: asset.width,
      height: asset.height,
      sizeBytes: asset.sizeBytes,
      sortOrder: attachment.sortOrder,
      url:
        asset.sourceType === 'uploaded' && asset.storageKey
          ? this.storageService.buildPublicUrl(asset.storageKey)
          : asset.originalUrl,
      createdAt: asset.createdAt,
    };
  }

  private async getReplyCounts(parentIds: string[]) {
    if (parentIds.length === 0) {
      return new Map<string, number>();
    }

    const rows = await this.db
      .select({
        parentId: comments.parentId,
        count: count(),
      })
      .from(comments)
      .where(inArray(comments.parentId, parentIds))
      .groupBy(comments.parentId);

    return new Map(
      rows
        .filter((row) => !!row.parentId)
        .map((row) => [row.parentId!, Number(row.count)]),
    );
  }

  private async getViewerVotes(
    commentIds: string[],
    viewerProfileId?: string | null,
  ) {
    if (!viewerProfileId || commentIds.length === 0) {
      return new Map<string, -1 | 1>();
    }

    const votes = await this.db.query.commentVotes.findMany({
      where: and(
        eq(commentVotes.profileId, viewerProfileId),
        inArray(commentVotes.commentId, commentIds),
      ),
      columns: {
        commentId: true,
        value: true,
      },
    });

    return new Map(
      votes.map((vote) => [vote.commentId, vote.value as -1 | 1]),
    );
  }

  private collectCommentIds(
    items: Array<{
      id: string;
      replies?: Array<{ id: string }>;
    }>,
  ) {
    const ids: string[] = [];
    for (const item of items) {
      ids.push(item.id);
      for (const reply of item.replies || []) {
        ids.push(reply.id);
      }
    }
    return ids;
  }

  private mapComment(
    comment: any,
    viewerVotes: Map<string, -1 | 1>,
    replyCounts: Map<string, number>,
  ) {
    const currentUserVote = viewerVotes.get(comment.id) ?? null;

    return {
      id: comment.id,
      profileId: comment.profileId,
      comicId: comment.comicId,
      chapterId: comment.chapterId,
      parentId: comment.parentId,
      content: comment.content,
      isEdited: comment.isEdited,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      profile: {
        id: comment.profile.id,
        userId: comment.profile.userId,
        username: comment.profile.username,
        visibleName: comment.profile.visibleName,
        avatarUrl: comment.profile.avatarUrl,
        isPremium: this.isPremium(comment.profile),
      },
      stats: {
        upvotesCount: comment.upvotesCount,
        downvotesCount: comment.downvotesCount,
        score: comment.score,
        currentUserVote,
      },
      attachments: (comment.attachments || [])
        .sort((first: any, second: any) => first.sortOrder - second.sortOrder)
        .map((attachment: any) => this.normalizeAttachment(attachment)),
      replies: (comment.replies || []).map((reply: any) =>
        this.mapComment(reply, viewerVotes, replyCounts),
      ),
      _count: {
        replies: replyCounts.get(comment.id) ?? comment.replies?.length ?? 0,
      },
    };
  }

  private async enrichCommentList(
    items: any[],
    viewerProfileId?: string | null,
  ) {
    const commentIds = this.collectCommentIds(items);
    const [viewerVotes, replyCounts] = await Promise.all([
      this.getViewerVotes(commentIds, viewerProfileId),
      this.getReplyCounts(items.map((item) => item.id)),
    ]);

    return items.map((item) =>
      this.mapComment(item, viewerVotes, replyCounts),
    );
  }

  async create(profileId: string, dto: CreateCommentDto) {
    if (dto.parentId) {
      const parentComment = await this.db.query.comments.findFirst({
        where: eq(comments.id, dto.parentId),
        columns: {
          id: true,
          comicId: true,
          chapterId: true,
          parentId: true,
        },
      });

      if (!parentComment) {
        throw new NotFoundException('Parent comment not found');
      }

      if (parentComment.parentId) {
        throw new BadRequestException('Nested replies are not supported');
      }

      if (
        parentComment.comicId !== dto.comicId ||
        (parentComment.chapterId ?? null) !== (dto.chapterId ?? null)
      ) {
        throw new BadRequestException('Reply target does not match this thread');
      }
    }

    const attachmentIds = Array.from(new Set(dto.attachmentIds || []));
    if (attachmentIds.length > 4) {
      throw new BadRequestException('You can attach up to 4 media items');
    }

    const normalizedContent = dto.content?.trim() || '';
    if (!normalizedContent && attachmentIds.length === 0) {
      throw new BadRequestException('Comment cannot be empty');
    }

    if (attachmentIds.length > 0) {
      await this.mediaService.getOwnedAssets(profileId, attachmentIds);
    }

    return this.db.transaction(async (tx) => {
      const [comment] = await tx
        .insert(comments)
        .values({
          profileId,
          comicId: dto.comicId,
          chapterId: dto.chapterId,
          parentId: dto.parentId,
          content: normalizedContent,
        })
        .returning();

      if (attachmentIds.length > 0) {
        await tx.insert(commentAttachments).values(
          attachmentIds.map((assetId, index) => ({
            commentId: comment.id,
            mediaAssetId: assetId,
            sortOrder: index,
          })),
        );
      }

      return this.findById(comment.id, profileId);
    });
  }

  async findById(id: string, viewerProfileId?: string | null) {
    const comment = await this.db.query.comments.findFirst({
      where: eq(comments.id, id),
      with: {
        profile: {
          columns: publicProfileColumns,
        },
        attachments: {
          orderBy: [asc(commentAttachments.sortOrder)],
          with: {
            mediaAsset: true,
          },
        },
      },
    });

    if (!comment) {
      return null;
    }

    const [viewerVotes, replyCounts] = await Promise.all([
      this.getViewerVotes([comment.id], viewerProfileId),
      this.getReplyCounts([comment.id]),
    ]);
    return this.mapComment(comment, viewerVotes, replyCounts);
  }

  async findByComic(
    comicId: number,
    query: GetCommentsQueryDto,
    viewerProfileId?: string | null,
  ) {
    const limit = Math.max(1, Number(query.limit || 20));
    const offset = Math.max(0, Number(query.offset || 0));
    const sort = (query.sort || 'best') as CommentSortMode;

    const [items, totalRows] = await Promise.all([
      this.db.query.comments.findMany({
        where: and(
          eq(comments.comicId, comicId),
          isNull(comments.chapterId),
          isNull(comments.parentId),
        ),
        orderBy: this.buildOrderBy(sort),
        limit,
        offset,
        with: {
          profile: {
            columns: publicProfileColumns,
          },
          attachments: {
            orderBy: [asc(commentAttachments.sortOrder)],
            with: {
              mediaAsset: true,
            },
          },
          replies: {
            orderBy: [desc(comments.createdAt)],
            limit: 5,
            with: {
              profile: {
                columns: publicProfileColumns,
              },
              attachments: {
                orderBy: [asc(commentAttachments.sortOrder)],
                with: {
                  mediaAsset: true,
                },
              },
            },
          },
        },
      }),
      this.db
        .select({ count: count() })
        .from(comments)
        .where(
          and(
            eq(comments.comicId, comicId),
            isNull(comments.chapterId),
            isNull(comments.parentId),
          ),
        ),
    ]);

    const total = Number(totalRows[0]?.count || 0);

    return {
      items: await this.enrichCommentList(items, viewerProfileId),
      total,
      hasMore: offset + items.length < total,
      nextOffset: offset + items.length,
    };
  }

  async findByChapter(
    chapterId: number,
    query: GetCommentsQueryDto,
    viewerProfileId?: string | null,
  ) {
    const limit = Math.max(1, Number(query.limit || 20));
    const offset = Math.max(0, Number(query.offset || 0));
    const sort = (query.sort || 'best') as CommentSortMode;

    const [items, totalRows] = await Promise.all([
      this.db.query.comments.findMany({
        where: and(eq(comments.chapterId, chapterId), isNull(comments.parentId)),
        orderBy: this.buildOrderBy(sort),
        limit,
        offset,
        with: {
          profile: {
            columns: publicProfileColumns,
          },
          attachments: {
            orderBy: [asc(commentAttachments.sortOrder)],
            with: {
              mediaAsset: true,
            },
          },
          replies: {
            orderBy: [desc(comments.createdAt)],
            limit: 5,
            with: {
              profile: {
                columns: publicProfileColumns,
              },
              attachments: {
                orderBy: [asc(commentAttachments.sortOrder)],
                with: {
                  mediaAsset: true,
                },
              },
            },
          },
        },
      }),
      this.db
        .select({ count: count() })
        .from(comments)
        .where(and(eq(comments.chapterId, chapterId), isNull(comments.parentId))),
    ]);

    const total = Number(totalRows[0]?.count || 0);

    return {
      items: await this.enrichCommentList(items, viewerProfileId),
      total,
      hasMore: offset + items.length < total,
      nextOffset: offset + items.length,
    };
  }

  async findReplies(
    parentId: string,
    query: GetCommentsQueryDto,
    viewerProfileId?: string | null,
  ) {
    const limit = Math.max(1, Number(query.limit || 10));
    const offset = Math.max(0, Number(query.offset || 0));
    const sort = (query.sort || 'newest') as CommentSortMode;

    const [items, totalRows] = await Promise.all([
      this.db.query.comments.findMany({
        where: eq(comments.parentId, parentId),
        orderBy: this.buildOrderBy(sort),
        limit,
        offset,
        with: {
          profile: {
            columns: publicProfileColumns,
          },
          attachments: {
            orderBy: [asc(commentAttachments.sortOrder)],
            with: {
              mediaAsset: true,
            },
          },
        },
      }),
      this.db
        .select({ count: count() })
        .from(comments)
        .where(eq(comments.parentId, parentId)),
    ]);

    const viewerVotes = await this.getViewerVotes(
      items.map((item) => item.id),
      viewerProfileId,
    );

    const total = Number(totalRows[0]?.count || 0);

    return {
      items: items.map((item) => this.mapComment(item, viewerVotes, new Map())),
      total,
      hasMore: offset + items.length < total,
      nextOffset: offset + items.length,
    };
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
    const comment = await this.db.query.comments.findFirst({
      where: eq(comments.id, commentId),
      columns: {
        id: true,
        profileId: true,
      },
    });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.profileId !== profileId) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    const [updated] = await this.db
      .update(comments)
      .set({
        content: dto.content.trim(),
        isEdited: true,
        updatedAt: new Date(),
      })
      .where(eq(comments.id, commentId))
      .returning();

    return this.findById(updated.id, profileId);
  }

  async delete(profileId: string, commentId: string) {
    const comment = await this.db.query.comments.findFirst({
      where: eq(comments.id, commentId),
      columns: {
        id: true,
        profileId: true,
      },
    });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.profileId !== profileId) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    await this.db.transaction(async (tx) => {
      const replies = await tx.query.comments.findMany({
        where: eq(comments.parentId, commentId),
        columns: { id: true },
      });

      if (replies.length > 0) {
        const replyIds = replies.map((reply) => reply.id);
        await tx
          .delete(commentAttachments)
          .where(inArray(commentAttachments.commentId, replyIds));
        await tx
          .delete(commentVotes)
          .where(inArray(commentVotes.commentId, replyIds));
        await tx.delete(comments).where(inArray(comments.id, replyIds));
      }

      await tx.delete(commentAttachments).where(eq(commentAttachments.commentId, commentId));
      await tx.delete(commentVotes).where(eq(commentVotes.commentId, commentId));
      await tx.delete(comments).where(eq(comments.id, commentId));
    });
  }

  async vote(
    profileId: string,
    commentId: string,
    direction: 'up' | 'down',
  ) {
    return this.db.transaction(async (tx) => {
      const comment = await tx.query.comments.findFirst({
        where: eq(comments.id, commentId),
      });
      if (!comment) {
        throw new NotFoundException('Comment not found');
      }

      const nextValue = direction === 'up' ? 1 : -1;
      const existingVote = await tx.query.commentVotes.findFirst({
        where: and(
          eq(commentVotes.commentId, commentId),
          eq(commentVotes.profileId, profileId),
        ),
      });

      let delta = 0;
      let upvotesCount = comment.upvotesCount;
      let downvotesCount = comment.downvotesCount;
      let currentUserVote: -1 | 1 | null = null;

      if (existingVote?.value === nextValue) {
        await tx.delete(commentVotes).where(eq(commentVotes.id, existingVote.id));
        delta = -existingVote.value;
        if (existingVote.value === 1) upvotesCount -= 1;
        else downvotesCount -= 1;
      } else if (existingVote) {
        await tx
          .update(commentVotes)
          .set({ value: nextValue, updatedAt: new Date() })
          .where(eq(commentVotes.id, existingVote.id));
        delta = nextValue - existingVote.value;
        if (existingVote.value === 1) upvotesCount -= 1;
        else downvotesCount -= 1;
        if (nextValue === 1) upvotesCount += 1;
        else downvotesCount += 1;
        currentUserVote = nextValue as -1 | 1;
      } else {
        await tx.insert(commentVotes).values({
          commentId,
          profileId,
          value: nextValue,
        });
        delta = nextValue;
        if (nextValue === 1) upvotesCount += 1;
        else downvotesCount += 1;
        currentUserVote = nextValue as -1 | 1;
      }

      const nextScore = comment.score + delta;

      await tx
        .update(comments)
        .set({
          upvotesCount,
          downvotesCount,
          score: nextScore,
          updatedAt: new Date(),
        })
        .where(eq(comments.id, commentId));

      return {
        commentId,
        stats: {
          upvotesCount,
          downvotesCount,
          score: nextScore,
          currentUserVote,
        },
      };
    });
  }

  async getComicCommentsCount(comicId: number): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(comments)
      .where(
        and(
          eq(comments.comicId, comicId),
          isNull(comments.chapterId),
          isNull(comments.parentId),
        ),
      );
    return Number(result[0]?.count ?? 0);
  }

  async getUserCommentsCount(profileId: string): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(comments)
      .where(eq(comments.profileId, profileId));
    return Number(result[0]?.count ?? 0);
  }
}
