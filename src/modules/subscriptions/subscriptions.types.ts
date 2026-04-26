import { profiles } from '@/database/schema';

export type PremiumCycle = '1w' | '1m' | '3m' | '6m';
export type SubscriptionPlan = 'basic' | 'premium';
export type SubscriptionPaymentMethod = 'stripe' | 'other' | null;
export type PremiumSource = 'stripe' | 'manual' | null;
export type SubscriptionStatus =
  | 'active'
  | 'canceling'
  | 'expired'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'basic';
export type RefundRequestStatus = 'pending' | 'reviewing' | 'approved' | 'rejected';

export interface SubscriptionSummary {
  provider: 'stripe' | 'manual' | 'legacy';
  paymentMethod: SubscriptionPaymentMethod;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  cycle: PremiumCycle | null;
  startedAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  productName: string | null;
  priceLabel: string | null;
  stripeSubscriptionId: string | null;
}

export interface PremiumRefundRequest {
  id: string;
  profileId: string;
  userId: string;
  username: string | null;
  visibleName: string | null;
  email: string | null;
  stripeSubscriptionId: string;
  stripeCustomerId: string | null;
  reason: string;
  status: RefundRequestStatus;
  adminNote: string | null;
  resolvedByAdminId: string | null;
  resolvedAt: string | null;
  plan: SubscriptionPlan;
  cycle: PremiumCycle | null;
  paymentMethod: SubscriptionPaymentMethod;
  currentPeriodEnd: string | null;
  priceLabel: string | null;
  productName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PremiumRefundRequestListResponse {
  items: PremiumRefundRequest[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export type ProfileRecord = typeof profiles.$inferSelect;

const PREMIUM_STATUSES = new Set(['active', 'trialing', 'past_due']);

export function buildSubscriptionSummary(
  profile: Pick<
    ProfileRecord,
    | 'plan'
    | 'premiumSource'
    | 'premiumCycle'
    | 'premiumStartedAt'
    | 'premiumExpireAt'
    | 'stripeSubscriptionId'
    | 'stripeSubscriptionStatus'
    | 'stripeCancelAtPeriodEnd'
    | 'stripeCanceledAt'
    | 'stripeCurrentPeriodStart'
    | 'stripeCurrentPeriodEnd'
    | 'stripePriceId'
    | 'stripeProductId'
    | 'stripeProductName'
    | 'stripePriceLabel'
  > & {
    stripeProductName?: string | null;
    stripePriceLabel?: string | null;
  },
  now = new Date(),
): SubscriptionSummary {
  const hasRemoteSubscription = !!profile.stripeSubscriptionId;
  const storedSource = profile.premiumSource ?? null;
  const stripeStatus = profile.stripeSubscriptionStatus || null;
  const stripePeriodEnd = profile.stripeCurrentPeriodEnd ?? null;
  const manualPeriodEnd = profile.premiumExpireAt ?? null;
  const fallbackPeriodEnd = stripePeriodEnd || manualPeriodEnd;
  const fallbackPeriodEndDate = fallbackPeriodEnd ? new Date(fallbackPeriodEnd) : null;
  const hasValidFallbackPeriodEnd =
    !!fallbackPeriodEndDate && Number.isFinite(fallbackPeriodEndDate.getTime());
  const provider: SubscriptionSummary['provider'] =
    storedSource === 'stripe' || (!storedSource && hasRemoteSubscription)
      ? 'stripe'
      : storedSource === 'manual'
        ? 'manual'
        : profile.plan === 'premium' || hasValidFallbackPeriodEnd
          ? 'legacy'
          : 'manual';
  const isManualOrLegacyProvider = provider === 'manual' || provider === 'legacy';
  const currentPeriodEnd =
    provider === 'stripe'
      ? stripePeriodEnd || manualPeriodEnd
      : manualPeriodEnd || stripePeriodEnd;
  const currentPeriodStart =
    provider === 'stripe'
      ? profile.stripeCurrentPeriodStart || profile.premiumStartedAt
      : profile.premiumStartedAt || profile.stripeCurrentPeriodStart;
  const currentPeriodEndDate = currentPeriodEnd ? new Date(currentPeriodEnd) : null;
  const hasValidCurrentPeriodEnd =
    !!currentPeriodEndDate && Number.isFinite(currentPeriodEndDate.getTime());
  const hasActiveAccessWindow =
    hasValidCurrentPeriodEnd && currentPeriodEndDate!.getTime() > now.getTime();

  let status: SubscriptionStatus = 'basic';

  if (provider === 'stripe') {
    if (stripeStatus === 'incomplete' || stripeStatus === 'incomplete_expired') {
      status = 'incomplete';
    } else if (stripeStatus === 'canceled') {
      status = 'canceled';
    } else if (profile.plan === 'premium' && hasActiveAccessWindow) {
      if (profile.stripeCancelAtPeriodEnd) {
        status = 'canceling';
      } else if (stripeStatus === 'past_due') {
        status = 'past_due';
      } else if (!stripeStatus || PREMIUM_STATUSES.has(stripeStatus)) {
        status = 'active';
      } else {
        status = 'active';
      }
    } else if (hasValidCurrentPeriodEnd) {
      status = hasActiveAccessWindow ? 'active' : 'expired';
    } else if (stripeStatus === 'past_due') {
      status = 'past_due';
    }
  } else if (isManualOrLegacyProvider) {
    if (profile.plan === 'premium') {
      status = hasActiveAccessWindow ? 'active' : 'expired';
    } else if (hasValidCurrentPeriodEnd && !hasActiveAccessWindow) {
      status = 'expired';
    } else {
      status = 'basic';
    }
  } else if (hasRemoteSubscription) {
    if (stripeStatus === 'canceled') {
      status = 'canceled';
    } else if (stripeStatus === 'past_due') {
      status = 'past_due';
    } else if (hasValidCurrentPeriodEnd && !hasActiveAccessWindow) {
      status = 'expired';
    } else if (stripeStatus === 'incomplete' || stripeStatus === 'incomplete_expired') {
      status = 'incomplete';
    } else {
      status = 'basic';
    }
  }

  return {
    provider,
    paymentMethod:
      provider === 'stripe'
        ? 'stripe'
        : profile.plan === 'premium' || hasValidCurrentPeriodEnd
          ? 'other'
          : null,
    plan: profile.plan === 'premium' ? 'premium' : 'basic',
    status,
    cycle: profile.premiumCycle ?? null,
    startedAt: profile.premiumStartedAt
      ? new Date(profile.premiumStartedAt).toISOString()
      : null,
    currentPeriodStart: currentPeriodStart
      ? new Date(currentPeriodStart).toISOString()
      : null,
    currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd).toISOString() : null,
    cancelAtPeriodEnd: provider === 'stripe' && Boolean(profile.stripeCancelAtPeriodEnd),
    canceledAt: profile.stripeCanceledAt
      ? new Date(profile.stripeCanceledAt).toISOString()
      : null,
    productName:
      profile.stripeProductName ??
      profile.stripeProductId ??
      (isManualOrLegacyProvider && (profile.plan === 'premium' || hasValidCurrentPeriodEnd)
        ? provider === 'legacy'
          ? 'VIP legacy'
          : 'VIP manual'
        : null),
    priceLabel: profile.stripePriceLabel ?? profile.stripePriceId ?? null,
    stripeSubscriptionId: profile.stripeSubscriptionId ?? null,
  };
}
