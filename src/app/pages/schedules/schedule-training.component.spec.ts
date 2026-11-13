import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import en from '../../../../public/i18n/en.json';
import { PageDriver, apiError, driver } from '../../../testing/dom';
import { signInAs } from '../../../testing/jwt';
import {
  ScheduleTraining,
  TrainingBookingRow,
} from '../../services/schedules.service';
import { ScheduleTrainingComponent } from './schedule-training.component';

const texts = en.schedules.training;

function row(over: Partial<TrainingBookingRow>): TrainingBookingRow {
  return {
    traineeId: 'tr-x',
    name: 'Someone',
    nickname: null,
    isActive: true,
    bookedAt: '2026-11-10T08:00:00Z',
    attendanceSaved: false,
    paymentStatus: 'PAID',
    level: 'OK',
    subscription: {
      type: 'PUNCH',
      planTitle: 'Punch 16',
      remainingCredits: 9,
      endsAt: null,
      daysLeft: null,
    },
    ...over,
  };
}

/** Friday 13 Nov, 18:00 in Sofia; the API's order (needing attention first). */
const TRAINING: ScheduleTraining = {
  id: 'slot-fri',
  date: '2026-11-13',
  weekday: 5,
  trainingTime: { id: 'tt-18', startTime: '18:00:00', endTime: '19:00:00' },
  trainer: { id: 'trainer-v', name: 'Velcho', nickname: null, isActive: true },
  workout: { id: 'w-fran', title: 'Fran' },
  bookedCount: 5,
  gym: { id: 'gym-c', name: 'Center' },
  weekStart: '2026-11-09',
  startsAt: '2026-11-13T16:00:00Z',
  trainees: [
    row({
      traineeId: 'tr-cveta',
      name: 'Cveta',
      paymentStatus: 'UNPAID',
      level: 'UNPAID',
      subscription: null,
    }),
    row({
      traineeId: 'tr-dimo',
      name: 'Dimo',
      level: 'LAST',
      subscription: {
        type: 'PUNCH',
        planTitle: 'Punch 8',
        remainingCredits: 0,
        endsAt: null,
        daysLeft: null,
      },
    }),
    row({
      traineeId: 'tr-gosho',
      name: 'Gosho',
      isActive: false,
      level: 'LOW',
      subscription: {
        type: 'PUNCH',
        planTitle: 'Punch 8',
        remainingCredits: 2,
        endsAt: null,
        daysLeft: null,
      },
    }),
    row({
      traineeId: 'tr-ana',
      name: 'Ana',
      nickname: 'Ani',
      attendanceSaved: true,
      subscription: {
        type: 'PUNCH',
        planTitle: 'Punch 16',
        remainingCredits: 4,
        endsAt: null,
        daysLeft: null,
      },
    }),
    row({
      traineeId: 'tr-boris',
      name: 'Boris',
      subscription: {
        type: 'TIME',
        planTitle: 'Month',
        remainingCredits: null,
        endsAt: '2026-12-12T10:00:00Z',
        daysLeft: 30,
      },
    }),
  ],
};

