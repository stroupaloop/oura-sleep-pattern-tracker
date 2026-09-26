export const NOTES_PAGE_SIZE = 10;

export interface PageModel {
  /** 1-based, clamped into range. */
  page: number;
  pageCount: number;
  offset: number;
  limit: number;
  /** 1-based inclusive bounds of the visible slice; zeroes when empty. */
  from: number;
  to: number;
  total: number;
  hasPrev: boolean;
  hasNext: boolean;
}

/**
 * Resolves a page number that arrived from a query string, so a hand-edited
 * or stale `?page=` can never produce a negative offset or an empty screen
 * past the end of the list.
 */
export function buildPageModel(
  rawPage: unknown,
  total: number,
  pageSize = NOTES_PAGE_SIZE
): PageModel {
  const safeTotal = Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;
  const size = Math.max(1, Math.floor(pageSize));
  const pageCount = Math.max(1, Math.ceil(safeTotal / size));

  const parsed = Number(
    Array.isArray(rawPage) ? rawPage[0] : rawPage
  );
  const requested = Number.isFinite(parsed) ? Math.floor(parsed) : 1;
  const page = Math.min(Math.max(requested, 1), pageCount);

  const offset = (page - 1) * size;
  const from = safeTotal === 0 ? 0 : offset + 1;
  const to = Math.min(offset + size, safeTotal);

  return {
    page,
    pageCount,
    offset,
    limit: size,
    from,
    to,
    total: safeTotal,
    hasPrev: page > 1,
    hasNext: page < pageCount,
  };
}
