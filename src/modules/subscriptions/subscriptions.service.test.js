import { describe, expect, it, beforeEach, mock } from 'bun:test';
import { createHmac } from 'crypto';
import { buildSubscriptionSummary } from './subscriptions.types';
import { SubscriptionsService } from './subscriptions.service';

function createMockDb() {
  return {
    query: {
      profiles: {
        findFirst: mock(async () => null),
      },
      user: {
        findFirst: mock(async () => null),
      },
      premiumRefundRequests: {
        findFirst: mock(async () => null),
      },
    },
    select: mock(function () { return selectChain; }),
    insert: mock(() => {
      const chain = {
        values: mock(function () { return chain; }),
        returning: mock(async () => [{ id: 'refund-1' }]),
      };
      return chain;
    }),
    update: mock(() => {
      const chain = {
        set: mock(function () { return chain; }),
        where: mock(function () { return chain; }),
        returning: mock(async () => [{}]),
        then: mock((resolve) => Promise.resolve(undefined).then(resolve)),
      };
      return chain;
    }),
    delete: mock(() => {
      const chain = {
        where: mock(function () { return chain; }),
        then: mock((resolve) => Promise.resolve(undefined).then(resolve)),
      };
      return chain;
    }),
  };
}

const selectChain = {
  from: mock(function () { return selectChain; }),
  leftJoin: mock(function () { return selectChain; }),
  where: mock(function () { return selectChain; }),
  orderBy: mock(function () { return selectChain; }),
  limit: mock(function () { return selectChain; }),
  offset: mock(function () { return selectChain; }),
  then: mock((resolve) => Promise.resolve([]).then(resolve)),
};

function createMockConfig(overrides = {}) {
  const defaults = {
    STRIPE_WEBHOOK_SECRET: 'whsec_test_secret',
    STRIPE_SECRET_KEY: 'sk_test_123',
    STRIPE_PREMIUM_PRICE_IDS: 'price_test_1',
    STRIPE_PREMIUM_PRODUCT_IDS: 'prod_test_1',
    FRONTEND_URL: 'http://localhost:3000',
    ...overrides,
  };
  return {
    get: mock((key) => defaults[key] ?? null),
  };
}

function buildStripePremiumProfile(overrides = {}) {
  return {
    id: 'profile-1',
    userId: 'user-1',
    plan: 'premium',
    premiumSource: 'stripe',
    premiumCycle: '1m',
    premiumStartedAt: new Date('2025-01-01'),
    premiumExpireAt: new Date('2027-12-31'),
    stripeSubscriptionId: 'sub_test_123',
    stripeSubscriptionStatus: 'active',
    stripeCancelAtPeriodEnd: false,
    stripeCanceledAt: null,
    stripeCurrentPeriodStart: new Date('2027-01-01'),
    stripeCurrentPeriodEnd: new Date('2027-12-31'),
    stripeCustomerId: 'cus_test_123',
    stripePriceId: 'price_test_1',
    stripeProductId: 'prod_test_1',
    stripeProductName: 'Premium Monthly',
    stripePriceLabel: '9.99 USD por mes',
    ...overrides,
  };
}

