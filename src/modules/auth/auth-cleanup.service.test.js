import { describe, expect, it, beforeEach, mock } from 'bun:test';

const selectChain = {
  from: mock(function () { return selectChain; }),
  innerJoin: mock(function () { return selectChain; }),
  where: mock(async () => []),
};

const deleteChain = {
  where: mock(async () => undefined),
};

function resetChains() {
  selectChain.from.mockReset();
  selectChain.innerJoin.mockReset();
  selectChain.where.mockReset();
  deleteChain.where.mockReset();
  selectChain.from.mockImplementation(function () { return selectChain; });
  selectChain.innerJoin.mockImplementation(function () { return selectChain; });
  selectChain.where.mockImplementation(async () => []);
  deleteChain.where.mockImplementation(async () => undefined);
}

function createMockDb({
  selectResult = [],
  selectThrows = null,
  deleteThrows = null,
} = {}) {
  if (selectThrows) {
    selectChain.where.mockImplementationOnce(async () => {
      throw selectThrows;
    });
  } else {
    selectChain.where.mockImplementationOnce(async () => selectResult);
  }

  if (deleteThrows) {
    deleteChain.where.mockImplementationOnce(async () => {
      throw deleteThrows;
    });
  } else {
    deleteChain.where.mockImplementationOnce(async () => undefined);
  }

  return {
    select: mock(() => selectChain),
    delete: mock(() => deleteChain),
  };
}

function makeUser(id, createdAt, emailVerified = false) {
  return {
    id,
    createdAt,
    emailVerified,
  };
}

const policyState = { eligible: true };

mock.module('@/lib/email-verification-policy', () => ({
  isVerificationCleanupEligible: () => policyState.eligible,
}));

mock.module('@/database/database.module', () => ({
  DATABASE_CONNECTION: 'DATABASE_CONNECTION',
}));

mock.module('@/database/schema', () => ({
  account: { userId: 'userId', providerId: 'providerId' },
  user: { id: 'id', createdAt: 'createdAt', emailVerified: 'emailVerified' },
}));

mock.module('drizzle-orm', () => ({
  and: (...args) => args,
  eq: () => 'eq',
  inArray: () => 'inArray',
  lt: () => 'lt',
}));

const { AuthCleanupService } = await import('./auth-cleanup.service');

describe('AuthCleanupService', () => {
  let service;
  let db;
  let logSpy;
  let warnSpy;
  let errorSpy;

  beforeEach(() => {
    resetChains();
    policyState.eligible = true;
    logSpy = mock(() => undefined);
    warnSpy = mock(() => undefined);
    errorSpy = mock(() => undefined);
  });

  function buildService(database) {
    const svc = new AuthCleanupService(database);
    svc.logger = { log: logSpy, warn: warnSpy, error: errorSpy };
    return svc;
  }

  it('does nothing when no stale users are found', async () => {
    db = createMockDb({ selectResult: [] });
    service = buildService(db);

    await service.removeExpiredUnverifiedUsers();

    expect(db.delete).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('deletes eligible stale users and logs the count', async () => {
    db = createMockDb({
      selectResult: [
        makeUser('user-1', new Date('2026-01-01T00:00:00Z')),
        makeUser('user-2', new Date('2026-01-02T00:00:00Z')),
      ],
    });
    service = buildService(db);

    await service.removeExpiredUnverifiedUsers();

    expect(db.delete).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0][0]).toMatch(/Deleted 2 unverified/);
  });

  it('skips ineligible users via the policy helper', async () => {
    policyState.eligible = false;
    db = createMockDb({
      selectResult: [
        makeUser('user-1', new Date('2026-01-01T00:00:00Z')),
      ],
    });
    service = buildService(db);

    await service.removeExpiredUnverifiedUsers();

    expect(db.delete).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('logs a warning and does NOT rethrow when the DB connection is terminated', async () => {
    const connError = new Error('Connection terminated unexpectedly');
    db = createMockDb({ selectThrows: connError });
    service = buildService(db);

    await service.removeExpiredUnverifiedUsers();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/database connection issue/);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('also handles connection errors raised on the DELETE call', async () => {
    const connError = new Error('Connection terminated unexpectedly');
    db = createMockDb({
      selectResult: [makeUser('user-1', new Date('2026-01-01T00:00:00Z'))],
      deleteThrows: connError,
    });
    service = buildService(db);

    await service.removeExpiredUnverifiedUsers();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('rethrows non-connection errors so the cron surfaces them', async () => {
    const unexpected = new Error('syntax error at or near "FROM"');
    db = createMockDb({ selectThrows: unexpected });
    service = buildService(db);

    await expect(service.removeExpiredUnverifiedUsers()).rejects.toThrow(
      'syntax error',
    );
  });
});