describe('ScheduleTrainingComponent', () => {
  let http: HttpTestingController;
  let router: Router;
  let page: PageDriver;

  /** Fakes "now" (only `Date`); the default is 13:00 on the training's day in Sofia. */
  function at(now: string) {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(now) });
  }

  beforeEach(() => {
    localStorage.clear();
    signInAs('TRAINER', { trainerProfileId: 'trainer-v' });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          {
            path: 'workouts/schedule/:id',
            component: ScheduleTrainingComponent,
          },
          { path: '**', children: [] },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  async function open(training: object = TRAINING) {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/workouts/schedule/slot-fri');
    page = driver(
      () => harness.routeNativeElement!,
      () => harness.fixture.whenStable(),
    );
    await page.settle();
    const request = http.expectOne('/api/schedules/slots/slot-fri');
    expect(request.request.method).toBe('GET');
    request.flush(training);
    await page.settle();
  }

  const details = () =>
    page
      .queryAll('.detail-list > div')
      .map(
        (pair) =>
          `${pair.querySelector('dt')!.textContent.trim()}: ${pair
            .querySelector('dd')!
            .textContent.replace(/\s+/g, ' ')
            .trim()}`,
      );
  /** Each booked trainee as "name | link | second line | chips"; both chip copies must agree. */
  const rows = () =>
    page.queryAll('[data-testid="schedule-training-trainee"]').map((li) => {
      const link = li.querySelector('a')!;
      return [
        li
          .querySelector('.list-row__title')!
          .textContent.replace(/\s+/g, ' ')
          .trim(),
        link.getAttribute('href'),
        li
          .querySelector('.training__meta > span:last-child')!
          .textContent.trim(),
        // The chips show on the second line on phones and at the end of the row from 768px.
        Array.from(li.querySelectorAll('.training__trailing app-chip'), (c) =>
          c.textContent.trim(),
        ).join(', '),
      ].join(' | ');
    });
  const chipCopiesAgree = () =>
    page
      .queryAll('[data-testid="schedule-training-trainee"]')
      .every(
        (li) =>
          li.querySelector('.training__meta .training__chips')!.textContent ===
          li.querySelector('.training__trailing .training__chips')!.textContent,
      );

  it('shows the training and who booked it, each linking to their page with what they would have left', async () => {
    at('2026-11-13T11:00:00Z');
    await open();

    expect(page.query('h1')!.textContent.trim()).toBe('Fran');
    expect(page.text()).toContain('Friday, 13 November 18:00 – 19:00');
    expect(details()).toEqual([
      `${texts.day}: Friday, 13 November`,
      `${texts.time}: 18:00 – 19:00`,
      `${texts.gym}: Center`,
      `${texts.trainer}: Velcho`,
      `${texts.workout}: Fran`,
      `${texts.bookings}: 5 booked`,
    ]);
    expect(
      page
        .query('[data-testid="schedule-training-booked"] .section-header__sub')!
        .textContent.replace(/\s+/g, ' ')
        .trim(),
    ).toBe('5 booked · 3 near the end or unpaid');
    // The figures are explained as a projection.
    expect(
      page
        .query('[data-testid="schedule-training-projection"]')!
        .textContent.trim(),
    ).toBe(texts.projectionNote);
    expect(rows()).toEqual([
      `Cveta | /trainees/tr-cveta | No active subscription · ${texts.ifTheyCome} | Unpaid`,
      `Dimo | /trainees/tr-dimo | Punch 8 · ${texts.ifTheyCome} | Last paid training`,
      `Gosho | /trainees/tr-gosho | Punch 8 · ${texts.ifTheyCome} | Inactive, 2 left after it`,
      `Ana Ani | /trainees/tr-ana | Punch 16 · ${texts.attendanceSaved} | 4 left`,
      `Boris | /trainees/tr-boris | Month · Ends 12 Dec 2026 · ${texts.ifTheyCome} | 30 days left`,
    ]);
    expect(chipCopiesAgree()).toBe(true);
    // Back to the training's week, in its gym.
    expect(page.query('app-page-header a')!.getAttribute('href')).toBe(
      '/workouts/schedule?gym=gym-c&week=2026-11-09',
    );
  });

  it('says when a saved attendance used the last training or was unpaid', async () => {
    at('2026-11-13T17:30:00Z');
    await open({
      ...TRAINING,
      trainees: [
        row({
          traineeId: 'tr-a',
          name: 'Ana',
          attendanceSaved: true,
          paymentStatus: 'UNPAID',
          level: 'UNPAID',
          subscription: null,
        }),
        row({
          traineeId: 'tr-d',
          name: 'Dimo',
          attendanceSaved: true,
          level: 'LAST',
          subscription: {
            type: 'PUNCH',
            planTitle: 'Punch 8',
            remainingCredits: 0,
            endsAt: null,
            daysLeft: null,
          },
        }),
      ],
    });

    expect(rows()).toEqual([
      `Ana | /trainees/tr-a | ${texts.savedUnpaid} · ${texts.attendanceSaved} | Unpaid`,
      `Dimo | /trainees/tr-d | Punch 8 · ${texts.attendanceSaved} | ${texts.noneLeft}`,
    ]);
  });

  it("links Register attendance from the training's day, filled in with it and the booked trainees still to save", async () => {
    at('2026-11-13T11:00:00Z');
    await open();

    const register = page.query<HTMLAnchorElement>(
      '[data-testid="schedule-training-register"]',
    )!;
    expect(register.textContent.trim()).toBe(en.nav.registerAttendance);
    // Not Gosho (inactive: Register attendance can't save him) nor Ana (already saved).
    const url = router.parseUrl(register.getAttribute('href')!);
    expect(url.root.children['primary'].toString()).toBe('attendance/new');
    expect(url.queryParams).toEqual({
      date: '2026-11-13',
      time: '18:00',
      trainer: 'trainer-v',
      gym: 'gym-c',
      trainees: 'tr-cveta,tr-dimo,tr-boris',
    });
    expect(page.text()).toContain(texts.registerHint);
  });

  it('offers no Register attendance before the training day', async () => {
    // 23:30 on Thursday 12 Nov in Sofia: the next day in UTC terms is still the 12th locally.
    at('2026-11-12T21:30:00Z');
    await open();

    expect(page.query('[data-testid="schedule-training-register"]')).toBeNull();
    expect(page.text()).toContain(texts.registerFromDay);
  });

  it('shows a training nobody booked, and one without a workout', async () => {
    at('2026-11-13T11:00:00Z');
    await open({ ...TRAINING, workout: null, bookedCount: 0, trainees: [] });

    expect(page.query('h1')!.textContent.trim()).toBe(texts.title);
    expect(details()).toContain(`${texts.workout}: ${texts.noWorkout}`);
    expect(page.text()).toContain(texts.noBookingsTitle);
    expect(
      page.query('[data-testid="schedule-training-projection"]'),
    ).toBeNull();
    const register = page.query<HTMLAnchorElement>(
      '[data-testid="schedule-training-register"]',
    )!;
    expect(router.parseUrl(register.getAttribute('href')!).queryParams).toEqual(
      {
        date: '2026-11-13',
        time: '18:00',
        trainer: 'trainer-v',
        gym: 'gym-c',
      },
    );
  });

  it("shows the API's error with Try again, which loads it again", async () => {
    at('2026-11-13T11:00:00Z');
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/workouts/schedule/slot-fri');
    page = driver(
      () => harness.routeNativeElement!,
      () => harness.fixture.whenStable(),
    );
    await page.settle();
    const missing = apiError('Schedule slot not found', 404);
    http
      .expectOne('/api/schedules/slots/slot-fri')
      .flush(missing.body, missing.options);
    await page.settle();

    expect(page.alert()).toContain('Schedule slot not found');

    await page.click('[role="alert"] button');
    http.expectOne('/api/schedules/slots/slot-fri').flush(TRAINING);
    await page.settle();

    expect(page.query('h1')!.textContent.trim()).toBe('Fran');
  });
});
