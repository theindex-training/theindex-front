import { InjectionToken } from '@angular/core';

/**
 * "Now" for the holidays (HolidayService). The spec setup (src/test-providers.ts) provides a fixed
 * day outside the season, so specs of pages that show holiday extras (the dashboards, booking,
 * Records) don't change in December; holiday specs provide their own day. Kept in its own file
 * without other app imports, like INITIAL_LANGUAGE, so the spec providers file can import it.
 */
export const HOLIDAY_CLOCK = new InjectionToken<() => Date>('HOLIDAY_CLOCK', {
  providedIn: 'root',
  factory: () => () => new Date(),
});
