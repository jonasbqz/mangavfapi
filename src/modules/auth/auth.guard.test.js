import { describe, expect, it, beforeEach, mock } from 'bun:test';
import { auth } from '@/lib/auth';

function createMockDb() {
  return {
    query: {
      account: {
        findMany: mock(async () => []),
      },
      profiles: {
        findFirst: mock(async () => null),
      },
    },
    insert: mock(() => {
      const chain = {
        values: mock(function () { return chain; }),
        onConflictDoNothing: mock(function () { return chain; }),
        returning: mock(async () => [{}]),
        then: mock((resolve) => Promise.resolve(undefined).then(resolve)),
      };
      return chain;
    }),
  };
}

function createMockExecutionContext(headers = {}) {
  const request = { headers, user: null };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    _request: request,
  };
}

describe('AuthGuard', () => {
  let AuthGuard;
  let db;

  beforeEach(async () => {
    // Dynamic import to ensure auth module is loaded after mocks are set up
    const mod = await import('./auth.guard');
    AuthGuard = mod.AuthGuard;
    db = createMockDb();

    // Reset auth mock
    auth.api.getSession = mock(async () => null);
  });

  const validSession = {
    user: {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      image: 'https://example.com/avatar.png',
      emailVerified: true,
      createdAt: new Date('2025-01-01'),
    },
    session: {
      id: 'session-1',
      token: 'token-abc',
      expiresAt: new Date('2025-12-31'),
    },
  };

  const existingProfile = {
    id: 'profile-1',
    userId: 'user-1',
    username: 'testuser',
    visibleName: 'Test User',
  };

  describe('valid session', () => {
    it('resolves profile correctly and returns true', async () => {
      auth.api.getSession = mock(async () => validSession);
      db.query.account.findMany.mockResolvedValue([
        { providerId: 'credential' },
      ]);
      db.query.profiles.findFirst.mockResolvedValue(existingProfile);

      const guard = new AuthGuard(db);
      const ctx = createMockExecutionContext({ cookie: 'session=abc' });

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(ctx._request.user).toBeDefined();
      expect(ctx._request.user.userId).toBe('user-1');
      expect(ctx._request.user.email).toBe('test@example.com');
      expect(ctx._request.user.profileId).toBe('profile-1');
      expect(ctx._request.user.emailVerified).toBe(true);
    });

    it('attaches session info to request.user', async () => {
      auth.api.getSession = mock(async () => validSession);
      db.query.account.findMany.mockResolvedValue([]);
      db.query.profiles.findFirst.mockResolvedValue(existingProfile);

      const guard = new AuthGuard(db);
      const ctx = createMockExecutionContext({ cookie: 'session=abc' });

      await guard.canActivate(ctx);

      expect(ctx._request.user.session).toBeDefined();
      expect(ctx._request.user.session.id).toBe('session-1');
    });
  });

  describe('no session', () => {
    it('throws UnauthorizedException when session is null', async () => {
      auth.api.getSession = mock(async () => null);

      const guard = new AuthGuard(db);
      const ctx = createMockExecutionContext({});

      await expect(guard.canActivate(ctx)).rejects.toThrow('Not authenticated');
    });

    it('throws UnauthorizedException when session has no user', async () => {
      auth.api.getSession = mock(async () => ({ user: null, session: null }));

      const guard = new AuthGuard(db);
      const ctx = createMockExecutionContext({});

      await expect(guard.canActivate(ctx)).rejects.toThrow('Not authenticated');
    });
  });

  describe('session without profile', () => {
    it('auto-creates profile when none exists', async () => {
      auth.api.getSession = mock(async () => validSession);
      db.query.account.findMany.mockResolvedValue([
        { providerId: 'credential' },
      ]);
      // First call returns null (no profile), second call returns the created profile
      db.query.profiles.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'profile-new',
          userId: 'user-1',
          username: 'testuserabcd',
          visibleName: 'Test User',
        });

      const guard = new AuthGuard(db);
      const ctx = createMockExecutionContext({ cookie: 'session=abc' });

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(db.insert).toHaveBeenCalledTimes(1);
      expect(ctx._request.user.profileId).toBe('profile-new');
    });

    it('generates username from email when name is missing', async () => {
      const sessionNoName = {
        ...validSession,
        user: { ...validSession.user, name: null },
      };
      auth.api.getSession = mock(async () => sessionNoName);
      db.query.account.findMany.mockResolvedValue([]);
      db.query.profiles.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'profile-new',
          userId: 'user-1',
          username: 'testabcd',
          visibleName: null,
        });

      const guard = new AuthGuard(db);
      const ctx = createMockExecutionContext({ cookie: 'session=abc' });

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(db.insert).toHaveBeenCalledTimes(1);
    });

    it('continues without profile if auto-create fails', async () => {
      auth.api.getSession = mock(async () => validSession);
      db.query.account.findMany.mockResolvedValue([]);
      // Both calls return null — profile creation silently fails
      db.query.profiles.findFirst.mockResolvedValue(null);
      db.insert.mockImplementation(() => {
        throw new Error('DB error');
      });

      const guard = new AuthGuard(db);
      const ctx = createMockExecutionContext({ cookie: 'session=abc' });

      const result = await guard.canActivate(ctx);

      // Guard still returns true — ProfileGuard handles the 403 later
      expect(result).toBe(true);
      expect(ctx._request.user.profileId).toBeUndefined();
    });
  });

  describe('email verification', () => {
    it('sets requiresEmailVerification to false when email is verified', async () => {
      auth.api.getSession = mock(async () => validSession);
      db.query.account.findMany.mockResolvedValue([
        { providerId: 'credential' },
      ]);
      db.query.profiles.findFirst.mockResolvedValue(existingProfile);

      const guard = new AuthGuard(db);
      const ctx = createMockExecutionContext({ cookie: 'session=abc' });

      await guard.canActivate(ctx);

      expect(ctx._request.user.requiresEmailVerification).toBe(false);
      expect(ctx._request.user.canUseAccountFeatures).toBe(true);
    });

    it('sets requiresEmailVerification to true when email is not verified', async () => {
      const unverifiedSession = {
        ...validSession,
        user: { ...validSession.user, emailVerified: false },
      };
      auth.api.getSession = mock(async () => unverifiedSession);
      db.query.account.findMany.mockResolvedValue([
        { providerId: 'credential' },
      ]);
      db.query.profiles.findFirst.mockResolvedValue(existingProfile);

      const guard = new AuthGuard(db);
      const ctx = createMockExecutionContext({ cookie: 'session=abc' });

      await guard.canActivate(ctx);

      expect(ctx._request.user.emailVerified).toBe(false);
      expect(ctx._request.user.requiresEmailVerification).toBe(true);
      expect(ctx._request.user.canUseAccountFeatures).toBe(false);
    });

    it('detects credential account type', async () => {
      auth.api.getSession = mock(async () => validSession);
      db.query.account.findMany.mockResolvedValue([
        { providerId: 'discord' },
        { providerId: 'credential' },
      ]);
      db.query.profiles.findFirst.mockResolvedValue(existingProfile);

      const guard = new AuthGuard(db);
      const ctx = createMockExecutionContext({ cookie: 'session=abc' });

      await guard.canActivate(ctx);

      expect(ctx._request.user.hasCredentialAccount).toBe(true);
    });

    it('reports no credential account for OAuth-only users', async () => {
      auth.api.getSession = mock(async () => validSession);
      db.query.account.findMany.mockResolvedValue([
        { providerId: 'discord' },
      ]);
      db.query.profiles.findFirst.mockResolvedValue(existingProfile);

      const guard = new AuthGuard(db);
      const ctx = createMockExecutionContext({ cookie: 'session=abc' });

      await guard.canActivate(ctx);

      expect(ctx._request.user.hasCredentialAccount).toBe(false);
    });
  });

  describe('error handling', () => {
    it('wraps non-Unauthorized errors as UnauthorizedException', async () => {
      auth.api.getSession = mock(async () => {
        throw new Error('Database connection failed');
      });

      const guard = new AuthGuard(db);
      const ctx = createMockExecutionContext({});

      await expect(guard.canActivate(ctx)).rejects.toThrow('Invalid session');
    });
  });
});
