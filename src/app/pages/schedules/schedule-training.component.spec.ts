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
  TrainingAttendeeRow,
  TrainingBookingRow,
} from '../../services/schedules.service';
import { ScheduleTrainingComponent } from './schedule-training.component';

const texts = en.schedules.training;

function row(over: Partial<TrainingBookingRow>): TrainingBookingRow {
  return {
    traineeId: 'tr-x',
    name: 'Someone',
    nickname: null,
    photoUrl: null,
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

function attendee(over: Partial<TrainingAttendeeRow>): TrainingAttendeeRow {
  return {
    traineeId: 'tr-x',
    name: 'Someone',
    nickname: null,
    photoUrl: null,
    isActive: true,
    booked: true,
    paymentStatus: 'PAID',
    level: 'OK',
    subscription: {
      type: 'PUNCH',
      planTitle: 'Punch 16',
      remainingCredits: 4,
      endsAt: null,
      daysLeft: null,
    },
    ...over,
  };
}

/**
 * Friday 13 Nov, 18:00 in Sofia; the API's order (needing attention first). Ana booked and her
 * attendance is saved; Eli came without booking.
 */
const TRAINING: ScheduleTraining = {
  id: 'slot-fri',
  date: '2026-11-13',
  weekday: 5,
  trainingTime: { id: 'tt-18', startTime: '18:00:00', endTime: '19:00:00' },
  trainer: { id: 'trainer-v', name: 'Velcho', nickname: null, isActive: true },
  workout: {
    id: 'w-fran',
    title: 'Fran',
    summary: '21-15-9\nThrusters 43/30 kg\nPull-ups',
    exercises: [
      {
        id: 'ex-thruster',
        name: 'Thruster',
        description: 'Front squat\ninto a push press.',
        videoUrl: 'https://www.youtube.com/watch?v=L219ltL15zk',
      },
      { id: 'ex-pull', name: 'Pull-up', description: null, videoUrl: null },
    ],
  },
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
  attendees: [
    attendee({
      traineeId: 'tr-eli',
      name: 'Eli',
      booked: false,
      paymentStatus: 'UNPAID',
      level: 'UNPAID',
      subscription: null,
    }),
    attendee({ traineeId: 'tr-ana', name: 'Ana', nickname: 'Ani' }),
  ],
};

/** The same training before anyone's attendance is saved. */
const NOBODY_SAVED: ScheduleTraining = {
  ...TRAINING,
  trainees: TRAINING.trainees.map((t) =>
    t.traineeId === 'tr-ana'
      ? {
          ...t,
          attendanceSaved: false,
          subscription: { ...t.subscription!, remainingCredits: 4 },
        }
      : t,
  ),
  attendees: [],
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

  async function open(training: object = TRAINING, query = '') {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/workouts/schedule/slot-fri${query}`);
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
  /** Each row of a tab as "name | link | second line | chips"; both chip copies must agree. */
  const rowsOf = (testId: string) =>
    page.queryAll(`[data-testid="${testId}"]`).map((li) => {
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
  const rows = () => rowsOf('schedule-training-trainee');
  const attendeeRows = () => rowsOf('schedule-training-attendee');
  const chipCopiesAgree = () =>
    page
      .queryAll(
        '[data-testid="schedule-training-trainee"], [data-testid="schedule-training-attendee"]',
      )
      .every(
        (li) =>
          li.querySelector('.training__meta .training__chips')!.textContent ===
          li.querySelector('.training__trailing .training__chips')!.textContent,
      );

  const url = () => router.url;
  const tabLabels = () =>
    page
      .queryAll('app-segmented-control label')
      .map((label) => label.textContent.trim());
  const checkedTab = () =>
    page.query<HTMLInputElement>('app-segmented-control input:checked')!.value;
  /** Opens a tab the way a person does: the option's radio. */
  const openTab = (tab: 'attended' | 'booked') =>
    page.click(`app-segmented-control input[value="${tab}"]`);
  const summary = () =>
    page
      .query('[data-testid="schedule-training-summary"]')
      ?.textContent.replace(/\s+/g, ' ')
      .trim();

  it('opens on who attended once attendance is saved for the training, walk-ins marked', async () => {
    at('2026-11-13T17:30:00Z');
    await open();

    expect(tabLabels()).toEqual([
      `${texts.tabAttended} · 2`,
      `${texts.tabBooked} · 5`,
    ]);
    expect(checkedTab()).toBe('attended');
    expect(summary()).toBe('2 attended · 1 near the end or unpaid');
    expect(attendeeRows()).toEqual([
      `Eli | /trainees/tr-eli | ${texts.savedUnpaid} | ${texts.didntBook}, Unpaid`,
      `Ana Ani | /trainees/tr-ana | Punch 16 | 4 left`,
    ]);
    expect(chipCopiesAgree()).toBe(true);
    // Projection is about the booked list only.
    expect(
      page.query('[data-testid="schedule-training-projection"]'),
    ).toBeNull();
    expect(rows()).toEqual([]);
  });

  it('shows who booked on the other tab, marking those not registered while others are, and keeps the choice in the address', async () => {
    at('2026-11-13T17:30:00Z');
    await open();

    await openTab('booked');

    expect(url()).toBe('/workouts/schedule/slot-fri?tab=booked');
    expect(attendeeRows()).toEqual([]);
    expect(rows()).toEqual([
      `Cveta | /trainees/tr-cveta | No active subscription · ${texts.ifTheyCome} | ${texts.notRegistered}, Unpaid`,
      `Dimo | /trainees/tr-dimo | Punch 8 · ${texts.ifTheyCome} | ${texts.notRegistered}, Last paid training`,
      `Gosho | /trainees/tr-gosho | Punch 8 · ${texts.ifTheyCome} | Inactive, ${texts.notRegistered}, 2 left after it`,
      `Ana Ani | /trainees/tr-ana | Punch 16 · ${texts.attendanceSaved} | 4 left`,
      `Boris | /trainees/tr-boris | Month · Ends 12 Dec 2026 · ${texts.ifTheyCome} | ${texts.notRegistered}, 30 days left`,
    ]);
    expect(chipCopiesAgree()).toBe(true);

    await openTab('attended');
    expect(url()).toBe('/workouts/schedule/slot-fri?tab=attended');
    expect(attendeeRows()).toHaveLength(2);
  });

  it('opens on the tab in the address, e.g. back from a trainee', async () => {
    at('2026-11-13T17:30:00Z');
    await open(TRAINING, '?tab=booked');

    expect(checkedTab()).toBe('booked');
    expect(rows()).toHaveLength(5);
  });

  it('opens on who booked while nobody is registered, and says nobody came yet on the other tab', async () => {
    at('2026-11-13T11:00:00Z');
    await open(NOBODY_SAVED);

    expect(tabLabels()).toEqual([
      `${texts.tabAttended} · 0`,
      `${texts.tabBooked} · 5`,
    ]);
    expect(checkedTab()).toBe('booked');
    // No "Not registered" while nobody is: the training may not have happened yet.
    expect(page.text()).not.toContain(texts.notRegistered);

    await openTab('attended');
    expect(page.text()).toContain(texts.noAttendanceTitle);
    expect(page.text()).toContain(texts.noAttendanceMessage);
    expect(summary()).toBeUndefined();
  });

  it('shows the training and who booked it, each linking to their page with what they would have left', async () => {
    at('2026-11-13T11:00:00Z');
    await open(NOBODY_SAVED);

    expect(page.query('h1')!.textContent.trim()).toBe('Fran');
    expect(page.text()).toContain('Friday, 13 November 18:00 – 19:00');
    expect(details()).toEqual([
      `${texts.day}: Friday, 13 November`,
      `${texts.time}: 18:00 – 19:00`,
      `${texts.gym}: Center`,
      `${texts.trainer}: Velcho`,
      `${texts.bookings}: 5 booked`,
    ]);
    // No link to the workout's form: the page shows the workout itself.
    expect(page.query('a[href^="/workouts/w-fran"]')).toBeNull();
    expect(summary()).toBe('5 booked · 3 near the end or unpaid');
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
      `Ana Ani | /trainees/tr-ana | Punch 16 · ${texts.ifTheyCome} | 4 left after it`,
      `Boris | /trainees/tr-boris | Month · Ends 12 Dec 2026 · ${texts.ifTheyCome} | 30 days left`,
    ]);
    expect(chipCopiesAgree()).toBe(true);
    // Back to the training's week, in its gym.
    expect(page.query('app-page-header a')!.getAttribute('href')).toBe(
      '/workouts/schedule?gym=gym-c&week=2026-11-09',
    );
  });

  it('shows the workout as trainees see it: the summary with its line breaks, then the exercises in order', async () => {
    at('2026-11-13T11:00:00Z');
    await open();

    const workout = page.query('[data-testid="training-workout"]')!;
    expect(workout.querySelector('h2')!.textContent.trim()).toBe(
      en.traineeTraining.workoutTitle,
    );
    expect(
      page.query('[data-testid="training-workout-summary"]')!.textContent,
    ).toBe('21-15-9\nThrusters 43/30 kg\nPull-ups');
    const exercises = page.queryAll('[data-testid^="training-exercise-"]');
    expect(exercises.map((e) => e.querySelector('h4')!.textContent)).toEqual([
      'Thruster',
      'Pull-up',
    ]);
    expect(exercises[0].querySelector('p')!.textContent).toBe(
      'Front squat\ninto a push press.',
    );
    // The video as its play button, the exercise without one as text only.
    expect(
      exercises[0].querySelector('[data-testid="exercise-video-play"]'),
    ).not.toBeNull();
    expect(exercises[1].querySelector('app-exercise-video')).toBeNull();
  });

  it("shows each attendee's photo", async () => {
    const photo = 'https://media.test/profile-photos/eli/s128.webp';
    const [eli, ana] = TRAINING.attendees;
    await open({ ...TRAINING, attendees: [{ ...eli, photoUrl: photo }, ana] });

    const rows = page.queryAll('[data-testid="schedule-training-attendee"]');
    expect(rows[0].querySelector('img')?.getAttribute('src')).toBe(photo);
    expect(rows[1].querySelector('img')).toBeNull();
  });

  it("shows each booked trainee's photo, or initials without one", async () => {
    const photo = 'https://media.test/profile-photos/cveta/s128.webp';
    const [cveta, ...rest] = NOBODY_SAVED.trainees;
    await open({
      ...NOBODY_SAVED,
      trainees: [{ ...cveta, photoUrl: photo }, ...rest],
    });

    const rows = page.queryAll('[data-testid="schedule-training-trainee"]');
    expect(rows[0].querySelector('img')?.getAttribute('src')).toBe(photo);
    expect(rows[1].querySelector('img')).toBeNull();
    expect(rows[1].querySelector('app-avatar')?.textContent?.trim()).toBe('DI');
  });

  it('says when a saved attendance used the last training or was unpaid', async () => {
    at('2026-11-13T17:30:00Z');
    await open(
      {
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
      },
      '?tab=booked',
    );

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
    await open({
      ...TRAINING,
      workout: null,
      bookedCount: 0,
      trainees: [],
      attendees: [],
    });

    expect(page.query('h1')!.textContent.trim()).toBe(texts.title);
    expect(page.queryAll('[data-testid^="training-exercise-"]')).toEqual([]);
    expect(
      page.query('[data-testid="training-workout"]')!.textContent,
    ).toContain(texts.noWorkoutTitle);
    expect(page.text()).toContain(texts.noWorkoutMessage);
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
