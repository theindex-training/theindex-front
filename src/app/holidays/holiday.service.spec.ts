import { TestBed } from '@angular/core/testing';
import { HOLIDAY_CLOCK } from './holiday-clock.token';
import { HOLIDAY_STORAGE_KEY, HolidayService } from './holiday.service';

function serviceOn(isoTime: string): HolidayService {
  TestBed.configureTestingModule({
    providers: [{ provide: HOLIDAY_CLOCK, useValue: () => new Date(isoTime) }],
  });
  return TestBed.inject(HolidayService);
}

const stored = () =>
  JSON.parse(localStorage.getItem(HOLIDAY_STORAGE_KEY) ?? 'null') as unknown;

describe('HolidayService', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    document.documentElement.removeAttribute('data-holiday-snow');
    window.history.replaceState(null, '', '/');
  });

  it('follows the gym’s calendar day: Dec 1 starts at midnight in Sofia', () => {
    const service = serviceOn('2026-11-30T22:30:00Z'); // 00:30 on Dec 1 in Sofia
    expect(service.day()).toBe('2026-12-01');
    expect(service.state().december).toBe(true);
    expect(service.effects()).toBe(true);
  });

  it('marks <html> for the snow caps while December is on, with the depth of the day', () => {
    serviceOn('2026-12-12T10:00:00+02:00');
    TestBed.tick();
    const root = document.documentElement;
    expect(root.hasAttribute('data-holiday-snow')).toBe(true);
    expect(root.style.getPropertyValue('--holiday-snow-depth')).toBe('0.500');
  });

  it('shows nothing and keeps nothing outside the season', () => {
    localStorage.setItem(
      HOLIDAY_STORAGE_KEY,
      JSON.stringify({ season: 2026, effects: false, doors: [1, 2] }),
    );
    const service = serviceOn('2027-01-11T09:00:00+02:00');
    TestBed.tick();
    expect(service.state().active).toBe(false);
    expect(service.effects()).toBe(false);
    expect(document.documentElement.hasAttribute('data-holiday-snow')).toBe(
      false,
    );
    // Deleted without anyone doing anything.
    expect(localStorage.getItem(HOLIDAY_STORAGE_KEY)).toBeNull();
  });

  it('keeps the choices of this season until Jan 10', () => {
    localStorage.setItem(
      HOLIDAY_STORAGE_KEY,
      JSON.stringify({ season: 2026, effects: false, doors: [3] }),
    );
    const service = serviceOn('2027-01-10T20:00:00+02:00');
    expect(service.effectsOn()).toBe(false);
    expect(service.openedDoors()).toEqual([3]);
    expect(stored()).toEqual({ season: 2026, effects: false, doors: [3] });
  });

  it('starts a new season fresh: last year’s choices are dropped', () => {
    localStorage.setItem(
      HOLIDAY_STORAGE_KEY,
      JSON.stringify({ season: 2025, effects: false, doors: [1] }),
    );
    const service = serviceOn('2026-12-02T09:00:00+02:00');
    expect(service.effectsOn()).toBe(true);
    expect(service.openedDoors()).toEqual([]);
    expect(localStorage.getItem(HOLIDAY_STORAGE_KEY)).toBeNull();
  });

  it('stores the effects switch for the season', () => {
    const service = serviceOn('2026-12-05T09:00:00+02:00');
    service.setEffects(false);
    expect(service.effects()).toBe(false);
    expect(stored()).toEqual({ season: 2026, effects: false });
    service.setEffects(true);
    expect(service.effects()).toBe(true);
    expect(stored()).toEqual({ season: 2026 });
  });

  it('opens doors up to today only and remembers them', () => {
    const service = serviceOn('2026-12-05T09:00:00+02:00');
    expect(service.openDoor(6)).toBe(false);
    expect(service.openDoor(5)).toBe(true);
    expect(service.openDoor(2)).toBe(true);
    expect(service.openDoor(5)).toBe(true);
    expect(service.openedDoors()).toEqual([5, 2]);
    expect(stored()).toEqual({ season: 2026, doors: [5, 2] });
  });

  it('lets every door open from Christmas Eve to Dec 31, and none after', () => {
    expect(serviceOn('2026-12-28T09:00:00+02:00').canOpenDoor(24)).toBe(true);
    TestBed.resetTestingModule();
    expect(serviceOn('2027-01-01T09:00:00+02:00').canOpenDoor(1)).toBe(false);
  });

  it('celebrates a booking or a personal best with December’s line', () => {
    const service = serviceOn('2026-12-05T09:00:00+02:00');
    service.celebrate('book');
    expect(service.celebration()).toEqual({
      id: 1,
      key: 'holidays.celebrate.bookDecember',
    });
    service.celebrate('personalBest');
    expect(service.celebration()).toEqual({
      id: 2,
      key: 'holidays.celebrate.personalBestDecember',
    });
  });

  it('celebrates nothing with the effects off or outside December', () => {
    const service = serviceOn('2026-12-05T09:00:00+02:00');
    service.setEffects(false);
    service.celebrate('book');
    expect(service.celebration()).toBeNull();

    TestBed.resetTestingModule();
    const november = serviceOn('2026-11-20T09:00:00+02:00');
    november.celebrate('book');
    expect(november.celebration()).toBeNull();
  });

  it('previews ?holidayDate= without storing anything', () => {
    localStorage.setItem(
      HOLIDAY_STORAGE_KEY,
      JSON.stringify({ season: 2026, doors: [1] }),
    );
    window.history.replaceState(null, '', '/home?holidayDate=2026-12-24');
    const service = serviceOn('2026-11-20T09:00:00+02:00');
    expect(service.day()).toBe('2026-12-24');
    expect(service.state().adventDay).toBe(24);
    expect(service.openedDoors()).toEqual([]);
    service.openDoor(24);
    expect(service.openedDoors()).toEqual([24]);
    expect(stored()).toEqual({ season: 2026, doors: [1] });
  });

  it('ignores a ?holidayDate= that is not a day', () => {
    window.history.replaceState(null, '', '/home?holidayDate=xmas');
    const service = serviceOn('2026-11-20T09:00:00+02:00');
    expect(service.previewDay).toBeNull();
    expect(service.state().active).toBe(false);
  });
});
