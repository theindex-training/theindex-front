import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TestClaims, TestRole, signInAs } from '../../testing/jwt';
import { YearInReview } from '../services/trainees.service';
import { HOLIDAY_CLOCK } from './holiday-clock.token';
import { YearInReviewComponent } from './year-in-review.component';

const dialogProto = HTMLDialogElement.prototype as unknown as Record<
  string,
  unknown
>;

const YEAR: YearInReview = {
  year: 2026,
  trainings: 96,
  firstTrainingOn: '2026-01-05',
  favouriteTime: { time: '07:00', count: 41 },
  longestStreakWeeks: 12,
  topTrainer: {
    id: 'tr-1',
    name: 'Ivan Petrov',
    count: 50,
    photoUrl: '/media-files/profile-photos/p1/s128.webp',
  },
  busiestMonth: { month: 10, count: 14 },
};

const EMPTY: YearInReview = {
  year: 2026,
  trainings: 0,
  firstTrainingOn: null,
  favouriteTime: null,
  longestStreakWeeks: 0,
  topTrainer: null,
  busiestMonth: null,
};

let http: HttpTestingController;

async function render(
  isoTime: string,
  role: TestRole = 'TRAINEE',
  claims?: TestClaims,
): Promise<ComponentFixture<YearInReviewComponent>> {
  signInAs(role, claims);
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: HOLIDAY_CLOCK, useValue: () => new Date(isoTime) },
    ],
  });
  http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(YearInReviewComponent);
  await fixture.whenStable();
  return fixture;
}

/** Answers the year in review request and checks the year asked for. */
async function answer(
  fixture: ComponentFixture<unknown>,
  year: number,
  body: YearInReview | null,
): Promise<void> {
  const request = http.expectOne(
    (req) => req.url === '/api/trainees/me/year-in-review',
  );
  expect(request.request.method).toBe('GET');
  expect(request.request.params.get('year')).toBe(String(year));
  if (body) {
    request.flush(body);
  } else {
    request.flush(
      { statusCode: 500, message: 'Boom' },
      { status: 500, statusText: 'Server Error' },
    );
  }
  await fixture.whenStable();
}

const el = (fixture: ComponentFixture<unknown>) =>
  fixture.nativeElement as HTMLElement;
const text = (fixture: ComponentFixture<unknown>, testId: string) =>
  el(fixture)
    .querySelector(`[data-testid="${testId}"]`)
    ?.textContent?.replace(/\s+/g, ' ')
    .trim();
const button = (fixture: ComponentFixture<unknown>, name: string) =>
  Array.from(el(fixture).querySelectorAll('button')).find(
    (item) =>
      item.textContent?.replace(/\s+/g, ' ').trim() === name ||
      item.getAttribute('aria-label') === name,
  )!;
/** The summary's rows, "label: value". */
const summary = (fixture: ComponentFixture<unknown>) =>
  Array.from(
    el(fixture).querySelectorAll('[data-testid="year-in-review-summary"] div'),
  ).map(
    (row) =>
      `${row.querySelector('dt')?.textContent?.trim()}: ${row.querySelector('dd')?.textContent?.trim()}`,
  );
const dialog = (fixture: ComponentFixture<unknown>) =>
  el(fixture).querySelector('dialog')!;

async function click(
  fixture: ComponentFixture<unknown>,
  target: HTMLElement,
): Promise<void> {
  target.click();
  await fixture.whenStable();
}

