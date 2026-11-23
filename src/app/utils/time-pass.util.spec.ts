import { localDayKey } from './calendar.util';
import { timePassLastDay } from './time-pass.util';

describe('timePassLastDay', () => {
  it('a pass ending at midnight (a month plan) ends on the day before', () => {
    // Dec 23 00:00 in Sofia, the specs' timezone.
    expect(localDayKey(timePassLastDay('2026-12-22T22:00:00.000Z')!)).toBe(
      '2026-12-22',
    );
  });

  it('a pass ending later in the day (a day plan, 02:00) keeps that day', () => {
    expect(localDayKey(timePassLastDay('2026-12-23T00:00:00.000Z')!)).toBe(
      '2026-12-23',
    );
  });

  it('is null without a valid end', () => {
    expect(timePassLastDay(null)).toBeNull();
    expect(timePassLastDay(undefined)).toBeNull();
    expect(timePassLastDay('not a date')).toBeNull();
  });
});
