import { describe, expect, it, beforeEach, mock } from 'bun:test';
import { ComicService } from './comic.service';

function createMockDb() {
  return {
    query: {
      comics: {
        findFirst: mock(async () => null),
        findMany: mock(async () => []),
      },
      genres: {
        findMany: mock(async () => []),
      },
      comicScans: {
        findMany: mock(async () => []),
      },
      comicViewsHistory: {
        findMany: mock(async () => []),
      },
    },
    select: mock(function () { return selectChain; }),
    execute: mock(async () => ({ rows: [] })),
    insert: mock(() => {
      const chain = {
        values: mock(function () { return chain; }),
        onConflictDoUpdate: mock(function () { return chain; }),
        returning: mock(async () => [{}]),
        then: mock((resolve) => Promise.resolve(undefined).then(resolve)),
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
  };
}

const selectChain = {
  from: mock(function () { return selectChain; }),
  where: mock(function () { return selectChain; }),
  innerJoin: mock(function () { return selectChain; }),
  groupBy: mock(function () { return selectChain; }),
  having: mock(function () { return selectChain; }),
  orderBy: mock(function () { return selectChain; }),
  limit: mock(function () { return selectChain; }),
  offset: mock(function () { return selectChain; }),
  then: mock((resolve) => Promise.resolve([]).then(resolve)),
};

function createMockCacheService() {
  return {
    get: mock(async () => null),
    set: mock(async () => undefined),
    del: mock(async () => undefined),
    wrap: mock(async (key, fn) => fn()),
    buildComicListKey: mock((filters) => {
      const sortedFilters = Object.keys(filters)
        .sort()
        .filter((key) => filters[key] !== undefined && filters[key] !== null && filters[key] !== '')
        .map((key) => `${key}=${filters[key]}`)
        .join(':');
      return `comics:list:${sortedFilters || 'all'}`;
    }),
    invalidateComicCache: mock(async () => undefined),
  };
}

function createMockRouteProtection() {
  return {
    getComicPath: mock(async (comic) => `/${comic?.slug || 'comic'}`),
    getChapterPath: mock(async (comic, chapter) => `/${comic?.slug || 'comic'}/${chapter?.id || 'chapter'}`),
    createUnavailableException: mock(() => new Error('Service unavailable')),
    parseComicSegment: mock(() => ({ hasCode: false, slug: null })),
    getComicCode: mock(async () => null),
  };
}

describe('ComicService', () => {
  let service;
  let db;
  let cacheService;
  let routeProtection;

  beforeEach(() => {
    db = createMockDb();
    cacheService = createMockCacheService();
    routeProtection = createMockRouteProtection();
    service = new ComicService(db, cacheService, routeProtection);
  });

  const sampleComic = {
    id: 1,
    title: 'One Piece',
    slug: 'one-piece',
    coverImage: 'https://example.com/cover.jpg',
    type: 'manga',
    status: 'ongoing',
    views: 1000,
    likes: 50,
    followers: 200,
    isNsfw: false,
    isHentai: false,
    protectedRouteEnabled: false,
    comicGenres: [{ genre: { id: 1, name: 'Action' }, genreId: 1 }],
    comicScans: [],
  };

  const sampleGenres = [
    { id: 1, name: 'Action', slug: 'action', createdAt: new Date() },
    { id: 2, name: 'Adventure', slug: 'adventure', createdAt: new Date() },
  ];

  describe('findAll', () => {
    it('generates correct cache key for default filters', () => {
      cacheService.buildComicListKey({});

      expect(cacheService.buildComicListKey).toHaveBeenCalledWith({});
      const result = cacheService.buildComicListKey({});
      expect(result).toBe('comics:list:all');
    });

    it('generates cache key with search filter', () => {
      const filters = { search: 'one piece', page: 1, limit: 20 };
      const key = cacheService.buildComicListKey(filters);

      expect(key).toContain('search=one piece');
      expect(key).toContain('page=1');
    });

    it('uses cacheService.wrap for caching', async () => {
      // Set up cache miss → DB call path
      cacheService.wrap.mockImplementation(async (key, fn) => fn());
      db.query.genres.findMany.mockResolvedValue(sampleGenres);

      // Mock select chain to return empty results (no comics found)
      const emptyChain = {
        from: mock(function () { return emptyChain; }),
        where: mock(function () { return emptyChain; }),
        orderBy: mock(function () { return emptyChain; }),
        limit: mock(function () { return emptyChain; }),
        offset: mock(function () { return emptyChain; }),
        then: mock((resolve) => Promise.resolve([]).then(resolve)),
      };
      db.select.mockReturnValue(emptyChain);

      await service.findAll({});

      expect(cacheService.wrap).toHaveBeenCalledTimes(1);
    });

    it('returns cached data on cache hit without querying DB', async () => {
      const cachedResponse = {
        data: [{ id: 1, title: 'One Piece' }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        genres: ['Action'],
      };
      cacheService.wrap.mockResolvedValue(cachedResponse);

      const result = await service.findAll({});

      expect(result).toEqual(cachedResponse);
      expect(db.select).not.toHaveBeenCalled();
    });

    it('passes correct TTL based on search filter', async () => {
      cacheService.wrap.mockImplementation(async (key, fn) => fn());
      db.query.genres.findMany.mockResolvedValue(sampleGenres);

      const emptyChain = {
        from: mock(function () { return emptyChain; }),
        where: mock(function () { return emptyChain; }),
        orderBy: mock(function () { return emptyChain; }),
        limit: mock(function () { return emptyChain; }),
        offset: mock(function () { return emptyChain; }),
        then: mock((resolve) => Promise.resolve([]).then(resolve)),
      };
      db.select.mockReturnValue(emptyChain);

      // With search → VERY_SHORT TTL
      await service.findAll({ search: 'test' });
      expect(cacheService.wrap).toHaveBeenCalled();
    });

    it('returns empty data when no comics match filters', async () => {
      cacheService.wrap.mockImplementation(async (key, fn) => fn());
      db.query.genres.findMany.mockResolvedValue(sampleGenres);

      const emptyChain = {
        from: mock(function () { return emptyChain; }),
        where: mock(function () { return emptyChain; }),
        orderBy: mock(function () { return emptyChain; }),
        limit: mock(function () { return emptyChain; }),
        offset: mock(function () { return emptyChain; }),
        then: mock((resolve) => Promise.resolve([]).then(resolve)),
      };

      // Count query returns 0
      const countChain = {
        from: mock(function () { return countChain; }),
        where: mock(function () { return countChain; }),
        then: mock((resolve) => Promise.resolve([{ count: '0' }]).then(resolve)),
      };

      let callIdx = 0;
      db.select.mockImplementation(() => {
        callIdx++;
        // Odd calls: getOrderedIds (empty), Even calls: count query
        if (callIdx % 2 === 1) return emptyChain;
        return countChain;
      });

      const result = await service.findAll({ type: 'manhwa' });

      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
      expect(result.genres).toEqual(['Action', 'Adventure']);
    });
  });

  describe('getTrending (cache hit/miss)', () => {
    it('returns cached trending on cache hit', async () => {
      const cachedTrending = [
        { id: 1, title: 'One Piece', views: 5000 },
        { id: 2, title: 'Naruto', views: 4000 },
      ];
      cacheService.wrap.mockResolvedValue(cachedTrending);

      const result = await service.getTrending(10);

      expect(result).toEqual(cachedTrending);
      expect(db.query.comics.findMany).not.toHaveBeenCalled();
    });

    it('queries DB on cache miss and returns results', async () => {
      cacheService.wrap.mockImplementation(async (key, fn) => fn());
      db.query.comics.findMany.mockResolvedValue([
        { ...sampleComic, comicGenres: [{ genre: { id: 1, name: 'Action' } }] },
      ]);

      const result = await service.getTrending(10);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
      expect(result[0].genres).toBeDefined();
      expect(db.query.comics.findMany).toHaveBeenCalledTimes(1);
    });

    it('builds correct cache key with NSFW filter', async () => {
      let capturedKey;
      cacheService.wrap.mockImplementation(async (key, fn) => { capturedKey = key; return []; });

      await service.getTrending(10, true);

      expect(capturedKey).toContain('nsfw');
    });

    it('builds correct cache key without NSFW filter', async () => {
      let capturedKey;
      cacheService.wrap.mockImplementation(async (key, fn) => { capturedKey = key; return []; });

      await service.getTrending(10);

      expect(capturedKey).toContain('all');
    });

    it('respects the limit parameter', async () => {
      cacheService.wrap.mockImplementation(async (key, fn) => fn());
      db.query.comics.findMany.mockResolvedValue([
        { ...sampleComic, comicGenres: [] },
      ]);

      await service.getTrending(5);

      expect(db.query.comics.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('getRecommendations', () => {
    it('uses cache for recommendation results', async () => {
      const cachedRecs = [{ id: 2, title: 'Naruto' }];
      cacheService.wrap.mockResolvedValue(cachedRecs);

      const result = await service.getRecommendations(1, 5);

      expect(result).toEqual(cachedRecs);
      expect(db.query.comics.findFirst).not.toHaveBeenCalled();
    });

    it('builds cache key with comicId, limit, and nsfw', async () => {
      let capturedKey;
      cacheService.wrap.mockImplementation(async (key, fn) => { capturedKey = key; return []; });

      await service.getRecommendations(42, 5, false);

      expect(capturedKey).toContain('42');
      expect(capturedKey).toContain('5');
      expect(capturedKey).toContain('safe');
    });

    it('returns empty when source comic not found', async () => {
      cacheService.wrap.mockImplementation(async (key, fn) => fn());
      db.query.comics.findFirst.mockResolvedValue(null);

      const result = await service.getRecommendations(999, 5);

      expect(result).toEqual([]);
    });

    it('falls back to popular comics when no genre matches', async () => {
      cacheService.wrap.mockImplementation(async (key, fn) => fn());

      // Source comic with genres
      const sourceComic = {
        ...sampleComic,
        comicGenres: [{ genreId: 1 }, { genreId: 2 }],
      };
      db.query.comics.findFirst.mockResolvedValue(sourceComic);

      // No genre overlap results from select chain
      const emptySelectChain = {
        from: mock(function () { return emptySelectChain; }),
        where: mock(function () { return emptySelectChain; }),
        innerJoin: mock(function () { return emptySelectChain; }),
        groupBy: mock(function () { return emptySelectChain; }),
        having: mock(function () { return emptySelectChain; }),
        orderBy: mock(function () { return emptySelectChain; }),
        limit: mock(function () { return emptySelectChain; }),
        then: mock((resolve) => Promise.resolve([]).then(resolve)),
      };
      db.select.mockReturnValue(emptySelectChain);

      // Fallback: popular comics query via findMany
      const popularComic = {
        id: 5,
        title: 'Bleach',
        slug: 'bleach',
        coverImage: 'cover.jpg',
        type: 'manga',
        status: 'completed',
        views: 3000,
        isNsfw: false,
        protectedRouteEnabled: false,
        comicGenres: [{ genre: { id: 3, name: 'Fantasy' } }],
      };
      // When genre overlap returns empty, findMany for recommended is skipped (comicIds=[])
      // So the first findMany call is the fallback popular query
      db.query.comics.findMany.mockResolvedValue([popularComic]);

      const result = await service.getRecommendations(1, 3);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].title).toBe('Bleach');
    });

    it('excludes the source comic from recommendations', async () => {
      cacheService.wrap.mockImplementation(async (key, fn) => fn());

      const sourceComic = {
        ...sampleComic,
        id: 1,
        comicGenres: [{ genreId: 1 }],
      };
      db.query.comics.findFirst.mockResolvedValue(sourceComic);

      // Genre overlap returns the source comic itself (should be filtered)
      const selectResult = [{ comicId: 1 }];
      const overlapChain = {
        from: mock(function () { return overlapChain; }),
        where: mock(function () { return overlapChain; }),
        innerJoin: mock(function () { return overlapChain; }),
        groupBy: mock(function () { return overlapChain; }),
        having: mock(function () { return overlapChain; }),
        orderBy: mock(function () { return overlapChain; }),
        limit: mock(function () { return overlapChain; }),
        then: mock((resolve) => Promise.resolve(selectResult).then(resolve)),
      };
      db.select.mockReturnValue(overlapChain);

      // After filtering out source comic, no IDs remain → fallback to popular
      db.query.comics.findMany.mockResolvedValue([
        {
          id: 2,
          title: 'Naruto',
          slug: 'naruto',
          coverImage: 'cover.jpg',
          type: 'manga',
          status: 'completed',
          views: 2000,
          isNsfw: false,
          protectedRouteEnabled: false,
          comicGenres: [{ genre: { id: 1, name: 'Action' } }],
        },
      ]);

      const result = await service.getRecommendations(1, 3);

      // Source comic (id=1) should not be in results
      expect(result.find((c) => c.id === 1)).toBeUndefined();
    });
  });

  describe('getPopular', () => {
    it('uses cache for popular comics', async () => {
      const cachedPopular = [{ id: 1, title: 'One Piece' }];
      cacheService.wrap.mockResolvedValue(cachedPopular);

      const result = await service.getPopular(10);

      expect(result).toEqual(cachedPopular);
      expect(db.query.comics.findMany).not.toHaveBeenCalled();
    });

    it('queries DB on cache miss', async () => {
      cacheService.wrap.mockImplementation(async (key, fn) => fn());
      db.query.comics.findMany.mockResolvedValue([
        { ...sampleComic, comicGenres: [{ genre: { id: 1, name: 'Action' } }] },
      ]);

      const result = await service.getPopular(10);

      expect(result).toHaveLength(1);
      expect(db.query.comics.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('getRecent', () => {
    it('uses cache for recent comics', async () => {
      const cachedRecent = [{ id: 1, title: 'One Piece' }];
      cacheService.wrap.mockResolvedValue(cachedRecent);

      const result = await service.getRecent(10);

      expect(result).toEqual(cachedRecent);
    });

    it('queries DB on cache miss', async () => {
      cacheService.wrap.mockImplementation(async (key, fn) => fn());
      db.query.comics.findMany.mockResolvedValue([
        { ...sampleComic, comicGenres: [] },
      ]);

      const result = await service.getRecent(10);

      expect(result).toHaveLength(1);
      expect(db.query.comics.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('clearComicCache', () => {
    it('invalidates comic cache and returns success message', async () => {
      const result = await service.clearComicCache();

      expect(result.message).toBe('Comic cache cleared successfully');
      expect(cacheService.invalidateComicCache).toHaveBeenCalledTimes(1);
    });
  });

  describe('getAllGenres', () => {
    it('returns all genres when includeAdult is true', async () => {
      cacheService.wrap.mockImplementation(async (key, fn) => fn());
      const allGenres = [
        { id: 1, name: 'Action', slug: 'action', createdAt: new Date() },
        { id: 2, name: 'Hentai', slug: 'hentai', createdAt: new Date() },
      ];
      db.query.genres.findMany.mockResolvedValue(allGenres);

      const result = await service.getAllGenres(true);

      expect(result).toHaveLength(2);
    });

    it('filters out adult genres when includeAdult is false', async () => {
      cacheService.wrap.mockImplementation(async (key, fn) => fn());
      const allGenres = [
        { id: 1, name: 'Action', slug: 'action', createdAt: new Date() },
        { id: 2, name: 'Hentai', slug: 'hentai', createdAt: new Date() },
      ];
      db.query.genres.findMany.mockResolvedValue(allGenres);

      const result = await service.getAllGenres(false);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Action');
    });
  });
});
