import {
  addDays,
  addMonths,
  dayKeyToDate,
  inMonth,
  localDayKey,
  monthOf,
  monthWeeks,
  sameMonth,
} from './calendar.util';

// Specs run in Europe/Sofia (UTC+3 in summer, UTC+2 from 25 Oct 2026).
describe('calendar utils', () => {
  describe('localDayKey', () => {
    it('keys a timestamp by its local (Sofia) day, not the UTC one', () => {
      expect(localDayKey('2026-10-31T22:30:00Z')).toBe('2026-11-01');
      expect(localDayKey('2026-10-31T21:59:00Z')).toBe('2026-10-31');
      expect(localDayKey('2026-06-30T21:30:00Z')).toBe('2026-07-01');
      expect(localDayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    });

    it('returns null for invalid dates', () => {
      expect(localDayKey('not a date')).toBeNull();
      expect(localDayKey(new Date(Number.NaN))).toBeNull();
    });
  });

  it('turns a key back into local midnight', () => {
    const date = dayKeyToDate('2026-03-09');
    expect([
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      date.getHours(),
    ]).toEqual([2026, 2, 9, 0]);
  });

  it('adds days across month, year and DST changes', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(addDays('2026-10-07', -7)).toBe('2026-09-30');
  });

  it('adds months across year ends in both directions', () => {
    expect(addMonths({ year: 2026, month: 11 }, 1)).toEqual({
      year: 2027,
      month: 0,
    });
    expect(addMonths({ year: 2026, month: 0 }, -1)).toEqual({
      year: 2025,
      month: 11,
    });
    expect(addMonths({ year: 2026, month: 5 }, -13)).toEqual({
      year: 2025,
      month: 4,
    });
    expect(addMonths({ year: 2026, month: 5 }, 0)).toEqual({
      year: 2026,
      month: 5,
    });
  });

  it('compares months and tells whether a day is in one', () => {
    expect(monthOf('2026-10-07')).toEqual({ year: 2026, month: 9 });
    expect(monthOf(new Date(2027, 1, 28))).toEqual({ year: 2027, month: 1 });
    expect(sameMonth({ year: 2026, month: 9 }, { year: 2026, month: 9 })).toBe(
      true,
    );
    expect(sameMonth({ year: 2026, month: 9 }, { year: 2025, month: 9 })).toBe(
      false,
    );
    expect(inMonth('2026-10-31', { year: 2026, month: 9 })).toBe(true);
    expect(inMonth('2026-11-01', { year: 2026, month: 9 })).toBe(false);
  });

  describe('monthWeeks', () => {
    const keys = (month: { year: number; month: number }) =>
      monthWeeks(month).map((week) => week.map((day) => day?.day ?? null));

    it('starts weeks on Monday and pads days outside the month with null', () => {
      // 1 Nov 2026 is a Sunday, 30 Nov a Monday.
      expect(keys({ year: 2026, month: 10 })).toEqual([
        [null, null, null, null, null, null, 1],
        [2, 3, 4, 5, 6, 7, 8],
        [9, 10, 11, 12, 13, 14, 15],
        [16, 17, 18, 19, 20, 21, 22],
        [23, 24, 25, 26, 27, 28, 29],
        [30, null, null, null, null, null, null],
      ]);
    });

    it('fits a 28-day February that starts on Monday into exactly four weeks', () => {
      expect(keys({ year: 2027, month: 1 })).toEqual([
        [1, 2, 3, 4, 5, 6, 7],
        [8, 9, 10, 11, 12, 13, 14],
        [15, 16, 17, 18, 19, 20, 21],
        [22, 23, 24, 25, 26, 27, 28],
      ]);
    });

    it('includes 29 February in a leap year', () => {
      const days = monthWeeks({ year: 2028, month: 1 })
        .flat()
        .filter((day) => day !== null);
      expect(days).toHaveLength(29);
      expect(days.at(-1)?.key).toBe('2028-02-29');
    });

    it('gives every day its local key and local-midnight date', () => {
      const days = monthWeeks({ year: 2026, month: 9 })
        .flat()
        .filter((day) => day !== null);
      expect(days.map((day) => day.key)).toEqual(
        Array.from(
          { length: 31 },
          (_, index) => `2026-10-${String(index + 1).padStart(2, '0')}`,
        ),
      );
      // 25 Oct 2026 is the DST change; its cell still starts at local midnight.
      const dstDay = days[24];
      expect([
        dstDay.key,
        dstDay.date.getDate(),
        dstDay.date.getHours(),
      ]).toEqual(['2026-10-25', 25, 0]);
    });
  });
});
