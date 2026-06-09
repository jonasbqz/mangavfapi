import { describe, expect, it } from 'bun:test';
import { hashSearchQueryKey } from './search-abuse.util';

describe('search-abuse rate model', () => {
  it('builds stable query hashes for pagination buckets', () => {
    const first = hashSearchQueryKey('One Piece');
    const second = hashSearchQueryKey('one piece');
    const different = hashSearchQueryKey('Naruto');

    expect(first).toBe(second);
    expect(first).not.toBe(different);
    expect(first).toHaveLength(16);
  });

  it('documents pagination-friendly limits', () => {
    const paginationLimit = 50;
    const newSearchLimit = 20;
    const humanBonus = 2;

    expect(paginationLimit).toBeGreaterThan(newSearchLimit);
    expect(paginationLimit * humanBonus).toBeGreaterThanOrEqual(100);
  });
});
