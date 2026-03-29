import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, count, desc, eq, inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '@/database/schema';
import { DATABASE_CONNECTION } from '@/database/database.module';
import {
  commentAttachments,
  mediaAssets,
} from '@/database/schema';
import { StorageService } from './storage.service';
import {
  CreateUploadSessionDto,
  RegisterExternalMediaDto,
} from './media.dto';
import { SubscriptionsService } from '@/modules/subscriptions/subscriptions.service';

@Injectable()
export class MediaService {
  private static readonly FREE_GALLERY_LIMIT = 2;
  private static readonly PREMIUM_GALLERY_LIMIT = 20;

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly storageService: StorageService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  private isAllowedMimeType(mimeType?: string | null) {
    if (!mimeType) return true;
    return ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(
      mimeType.toLowerCase(),
    );
  }

  private normalizeAsset(asset: typeof mediaAssets.$inferSelect) {
    return {
      id: asset.id,
      sourceType: asset.sourceType,
      mediaType: asset.mediaType,
      mimeType: asset.mimeType,
      width: asset.width,
      height: asset.height,
      sizeBytes: asset.sizeBytes,
      originalUrl:
        asset.sourceType === 'uploaded' && asset.storageKey
          ? this.storageService.buildPublicUrl(asset.storageKey)
          : asset.originalUrl,
      storageKey: asset.storageKey,
      createdAt: asset.createdAt,
    };
  }

  private async assertPremiumUploadAccess(profileId: string) {
    const { isPremium } = await this.getGalleryPolicy(profileId);

    if (!isPremium) {
      throw new ForbiddenException(
        'Only users with active premium can upload files',
      );
    }
  }

  private async getGalleryPolicy(profileId: string) {
    const summary =
      await this.subscriptionsService.getProfileSubscriptionSummary(profileId);
    const currentPeriodEnd = summary.currentPeriodEnd
      ? new Date(summary.currentPeriodEnd)
      : null;
    const isPremium =
      summary.plan === 'premium' &&
      !!currentPeriodEnd &&
      Number.isFinite(currentPeriodEnd.getTime()) &&
      currentPeriodEnd.getTime() > Date.now() &&
      ['active', 'canceling', 'past_due'].includes(summary.status);

    return {
      isPremium,
      maxAssets: isPremium
        ? MediaService.PREMIUM_GALLERY_LIMIT
        : MediaService.FREE_GALLERY_LIMIT,
    };
  }

  private async assertGalleryCapacity(profileId: string, maxAssets: number) {
    const result = await this.db
      .select({ count: count() })
      .from(mediaAssets)
      .where(eq(mediaAssets.profileId, profileId));

    const currentCount = Number(result[0]?.count ?? 0);
    if (currentCount >= maxAssets) {
      throw new BadRequestException(
        `Gallery limit reached. Max allowed assets: ${maxAssets}`,
      );
    }
  }

  async listGallery(profileId: string) {
    const policy = await this.getGalleryPolicy(profileId);
    const items = await this.db.query.mediaAssets.findMany({
      where: eq(mediaAssets.profileId, profileId),
      orderBy: [desc(mediaAssets.createdAt)],
    });

    return {
      items: items.map((item) => this.normalizeAsset(item)),
      maxAssets: policy.maxAssets,
      canUpload: policy.isPremium,
    };
  }

  async registerExternal(profileId: string, dto: RegisterExternalMediaDto) {
    const policy = await this.getGalleryPolicy(profileId);
    await this.assertGalleryCapacity(profileId, policy.maxAssets);

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(dto.originalUrl);
    } catch {
      throw new BadRequestException('Invalid media URL');
    }

    if (parsedUrl.protocol !== 'https:') {
      throw new BadRequestException('Only HTTPS URLs are allowed');
    }

    const [asset] = await this.db
      .insert(mediaAssets)
      .values({
        profileId,
        sourceType: 'external',
        mediaType: dto.mediaType,
        originalUrl: dto.originalUrl,
        width: dto.width,
        height: dto.height,
      })
      .returning();

    return this.normalizeAsset(asset);
  }

  async createUploadSession(profileId: string, dto: CreateUploadSessionDto) {
    await this.assertPremiumUploadAccess(profileId);
    const policy = await this.getGalleryPolicy(profileId);
    await this.assertGalleryCapacity(profileId, policy.maxAssets);

    if (!this.isAllowedMimeType(dto.mimeType)) {
      throw new BadRequestException('Unsupported file type');
    }

    const storageKey = this.storageService.createStorageKey(
      profileId,
      dto.fileName,
    );
    const uploadUrl = this.storageService.createUploadUrl(storageKey);

    const [asset] = await this.db
      .insert(mediaAssets)
      .values({
        profileId,
        sourceType: 'uploaded',
        mediaType: dto.mediaType,
        storageProvider:
          (process.env.STORAGE_PROVIDER as 's3' | 'r2' | undefined) || 's3',
        storageKey,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
        width: dto.width,
        height: dto.height,
      })
      .returning();

    return {
      uploadUrl,
      asset: this.normalizeAsset(asset),
    };
  }

  async deleteAsset(profileId: string, assetId: string) {
    const asset = await this.db.query.mediaAssets.findFirst({
      where: and(
        eq(mediaAssets.id, assetId),
        eq(mediaAssets.profileId, profileId),
      ),
    });

    if (!asset) {
      throw new NotFoundException('Media asset not found');
    }

    const attachment = await this.db.query.commentAttachments.findFirst({
      where: eq(commentAttachments.mediaAssetId, assetId),
      columns: { id: true },
    });

    if (attachment) {
      throw new ConflictException(
        'Cannot delete a media asset that is attached to a comment',
      );
    }

    if (asset.sourceType === 'uploaded' && asset.storageKey) {
      await this.storageService.deleteObject(asset.storageKey);
    }

    await this.db.delete(mediaAssets).where(eq(mediaAssets.id, assetId));

    return { success: true };
  }

  async getOwnedAssets(profileId: string, assetIds: string[]) {
    if (assetIds.length === 0) {
      return [];
    }

    const items = await this.db.query.mediaAssets.findMany({
      where: and(
        eq(mediaAssets.profileId, profileId),
        inArray(mediaAssets.id, assetIds),
      ),
    });

    if (items.length !== assetIds.length) {
      throw new ForbiddenException('One or more media assets are not available');
    }

    return items;
  }
}