describe('YearInReviewComponent', () => {
  beforeEach(() => {
    localStorage.clear();
    dialogProto['showModal'] = function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
    dialogProto['close'] = function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    };
  });

  afterEach(() => {
    http.verify();
    delete dialogProto['showModal'];
    delete dialogProto['close'];
    document.documentElement.removeAttribute('data-holiday-snow');
  });

  it('asks for nothing and shows nothing before Dec 27', async () => {
    const fixture = await render('2026-12-26T20:00:00+02:00');
    http.expectNone(() => true);
    expect(text(fixture, 'year-in-review')).toBeUndefined();
  });

  it('asks for nothing for staff', async () => {
    const fixture = await render('2026-12-28T10:00:00+02:00', 'TRAINER');
    http.expectNone(() => true);
    expect(text(fixture, 'year-in-review')).toBeUndefined();
  });

  it('asks for nothing for a trainee token without a profile', async () => {
    const fixture = await render('2026-12-28T10:00:00+02:00', 'TRAINEE', {
      traineeProfileId: null,
    });
    http.expectNone(() => true);
    expect(text(fixture, 'year-in-review')).toBeUndefined();
  });

  it('asks for the season’s year in January too, until Jan 10', async () => {
    const fixture = await render('2027-01-10T23:30:00+02:00');
    await answer(fixture, 2026, YEAR);
    expect(text(fixture, 'year-in-review')).toContain('Your 2026');
  });

  it('shows no card for a year without trainings, or when the request fails', async () => {
    const empty = await render('2026-12-27T00:30:00+02:00');
    await answer(empty, 2026, EMPTY);
    expect(text(empty, 'year-in-review')).toBeUndefined();

    TestBed.resetTestingModule();
    const failed = await render('2026-12-28T10:00:00+02:00');
    await answer(failed, 2026, null);
    expect(text(failed, 'year-in-review')).toBeUndefined();
  });

  it('plays the year a slide at a time, then closes', async () => {
    const fixture = await render('2026-12-29T09:00:00+02:00');
    await answer(fixture, 2026, YEAR);
    expect(dialog(fixture).open).toBe(false);

    await click(fixture, button(fixture, 'Play your year'));
    expect(dialog(fixture).open).toBe(true);
    expect(dialog(fixture).getAttribute('aria-label')).toBe(
      'Your 2026 at The Index',
    );
    expect(text(fixture, 'year-in-review-position')).toBe('1 of 6');
    expect(text(fixture, 'year-in-review-slide')).toBe(
      '2026 at The Index 96 trainings Most people make New Year’s resolutions. You made reps. The first one: 5 Jan 2026',
    );
    expect(button(fixture, 'Back').disabled).toBe(true);

    await click(fixture, button(fixture, 'Next'));
    expect(text(fixture, 'year-in-review-slide')).toBe(
      'Your favourite hour 07:00 41 trainings at this time Early bird: the workout is done before most people’s first coffee.',
    );

    await click(fixture, button(fixture, 'Next'));
    expect(text(fixture, 'year-in-review-slide')).toBe(
      'Longest streak 12 weeks in a row with a training Consistency beats motivation, and you proved it.',
    );

    await click(fixture, button(fixture, 'Next'));
    expect(text(fixture, 'year-in-review-figure')).toBe('Ivan Petrov');
    expect(text(fixture, 'year-in-review-slide')).toContain(
      '50 trainings together',
    );
    expect(
      el(fixture).querySelector('.yir__slide img')?.getAttribute('src'),
    ).toBe(YEAR.topTrainer!.photoUrl);

    await click(fixture, button(fixture, 'Next'));
    expect(text(fixture, 'year-in-review-slide')).toBe(
      'Your strongest month October 14 trainings Whatever you did that month, keep doing it.',
    );

    await click(fixture, button(fixture, 'Next'));
    expect(text(fixture, 'year-in-review-position')).toBe('6 of 6');
    expect(summary(fixture)).toEqual([
      'Trainings: 96',
      'Favourite hour: 07:00',
      'Longest streak: 12 weeks',
      'Coach of the year: Ivan Petrov',
      'Strongest month: October',
    ]);
    expect(text(fixture, 'year-in-review-slide')).toContain(
      'See you at the gym in 2027. Even stronger.',
    );

    await click(fixture, button(fixture, 'Done'));
    expect(dialog(fixture).open).toBe(false);

    // Playing again starts over.
    await click(fixture, button(fixture, 'Play your year'));
    expect(text(fixture, 'year-in-review-position')).toBe('1 of 6');
  });

  it('skips what the year lacks', async () => {
    const fixture = await render('2026-12-29T09:00:00+02:00');
    await answer(fixture, 2026, {
      ...YEAR,
      trainings: 3,
      favouriteTime: null,
      longestStreakWeeks: 1,
      topTrainer: null,
    });
    await click(fixture, button(fixture, 'Play your year'));
    expect(text(fixture, 'year-in-review-position')).toBe('1 of 3');
    expect(text(fixture, 'year-in-review-slide')).toContain(
      'Every strong year starts with a first rep.',
    );
    await click(fixture, button(fixture, 'Next'));
    expect(text(fixture, 'year-in-review-figure')).toBe('October');
    await click(fixture, button(fixture, 'Next'));
    expect(summary(fixture)).toEqual([
      'Trainings: 3',
      'Strongest month: October',
    ]);
  });

  it('steps with the arrow keys, Back, and a tap on either side', async () => {
    const fixture = await render('2026-12-29T09:00:00+02:00');
    await answer(fixture, 2026, YEAR);
    await click(fixture, button(fixture, 'Play your year'));
    const key = async (name: string) => {
      dialog(fixture).dispatchEvent(
        new KeyboardEvent('keydown', { key: name, bubbles: true }),
      );
      await fixture.whenStable();
    };

    await key('ArrowRight');
    await key('ArrowRight');
    expect(text(fixture, 'year-in-review-position')).toBe('3 of 6');
    await key('ArrowLeft');
    expect(text(fixture, 'year-in-review-position')).toBe('2 of 6');
    await click(fixture, button(fixture, 'Back'));
    expect(text(fixture, 'year-in-review-position')).toBe('1 of 6');

    const slide = el(fixture).querySelector<HTMLElement>(
      '[data-testid="year-in-review-slide"]',
    )!;
    vi.spyOn(slide, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      width: 300,
    } as DOMRect);
    const tap = async (x: number) => {
      slide.dispatchEvent(
        new MouseEvent('click', { clientX: x, bubbles: true }),
      );
      await fixture.whenStable();
    };
    await tap(250);
    await tap(250);
    expect(text(fixture, 'year-in-review-position')).toBe('3 of 6');
    await tap(50);
    expect(text(fixture, 'year-in-review-position')).toBe('2 of 6');

    // The arrow key doesn't close the story at its end; only Done does.
    for (let i = 0; i < 6; i++) {
      await key('ArrowRight');
    }
    expect(text(fixture, 'year-in-review-position')).toBe('6 of 6');
    expect(dialog(fixture).open).toBe(true);
  });
});
