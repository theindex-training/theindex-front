/**
 * The pure model behind `app-pagination`: page counts, the numbered buttons to show and the page
 * settings kept in the address (`?page=` and `?size=`). Pages are numbered from 1.
 */

/** The page sizes people can pick. The API's largest is 500 (settlement allocations). */
export const PAGE_SIZE_OPTIONS: readonly number[] = [25, 50, 100, 200];
export const DEFAULT_PAGE_SIZE = 50;

/** A numbered button, or a gap ("…") for the pages left out. */
export type PageItem = number | 'gap';

/** How many pages `total` rows fill; at least 1, so an empty list still has a page. */
export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/** `page` kept within 1 and the last page. */
export function clampPage(
  page: number,
  total: number,
  pageSize: number,
): number {
  return Math.min(Math.max(1, page), pageCount(total, pageSize));
}

/** The first row of `page`, counted from 0, as the API's `offset` takes it. */
export function pageOffset(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}

/** The rows `page` shows, counted from 1 (`from` 0 when there are none). */
export function pageRange(
  page: number,
  pageSize: number,
  total: number,
): { from: number; to: number } {
  if (!total) {
    return { from: 0, to: 0 };
  }
  const from = pageOffset(clampPage(page, total, pageSize), pageSize) + 1;
  return { from, to: Math.min(total, from + pageSize - 1) };
}

/** The rows of one page of a list the browser already has. */
export function pageSlice<T>(rows: readonly T[], page: number, size: number) {
  const offset = pageOffset(clampPage(page, rows.length, size), size);
  return rows.slice(offset, offset + size);
}

/**
 * The numbered buttons: always the first and the last page, the current one with `siblings` on
 * each side, and a gap for the rest. A gap never stands for a single page (that page is shown
 * instead), so the number of items stays the same wherever the current page is: 7 with one
 * sibling, once there are more than 7 pages.
 */
export function pageItems(
  page: number,
  count: number,
  siblings = 1,
): PageItem[] {
  // First, last, current, its siblings and two gaps.
  const slots = 2 * siblings + 5;
  if (count <= slots) {
    return range(1, count);
  }

  // The middle run: the current page and its siblings, slid inwards near either end so the
  // count stays the same. Page 2 and the page before the last are shown instead of a gap.
  const current = Math.min(Math.max(1, page), count);
  const start = Math.max(
    Math.min(current - siblings, count - 2 * siblings - 2),
    3,
  );
  const end = Math.min(
    Math.max(current + siblings, 2 * siblings + 3),
    count - 2,
  );

  return [
    1,
    start > 3 ? 'gap' : 2,
    ...range(start, end),
    end < count - 2 ? 'gap' : count - 1,
    count,
  ];
}

/** `?page=` as a page number: a whole number of 1 or more, else 1. */
export function parsePage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

/** `?size=` as a page size: one of the options, else the default. */
export function parsePageSize(
  value: string | null,
  options: readonly number[] = PAGE_SIZE_OPTIONS,
  fallback = DEFAULT_PAGE_SIZE,
): number {
  const size = Number(value);
  return value !== null && options.includes(size) ? size : fallback;
}

function range(from: number, to: number): number[] {
  return Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);
}