describe('SubscriptionsService', () => {
  let service;
  let db;
  let configService;

  beforeEach(() => {
    db = createMockDb();
    configService = createMockConfig();
    service = new SubscriptionsService(db, configService);
  });

  describe('buildSubscriptionSummary (status transitions)', () => {
    it('returns basic status for basic plan with no premium data', () => {
      const profile = {
        plan: 'basic',
        premiumSource: null,
        premiumCycle: null,
        premiumStartedAt: null,
        premiumExpireAt: null,
        stripeSubscriptionId: null,
        stripeSubscriptionStatus: null,
        stripeCancelAtPeriodEnd: false,
        stripeCanceledAt: null,
        stripeCurrentPeriodStart: null,
        stripeCurrentPeriodEnd: null,
        stripePriceId: null,
        stripeProductId: null,
        stripeProductName: null,
        stripePriceLabel: null,
      };

      const summary = buildSubscriptionSummary(profile);

      expect(summary.plan).toBe('basic');
      expect(summary.status).toBe('basic');
      expect(summary.paymentMethod).toBeNull();
      expect(summary.stripeSubscriptionId).toBeNull();
    });

    it('returns active for Stripe premium with future period end', () => {
      const profile = buildStripePremiumProfile();
      const summary = buildSubscriptionSummary(profile);

      expect(summary.plan).toBe('premium');
      expect(summary.status).toBe('active');
      expect(summary.paymentMethod).toBe('stripe');
      expect(summary.provider).toBe('stripe');
      expect(summary.cancelAtPeriodEnd).toBe(false);
    });

    it('returns canceling when cancelAtPeriodEnd is true', () => {
      const profile = buildStripePremiumProfile({
        stripeCancelAtPeriodEnd: true,
      });
      const summary = buildSubscriptionSummary(profile);

      expect(summary.status).toBe('canceling');
      expect(summary.cancelAtPeriodEnd).toBe(true);
    });

    it('returns past_due for past_due Stripe status', () => {
      const profile = buildStripePremiumProfile({
        stripeSubscriptionStatus: 'past_due',
      });
      const summary = buildSubscriptionSummary(profile);

      expect(summary.status).toBe('past_due');
    });

    it('returns expired for Stripe with past period end', () => {
      const profile = buildStripePremiumProfile({
        plan: 'basic',
        stripeCurrentPeriodEnd: new Date('2024-01-01'),
        stripeSubscriptionStatus: 'active',
      });
      const summary = buildSubscriptionSummary(profile);

      expect(summary.status).toBe('expired');
    });

    it('returns canceled for canceled Stripe status', () => {
      const profile = buildStripePremiumProfile({
        plan: 'basic',
        stripeSubscriptionStatus: 'canceled',
      });
      const summary = buildSubscriptionSummary(profile);

      expect(summary.status).toBe('canceled');
    });

    it('returns incomplete for incomplete Stripe status', () => {
      const profile = buildStripePremiumProfile({
        plan: 'basic',
        stripeSubscriptionStatus: 'incomplete',
      });
      const summary = buildSubscriptionSummary(profile);

      expect(summary.status).toBe('incomplete');
    });

    it('returns active for manual premium with future period end', () => {
      const profile = {
        plan: 'premium',
        premiumSource: 'manual',
        premiumCycle: '1m',
        premiumStartedAt: new Date('2025-01-01'),
        premiumExpireAt: new Date('2027-12-31'),
        stripeSubscriptionId: null,
        stripeSubscriptionStatus: null,
        stripeCancelAtPeriodEnd: false,
        stripeCanceledAt: null,
        stripeCurrentPeriodStart: null,
        stripeCurrentPeriodEnd: null,
        stripePriceId: null,
        stripeProductId: null,
        stripeProductName: null,
        stripePriceLabel: null,
      };

      const summary = buildSubscriptionSummary(profile);

      expect(summary.provider).toBe('manual');
      expect(summary.plan).toBe('premium');
      expect(summary.status).toBe('active');
      expect(summary.paymentMethod).toBe('other');
    });

    it('returns expired for manual premium with past period end', () => {
      const profile = {
        plan: 'premium',
        premiumSource: 'manual',
        premiumCycle: '1m',
        premiumStartedAt: new Date('2024-01-01'),
        premiumExpireAt: new Date('2024-06-01'),
        stripeSubscriptionId: null,
        stripeSubscriptionStatus: null,
        stripeCancelAtPeriodEnd: false,
        stripeCanceledAt: null,
        stripeCurrentPeriodStart: null,
        stripeCurrentPeriodEnd: null,
        stripePriceId: null,
        stripeProductId: null,
        stripeProductName: null,
        stripePriceLabel: null,
      };

      const summary = buildSubscriptionSummary(profile);

      expect(summary.status).toBe('expired');
    });

    it('returns legacy provider for premium with no source and no remote subscription', () => {
      const profile = {
        plan: 'premium',
        premiumSource: null,
        premiumCycle: null,
        premiumStartedAt: null,
        premiumExpireAt: new Date('2027-12-31'),
        stripeSubscriptionId: null,
        stripeSubscriptionStatus: null,
        stripeCancelAtPeriodEnd: false,
        stripeCanceledAt: null,
        stripeCurrentPeriodStart: null,
        stripeCurrentPeriodEnd: null,
        stripePriceId: null,
        stripeProductId: null,
        stripeProductName: null,
        stripePriceLabel: null,
      };

      const summary = buildSubscriptionSummary(profile);

      expect(summary.provider).toBe('legacy');
      expect(summary.status).toBe('active');
    });
  });

  describe('webhook signature verification', () => {
    const webhookSecret = 'whsec_test_secret';

    function buildValidSignature(body, timestamp) {
      return createHmac('sha256', webhookSecret)
        .update(`${timestamp}.${body}`)
        .digest('hex');
    }

    it('accepts valid webhook signature', async () => {
      const body = JSON.stringify({
        id: 'evt_test',
        type: 'payment_intent.succeeded',
        data: { object: {} },
      });
      const timestamp = String(Math.floor(Date.now() / 1000));
      const v1 = buildValidSignature(body, timestamp);
      const signatureHeader = `t=${timestamp},v1=${v1}`;

      // Should not throw — event type is ignored by default case
      await service.handleWebhook(body, signatureHeader);
    });

    it('rejects invalid webhook signature', async () => {
      const body = JSON.stringify({
        id: 'evt_test',
        type: 'payment_intent.succeeded',
        data: { object: {} },
      });
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signatureHeader = `t=${timestamp},v1=invalidsignaturehex`;

      await expect(
        service.handleWebhook(body, signatureHeader),
      ).rejects.toThrow('Invalid Stripe signature');
    });

    it('rejects missing signature header', async () => {
      await expect(
        service.handleWebhook('{"test":true}', undefined),
      ).rejects.toThrow('Missing Stripe webhook payload');
    });

    it('rejects missing body', async () => {
      await expect(
        service.handleWebhook(undefined, 't=123,v1=abc'),
      ).rejects.toThrow('Missing Stripe webhook payload');
    });

    it('rejects malformed signature header (missing t or v1)', async () => {
      const body = JSON.stringify({
        id: 'evt_test',
        type: 'payment_intent.succeeded',
        data: { object: {} },
      });

      await expect(
        service.handleWebhook(body, 'malformed_header'),
      ).rejects.toThrow('Invalid Stripe signature header');
    });

    it('accepts Buffer body as well as string', async () => {
      const body = JSON.stringify({
        id: 'evt_test',
        type: 'payment_intent.succeeded',
        data: { object: {} },
      });
      const buffer = Buffer.from(body);
      const timestamp = String(Math.floor(Date.now() / 1000));
      const v1 = buildValidSignature(body, timestamp);
      const signatureHeader = `t=${timestamp},v1=${v1}`;

      await service.handleWebhook(buffer, signatureHeader);
    });
  });

  describe('refund request creation', () => {
    it('rejects reason shorter than 10 characters', async () => {
      await expect(
        service.createRefundRequest('profile-1', 'short'),
      ).rejects.toThrow('at least 10 characters');
    });

    it('rejects empty or whitespace-only reason', async () => {
      await expect(
        service.createRefundRequest('profile-1', '   '),
      ).rejects.toThrow('at least 10 characters');
    });

    it('rejects reason longer than 2000 characters', async () => {
      const longReason = 'a'.repeat(2001);
      await expect(
        service.createRefundRequest('profile-1', longReason),
      ).rejects.toThrow('too long');
    });

    it('rejects non-premium profile', async () => {
      const basicProfile = buildStripePremiumProfile({ plan: 'basic' });
      db.query.profiles.findFirst.mockResolvedValue(basicProfile);
      db.query.user.findFirst.mockResolvedValue({ id: 'user-1', plan: 'basic', premiumExpireAt: null });

      await expect(
        service.createRefundRequest('profile-1', 'This is a valid refund reason with enough chars'),
      ).rejects.toThrow('Only Stripe premium subscriptions');
    });

    it('rejects profile without Stripe subscription', async () => {
      const noSubProfile = buildStripePremiumProfile({
        stripeSubscriptionId: null,
      });
      db.query.profiles.findFirst.mockResolvedValue(noSubProfile);
      db.query.user.findFirst.mockResolvedValue({ id: 'user-1', plan: 'premium', premiumExpireAt: new Date('2027-01-01') });

      await expect(
        service.createRefundRequest('profile-1', 'This is a valid refund reason with enough chars'),
      ).rejects.toThrow('Only Stripe premium subscriptions');
    });

    it('rejects when open refund request already exists', async () => {
      const premiumProfile = buildStripePremiumProfile();
      db.query.profiles.findFirst.mockResolvedValue(premiumProfile);
      db.query.user.findFirst.mockResolvedValue({ id: 'user-1', plan: 'premium', premiumExpireAt: new Date('2027-01-01') });
      // Mock existing open request
      db.query.premiumRefundRequests.findFirst.mockResolvedValue({
        id: 'existing-refund',
        status: 'pending',
      });

      await expect(
        service.createRefundRequest('profile-1', 'This is a valid refund reason with enough chars'),
      ).rejects.toThrow('already an open refund request');
    });

    it('creates refund request for valid premium Stripe subscription', async () => {
      const premiumProfile = buildStripePremiumProfile();
      const refundRecord = {
        id: 'refund-1',
        profileId: 'profile-1',
        userId: 'user-1',
        username: 'testuser',
        visibleName: 'Test User',
        email: 'test@example.com',
        stripeSubscriptionId: 'sub_test_123',
        stripeCustomerId: 'cus_test_123',
        reason: 'This is a valid refund reason with enough chars',
        status: 'pending',
        adminNote: null,
        resolvedByAdminId: null,
        resolvedAt: null,
        plan: 'premium',
        cycle: '1m',
        paymentMethod: 'stripe',
        currentPeriodEnd: new Date('2025-12-31'),
        priceLabel: '9.99 USD por mes',
        productName: 'Premium Monthly',
        createdAt: new Date('2025-06-01'),
        updatedAt: new Date('2025-06-01'),
      };

      // getProfileById: findFirst(profile) + findFirst(user)
      db.query.profiles.findFirst.mockResolvedValue(premiumProfile);
      db.query.user.findFirst.mockResolvedValue({ id: 'user-1', plan: 'premium', premiumExpireAt: new Date('2027-01-01') });
      // findOpenRefundRequest: returns null
      db.query.premiumRefundRequests.findFirst.mockResolvedValue(null);
      // insert chain returns the id
      db.insert.mockReturnValue({
        values: mock(function () { return this; }),
        returning: mock(async () => [{ id: 'refund-1' }]),
      });
      // getRefundRequestById: select chain returns the refund record
      const selectChainForRefund = {
        from: mock(function () { return this; }),
        leftJoin: mock(function () { return this; }),
        where: mock(function () { return this; }),
        orderBy: mock(function () { return this; }),
        limit: mock(function () { return this; }),
        then: mock((resolve) => Promise.resolve([refundRecord]).then(resolve)),
      };
      db.select.mockReturnValue(selectChainForRefund);

      const result = await service.createRefundRequest(
        'profile-1',
        'This is a valid refund reason with enough chars',
      );

      expect(result.id).toBe('refund-1');
      expect(result.status).toBe('pending');
      expect(result.reason).toBe('This is a valid refund reason with enough chars');
      expect(db.insert).toHaveBeenCalledTimes(1);
    });
  });

  describe('refund request status transitions', () => {
    it('parseRefundRequestStatus accepts valid statuses', async () => {
      // We test this indirectly through updateRefundRequest
      const refundRecord = {
        id: 'refund-1',
        profileId: 'profile-1',
        userId: 'user-1',
        username: 'testuser',
        visibleName: 'Test User',
        email: 'test@example.com',
        stripeSubscriptionId: 'sub_test_123',
        stripeCustomerId: 'cus_test_123',
        reason: 'Valid reason text here',
        status: 'pending',
        adminNote: null,
        resolvedByAdminId: null,
        resolvedAt: null,
        plan: 'premium',
        cycle: '1m',
        paymentMethod: 'stripe',
        currentPeriodEnd: new Date('2025-12-31'),
        priceLabel: '9.99 USD',
        productName: 'Premium',
        createdAt: new Date('2025-06-01'),
        updatedAt: new Date('2025-06-01'),
      };

      // findRefundRequestById
      const selectChainForFind = {
        from: mock(function () { return this; }),
        leftJoin: mock(function () { return this; }),
        where: mock(function () { return this; }),
        orderBy: mock(function () { return this; }),
        limit: mock(function () { return this; }),
        then: mock((resolve) => Promise.resolve([refundRecord]).then(resolve)),
      };
      db.select.mockReturnValue(selectChainForFind);

      // getRefundRequestById (called after update)
      const updatedRecord = { ...refundRecord, status: 'reviewing' };
      const selectChainForUpdated = {
        from: mock(function () { return this; }),
        leftJoin: mock(function () { return this; }),
        where: mock(function () { return this; }),
        orderBy: mock(function () { return this; }),
        limit: mock(function () { return this; }),
        then: mock((resolve) => Promise.resolve([updatedRecord]).then(resolve)),
      };

      let callCount = 0;
      db.select.mockImplementation(() => {
        callCount++;
        // First call: findRefundRequestById (returns pending)
        // Second call: getRefundRequestById after update (returns reviewing)
        return callCount <= 1 ? selectChainForFind : selectChainForUpdated;
      });

      const result = await service.updateRefundRequest('refund-1', {
        status: 'reviewing',
      });

      expect(result.status).toBe('reviewing');
    });

    it('rejects invalid status', async () => {
      const refundRecord = {
        id: 'refund-1',
        status: 'pending',
        profileId: 'profile-1',
        userId: 'user-1',
        username: null,
        visibleName: null,
        email: null,
        stripeSubscriptionId: 'sub_test_123',
        stripeCustomerId: null,
        reason: 'test',
        adminNote: null,
        resolvedByAdminId: null,
        resolvedAt: null,
        plan: 'premium',
        cycle: null,
        paymentMethod: null,
        currentPeriodEnd: null,
        priceLabel: null,
        productName: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const selectChainForFind = {
        from: mock(function () { return this; }),
        leftJoin: mock(function () { return this; }),
        where: mock(function () { return this; }),
        orderBy: mock(function () { return this; }),
        limit: mock(function () { return this; }),
        then: mock((resolve) => Promise.resolve([refundRecord]).then(resolve)),
      };
      db.select.mockReturnValue(selectChainForFind);

      await expect(
        service.updateRefundRequest('refund-1', { status: 'invalid_status' }),
      ).rejects.toThrow('Invalid refund request status');
    });
  });
});
