import { holidayState, parseDayKey, sofiaDayKey } from './holiday-calendar';

describe('holidayState', () => {
  it('is off outside Dec 1 – Jan 10', () => {
    for (const day of ['2026-11-30', '2027-01-11', '2026-07-15']) {
      const state = holidayState(day);
      expect(state.active).toBe(false);
      expect(state.season).toBeNull();
      expect(state.december).toBe(false);
      expect(state.advent).toBe(false);
      expect(state.snowDepth).toBe(0);
    }
  });

  it('starts December, Advent and the snow on Dec 1', () => {
    const state = holidayState('2026-12-01');
    expect(state).toMatchObject({
      season: 2026,
      active: true,
      december: true,
      advent: true,
      adventDay: 1,
      christmas: false,
      newYear: false,
    });
    expect(state.snowDepth).toBeCloseTo(1 / 24);
  });

  it('builds the snow up to Christmas Eve, where every door can be opened', () => {
    expect(holidayState('2026-12-12').snowDepth).toBeCloseTo(0.5);
    expect(holidayState('2026-12-24')).toMatchObject({
      adventDay: 24,
      snowDepth: 1,
    });
    expect(holidayState('2026-12-30')).toMatchObject({
      advent: true,
      adventDay: 24,
      snowDepth: 1,
    });
  });

  it('has Christmas from Dec 20 to Dec 27', () => {
    expect(holidayState('2026-12-19').christmas).toBe(false);
    expect(holidayState('2026-12-20').christmas).toBe(true);
    expect(holidayState('2026-12-27').christmas).toBe(true);
    expect(holidayState('2026-12-28').christmas).toBe(false);
  });

  it('has New Year from Dec 31 to Jan 2 and the сурвачка from Jan 1 to Jan 6', () => {
    expect(holidayState('2026-12-30').newYear).toBe(false);
    expect(holidayState('2026-12-31')).toMatchObject({
      newYear: true,
      survachka: false,
      advent: true,
    });
    expect(holidayState('2027-01-01')).toMatchObject({
      season: 2026,
      newYear: true,
      survachka: true,
      advent: false,
      adventDay: 0,
    });
    expect(holidayState('2027-01-03').newYear).toBe(false);
    expect(holidayState('2027-01-06').survachka).toBe(true);
    expect(holidayState('2027-01-07').survachka).toBe(false);
  });

  it('melts the snow in the first week of January and ends December on Jan 6', () => {
    expect(holidayState('2027-01-01').snowDepth).toBeCloseTo(6 / 7);
    expect(holidayState('2027-01-06')).toMatchObject({ december: true });
    expect(holidayState('2027-01-06').snowDepth).toBeCloseTo(1 / 7);
    expect(holidayState('2027-01-07')).toMatchObject({
      december: false,
      snowDepth: 0,
      active: true,
    });
  });

  it('has the year in review from Dec 27 to Jan 10', () => {
    expect(holidayState('2026-12-26').yearInReview).toBe(false);
    expect(holidayState('2026-12-27').yearInReview).toBe(true);
    expect(holidayState('2027-01-10')).toMatchObject({
      yearInReview: true,
      active: true,
    });
  });

  it('is off for anything that is not a day', () => {
    expect(holidayState('soon').active).toBe(false);
  });
});

describe('sofiaDayKey', () => {
  it('reads the gym’s calendar day, not UTC', () => {
    // 23:30 UTC on Nov 30 is already Dec 1 in Sofia.
    expect(sofiaDayKey(new Date('2026-11-30T23:30:00Z'))).toBe('2026-12-01');
    expect(sofiaDayKey(new Date('2026-11-30T21:59:00Z'))).toBe('2026-11-30');
  });
});

describe('parseDayKey', () => {
  it('keeps real days only', () => {
    expect(parseDayKey('2026-12-24')).toBe('2026-12-24');
    expect(parseDayKey('2026-02-30')).toBeNull();
    expect(parseDayKey('24.12.2026')).toBeNull();
    expect(parseDayKey(null)).toBeNull();
  });
});
