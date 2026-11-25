import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TestRole, signInAs } from '../../testing/jwt';
import { HOLIDAY_CLOCK } from './holiday-clock.token';
import {
  GIFT_OPEN_DELAY,
  HolidayGiftComponent,
} from './holiday-gift.component';
import { HOLIDAY_STORAGE_KEY, HolidayService } from './holiday.service';

const dialogProto = HTMLDialogElement.prototype as unknown as Record<
  string,
  unknown
>;

/** The gift on a page (`url`) on a day, for a role. */
async function render(
  isoTime: string,
  url: string,
  role: TestRole = 'TRAINEE',
): Promise<ComponentFixture<HolidayGiftComponent>> {
  signInAs(role);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: '**', children: [] }]),
      { provide: HOLIDAY_CLOCK, useValue: () => new Date(isoTime) },
      { provide: GIFT_OPEN_DELAY, useValue: 0 },
    ],
  });
  await TestBed.inject(Router).navigateByUrl(url);
  const fixture = TestBed.createComponent(HolidayGiftComponent);
  await fixture.whenStable();
  return fixture;
}

const gift = (fixture: ComponentFixture<unknown>) =>
  (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
    '[data-testid="holiday-gift"]',
  );
const dialog = (fixture: ComponentFixture<unknown>) =>
  (fixture.nativeElement as HTMLElement).querySelector('dialog')!;

describe('HolidayGiftComponent', () => {
  beforeEach(() => {
    localStorage.clear();
    dialogProto['showModal'] = function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
    dialogProto['close'] = function (this: HTMLDialogElement) {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };
  });

  afterEach(() => {
    delete dialogProto['showModal'];
    delete dialogProto['close'];
    document.documentElement.removeAttribute('data-holiday-snow');
  });

  it('hides on today’s page only', async () => {
    // Dec 22: a trainee's gift is on Records.
    const records = await render(
      '2026-12-22T10:00:00+02:00',
      '/records?tab=mine',
    );
    expect(gift(records)?.getAttribute('aria-label')).toBe(
      'A gift is hiding here. Open it',
    );
    TestBed.resetTestingModule();
    const home = await render('2026-12-22T10:00:00+02:00', '/home');
    expect(gift(home)).toBeNull();
  });

  it('opens with the day’s greeting, then is gone for the day', async () => {
    const fixture = await render('2026-12-22T10:00:00+02:00', '/records');
    gift(fixture)!.click();
    await fixture.whenStable();

    expect(dialog(fixture).hasAttribute('open')).toBe(true);
    expect(
      (fixture.nativeElement as HTMLElement)
        .querySelector('[data-testid="holiday-gift-text"]')
        ?.textContent?.trim(),
    ).toBe(
      'Sarmi are carbs. Carbs are fuel. Fuel is for training. You know what to do.',
    );
    expect(TestBed.inject(HolidayService).celebration()?.burst).toBe(
      'confetti',
    );
    expect(JSON.parse(localStorage.getItem(HOLIDAY_STORAGE_KEY)!)).toEqual({
      season: 2026,
      gifts: [22],
    });

    (
      (fixture.nativeElement as HTMLElement).querySelector(
        '.gift-dialog .btn',
      ) as HTMLButtonElement
    ).click();
    await fixture.whenStable();
    expect(dialog(fixture).hasAttribute('open')).toBe(false);
    expect(gift(fixture)).toBeNull();
  });

  it('stays found after a reload', async () => {
    localStorage.setItem(
      HOLIDAY_STORAGE_KEY,
      JSON.stringify({ season: 2026, gifts: [22] }),
    );
    const fixture = await render('2026-12-22T10:00:00+02:00', '/records');
    expect(gift(fixture)).toBeNull();
  });

  it('hides on the staff’s own pages', async () => {
    const fixture = await render(
      '2026-12-21T10:00:00+02:00',
      '/workouts/schedule',
      'TRAINER',
    );
    expect(gift(fixture)).not.toBeNull();
  });

  it('isn’t there with the effects off or outside Christmas', async () => {
    localStorage.setItem(
      HOLIDAY_STORAGE_KEY,
      JSON.stringify({ season: 2026, effects: false }),
    );
    const off = await render('2026-12-20T10:00:00+02:00', '/home');
    expect(gift(off)).toBeNull();

    TestBed.resetTestingModule();
    localStorage.clear();
    const before = await render('2026-12-19T10:00:00+02:00', '/home');
    expect(gift(before)).toBeNull();
  });
});
