/**
 * The holiday calendar: which occasions are on, worked out from the gym's calendar day
 * (Europe/Sofia), so the app changes by itself on the day, every year, without a deploy.
 *
 * | Occasion         | Window          |
 * |------------------|-----------------|
 * | December (snow)  | Dec 1 – Jan 6   |
 * | Advent calendar  | Dec 1 – Dec 31  |
 * | Christmas        | Dec 20 – Dec 27 |
 * | Year in review   | Dec 27 – Jan 10 |
 * | New Year         | Dec 31 – Jan 2  |
 * | Сурвачка         | Jan 1 – Jan 6   |
 *
 * Everything the holidays keep in the browser lives from Dec 1 to Jan 10 (`active`) and is
 * deleted outside it (see `holiday.service.ts`).
 */

export interface HolidayState {
  /** The year whose December this is (2026 for Dec 2026 and Jan 2027); null outside the season. */
  season: number | null;
  /** Dec 1 – Jan 10: the season, while anything holiday-related is shown or kept. */
  active: boolean;
  /** Dec 1 – Jan 6: snowfall and the snow caps. */
  december: boolean;
  /** Dec 1 – Dec 31: the Advent calendar. */
  advent: boolean;
  /** The last door that can be opened (1–24; 24 from Christmas Eve on); 0 outside Advent. */
  adventDay: number;
  /** Dec 20 – Dec 27. */
  christmas: boolean;
  /** Dec 27 – Jan 10. */
  yearInReview: boolean;
  /** Dec 31 – Jan 2. */
  newYear: boolean;
  /** Jan 1 – Jan 6. */
  survachka: boolean;
  /** How much snow lies on the headings, 0–1: it builds up to Christmas Eve and melts by Jan 7. */
  snowDepth: number;
}

const NONE: HolidayState = {
  season: null,
  active: false,
  december: false,
  advent: false,
  adventDay: 0,
  christmas: false,
  yearInReview: false,
  newYear: false,
  survachka: false,
  snowDepth: 0,
};

const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A real calendar day as 'YYYY-MM-DD', or null. */
export function parseDayKey(value: string | null | undefined): string | null {
  const match = DAY_KEY.exec(value ?? '');
  if (!match) {
    return null;
  }
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCMonth() === m - 1 && date.getUTCDate() === d
    ? value!
    : null;
}

const sofiaDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Sofia',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * The gym's calendar day at this moment, 'YYYY-MM-DD'. Intl is used here only to read the date in
 * the gym's time zone (nothing is shown with it), so a phone abroad still follows Sofia.
 */
export function sofiaDayKey(now: Date): string {
  return sofiaDay.format(now);
}

/** What is on for the day ('YYYY-MM-DD', the gym's calendar day). */
export function holidayState(dayKey: string): HolidayState {
  const match = DAY_KEY.exec(dayKey);
  if (!match) {
    return NONE;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const inDecember = month === 12;
  const inEarlyJanuary = month === 1 && day <= 10;
  if (!inDecember && !inEarlyJanuary) {
    return NONE;
  }
  const january = (last: number) => month === 1 && day <= last;
  return {
    season: inDecember ? year : year - 1,
    active: true,
    december: inDecember || january(6),
    advent: inDecember,
    adventDay: inDecember ? Math.min(day, 24) : 0,
    christmas: inDecember && day >= 20 && day <= 27,
    yearInReview: (inDecember && day >= 27) || january(10),
    newYear: (inDecember && day === 31) || january(2),
    survachka: january(6),
    snowDepth: inDecember
      ? Math.min(day, 24) / 24
      : january(6)
        ? (7 - day) / 7
        : 0,
  };
}
