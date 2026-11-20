import {
  DEFAULT_PAGE_SIZE,
  clampPage,
  pageCount,
  pageItems,
  pageOffset,
  pageRange,
  pageSlice,
  parsePage,
  parsePageSize,
} from './pagination';

describe('pagination', () => {
  it('counts the pages rows fill, with one page for no rows', () => {
    expect(pageCount(0, 50)).toBe(1);
    expect(pageCount(50, 50)).toBe(1);
    expect(pageCount(51, 50)).toBe(2);
    expect(pageCount(4812, 50)).toBe(97);
  });

  it('keeps a page within the first and the last', () => {
    expect(clampPage(0, 120, 50)).toBe(1);
    expect(clampPage(2, 120, 50)).toBe(2);
    expect(clampPage(9, 120, 50)).toBe(3);
    expect(clampPage(4, 0, 50)).toBe(1);
  });

  it("gives a page's offset and the rows it shows", () => {
    expect(pageOffset(1, 50)).toBe(0);
    expect(pageOffset(3, 50)).toBe(100);
    expect(pageRange(1, 50, 4812)).toEqual({ from: 1, to: 50 });
    expect(pageRange(97, 50, 4812)).toEqual({ from: 4801, to: 4812 });
    // A page past the end shows the last one.
    expect(pageRange(200, 50, 120)).toEqual({ from: 101, to: 120 });
    expect(pageRange(1, 50, 0)).toEqual({ from: 0, to: 0 });
  });

  it('cuts one page out of a list the browser has, the last one for a page past the end', () => {
    const rows = Array.from({ length: 7 }, (_, i) => i + 1);
    expect(pageSlice(rows, 1, 3)).toEqual([1, 2, 3]);
    expect(pageSlice(rows, 3, 3)).toEqual([7]);
    expect(pageSlice(rows, 9, 3)).toEqual([7]);
    expect(pageSlice([], 2, 3)).toEqual([]);
  });

  describe('numbered buttons', () => {
    it('lists every page when they fit', () => {
      expect(pageItems(1, 1)).toEqual([1]);
      expect(pageItems(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });

    it('keeps the first, the last, the current page and its neighbours, with gaps between', () => {
      expect(pageItems(1, 97)).toEqual([1, 2, 3, 4, 5, 'gap', 97]);
      expect(pageItems(4, 97)).toEqual([1, 2, 3, 4, 5, 'gap', 97]);
      expect(pageItems(5, 97)).toEqual([1, 'gap', 4, 5, 6, 'gap', 97]);
      expect(pageItems(50, 97)).toEqual([1, 'gap', 49, 50, 51, 'gap', 97]);
      expect(pageItems(94, 97)).toEqual([1, 'gap', 93, 94, 95, 96, 97]);
      expect(pageItems(97, 97)).toEqual([1, 'gap', 93, 94, 95, 96, 97]);
    });

    it('never puts a gap where a single page would do', () => {
      expect(pageItems(1, 8)).toEqual([1, 2, 3, 4, 5, 'gap', 8]);
      expect(pageItems(5, 8)).toEqual([1, 'gap', 4, 5, 6, 7, 8]);
      for (let page = 1; page <= 30; page++) {
        const items = pageItems(page, 30);
        expect(items).toHaveLength(7);
        expect(items).toContain(page);
        items.forEach((item, i) => {
          if (item === 'gap') {
            const before = items[i - 1] as number;
            const after = items[i + 1] as number;
            expect(after - before).toBeGreaterThan(2);
          }
        });
      }
    });

    it('takes the number of neighbours to show', () => {
      expect(pageItems(10, 20, 0)).toEqual([1, 'gap', 10, 'gap', 20]);
      expect(pageItems(10, 20, 2)).toEqual([
        1,
        'gap',
        8,
        9,
        10,
        11,
        12,
        'gap',
        20,
      ]);
    });
  });

  it('reads the page from the address, 1 for anything else', () => {
    expect(parsePage('3')).toBe(3);
    expect(parsePage(null)).toBe(1);
    expect(parsePage('0')).toBe(1);
    expect(parsePage('-2')).toBe(1);
    expect(parsePage('2.5')).toBe(1);
    expect(parsePage('abc')).toBe(1);
  });

  it('reads the page size from the address, the default for a size not offered', () => {
    expect(parsePageSize('100')).toBe(100);
    expect(parsePageSize(null)).toBe(DEFAULT_PAGE_SIZE);
    expect(parsePageSize('')).toBe(DEFAULT_PAGE_SIZE);
    expect(parsePageSize('37')).toBe(DEFAULT_PAGE_SIZE);
    expect(parsePageSize('500')).toBe(DEFAULT_PAGE_SIZE);
    expect(DEFAULT_PAGE_SIZE).toBe(50);
  });
});
