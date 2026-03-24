import { Injectable, Logger, Inject } from '@nestjs/common';
import { profiles, user } from '../../database/schema';
import { eq } from 'drizzle-orm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DATABASE_CONNECTION } from '../../database/database.module';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(@Inject(DATABASE_CONNECTION) private readonly db: any) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handlePremiumExpiration() {
    this.logger.log('Checking for expired premium plans...');
    const now = new Date();
    const { sql } = await import('drizzle-orm');

    const expiredProfiles = await this.db
      .select({
        id: profiles.id,
        userId: profiles.userId,
      })
      .from(profiles)
      .where(
        sql`plan = 'premium' AND premium_expire_at IS NOT NULL AND premium_expire_at < ${now.toISOString()}`,
      );

    for (const profile of expiredProfiles) {
      await this.db
        .update(profiles)
        .set({
          plan: 'basic',
          premiumCycle: null,
          premiumStartedAt: null,
          premiumExpireAt: null,
          updatedAt: new Date(),
        })
        .where(eq(profiles.id, profile.id));

      await this.db
        .update(user)
        .set({
          plan: 'basic',
          premiumExpireAt: null,
          updatedAt: new Date(),
        })
        .where(eq(user.id, profile.userId));
    }

    this.logger.log('Premium plan expiration check completed.');
  }
}
