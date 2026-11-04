/**
 * Month-grid helpers for calendar views. Days are identified by local-date keys ("2026-10-07"), so a
 * training at 23:30 in Sofia lands on its local day, not on the UTC one.
 */

/** A month, with `month` 0-based as in `Date` (0 = January). */
export interface CalendarMonth {
  year: number;
  month: number;
}

export interface CalendarDay {
  /** Local date key, YYYY-MM-DD. */
  key: string;
  /** Local midnight of the day. */
  date: Date;
  /** Day of the month, 1–31. */
  day: number;
}

/** One row per week, Monday first; days outside the month are `null`. */
export type CalendarWeek = (CalendarDay | null)[];

/** Local date key (YYYY-MM-DD) of a date or ISO timestamp, or `null` when it isn't a valid date. */
export function localDayKey(value: Date | string): string | null {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
}

/** Local midnight of a YYYY-MM-DD key. */
export function dayKeyToDate(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** The key `delta` days after (or before) `key`, across month and year ends. */
export function addDays(key: string, delta: number): string {
  const date = dayKeyToDate(key);
  date.setDate(date.getDate() + delta);
  return localDayKey(date)!;
}

export function monthOf(value: Date | string): CalendarMonth {
  const date = typeof value === 'string' ? dayKeyToDate(value) : value;
  return { year: date.getFullYear(), month: date.getMonth() };
}

export function addMonths({ year, month }: CalendarMonth, delta: number): CalendarMonth {
  const index = year * 12 + month + delta;
  return { year: Math.floor(index / 12), month: ((index % 12) + 12) % 12 };
}

export function sameMonth(a: CalendarMonth, b: CalendarMonth): boolean {
  return a.year === b.year && a.month === b.month;
}

/** Whether a day key falls in the month. */
export function inMonth(key: string, month: CalendarMonth): boolean {
  return sameMonth(monthOf(key), month);
}

/** The month's weeks, Monday to Sunday, padded with `null` before the 1st and after the last day. */
export function monthWeeks({ year, month }: CalendarMonth): CalendarWeek[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // getDay(): 0 = Sunday … 6 = Saturday; shift so Monday is column 0.
  const leading = (new Date(year, month, 1).getDay() + 6) % 7;
  const cells: (CalendarDay | null)[] = Array.from({ length: leading }, () => null);

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    cells.push({ key: localDayKey(date)!, date, day });
  }
  while (cells.length % 7) {
    cells.push(null);
  }

  const weeks: CalendarWeek[] = [];
  for (let start = 0; start < cells.length; start += 7) {
    weeks.push(cells.slice(start, start + 7));
  }
  return weeks;
}
