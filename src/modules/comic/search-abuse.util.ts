import { createHash } from 'crypto';

const BLOCKED_SEARCH_SCRIPT_REGEX =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

export function normalizeSearchQuery(search?: string | null): string {
  return search?.trim() || '';
}

export function hashSearchQueryKey(search: string): string {
  return createHash('sha256')
    .update(normalizeSearchQuery(search).toLowerCase())
    .digest('hex')
    .slice(0, 16);
}

export function containsBlockedSearchScript(search?: string | null): boolean {
  const normalized = normalizeSearchQuery(search);
  if (!normalized) {
    return false;
  }

  return BLOCKED_SEARCH_SCRIPT_REGEX.test(normalized);
}
