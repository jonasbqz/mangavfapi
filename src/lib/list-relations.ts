export const COMIC_LIST_COLUMNS = {
  id: true,
  title: true,
  slug: true,
  coverImage: true,
  type: true,
  status: true,
  protectedRouteEnabled: true,
  isNsfw: true,
} as const;

export const CHAPTER_LIST_COLUMNS = {
  id: true,
  comicScanId: true,
  chapterNumber: true,
  title: true,
  slug: true,
} as const;

export const READING_HISTORY_RELATIONS = {
  comic: {
    columns: COMIC_LIST_COLUMNS,
  },
  chapter: {
    columns: CHAPTER_LIST_COLUMNS,
  },
} as const;

export const BOOKMARK_COMIC_RELATIONS = {
  comic: {
    columns: COMIC_LIST_COLUMNS,
  },
} as const;
