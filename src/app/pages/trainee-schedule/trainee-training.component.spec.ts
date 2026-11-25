import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { firstValueFrom } from 'rxjs';
import en from '../../../../public/i18n/en.json';
import { LanguageService } from '../../i18n/language.service';
import { PageDriver, apiError, driver } from '../../../testing/dom';
import { signInAs } from '../../../testing/jwt';
import { TraineeTrainingComponent } from './trainee-training.component';
import { HOLIDAY_CLOCK } from '../../holidays/holiday-clock.token';
import { HolidayService } from '../../holidays/holiday.service';

const texts = en.traineeTraining;
const schedule = en.traineeSchedule;
const booked = en.traineeBooked;
const calendar = en.googleCalendar;

const WORKOUT = {
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
};
/** Seen at 00:30 on Friday 13 Nov in Sofia (22:30Z on the 12th): it starts at 18:00. */
const TRAINING = {
  id: 't-fri',
  date: '2026-11-13',
  weekday: 5,
  trainingTime: { startTime: '18:00:00', endTime: '19:00:00' },
  trainer: { name: 'Velcho Sokolov', nickname: null },
  gym: { id: 'gym-c', name: 'Center', address: null },
  workout: WORKOUT,
  workoutReleasesAt: '2026-11-12T18:00:00Z',
  startsAt: '2026-11-13T16:00:00Z',
  endsAt: '2026-11-13T17:00:00Z',
  calendarToken: null,
  bookedCount: 3,
  bookedByMe: false,
  bookingClosesAt: '2026-11-13T15:30:00Z',
  cancelUntil: '2026-11-13T15:00:00Z',
  canBook: true,
  canCancel: false,
};
/** What POST and DELETE /api/bookings answer: the workout by its title only. */
const answer = (over: object) => ({
  ...TRAINING,
  gym: undefined,
  workout: { title: 'Fran' },
  ...over,
});

describe('TraineeTrainingComponent', () => {
  let http: HttpTestingController;
  let router: Router;
  let page: PageDriver;
  /** The holidays' "now" (outside them unless a test says otherwise). */
  let holidayNow: Date;

  beforeEach(() => {
    holidayNow = new Date('2026-11-12T22:30:00Z');
    vi.useFakeTimers({
      toFake: ['Date'],
      now: new Date('2026-11-12T22:30:00Z'),
    });
    localStorage.clear();
    signInAs('TRAINEE', { traineeProfileId: 'trainee-1' });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'schedule/:id', component: TraineeTrainingComponent },
          {
            path: 'schedule/:id/booked',
            component: TraineeTrainingComponent,
            data: { confirmation: true },
          },
          { path: '**', children: [] },
        ]),
        { provide: HOLIDAY_CLOCK, useValue: () => holidayNow },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  async function open(training: object = TRAINING, url = '/schedule/t-fri') {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    page = driver(
      () => harness.routeNativeElement!,
      () => harness.fixture.whenStable(),
    );
    await page.settle();
    const request = http.expectOne('/api/bookings/trainings/t-fri');
    expect(request.request.method).toBe('GET');
    request.flush(training);
    await page.settle();
  }

  /** "Label: value" for each pair of the booking panel. */
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
  const actionButton = () =>
    page.query<HTMLButtonElement>(
      '[data-testid="trainee-training-booking"] .form-actions button',
    );
  const calendarLink = () =>
    page.query<HTMLAnchorElement>('[data-testid="google-calendar-button"]');
  const calendarEvent = () =>
    Object.fromEntries(new URL(calendarLink()!.href).searchParams);
  const trainingPage = () => new URL('/schedule/t-fri', document.baseURI).href;
  const appleLink = () =>
    page.query<HTMLAnchorElement>('[data-testid="apple-calendar-button"]');
  /** The Apple button's decorative tile: [weekday, day]. */
  const appleTile = () =>
    Array.from(
      appleLink()!.querySelectorAll('[aria-hidden="true"] > span'),
      (part) => part.textContent.trim(),
    );
  /** The Apple button's text, without the decorative tile. */
  const appleText = () =>
    Array.from(appleLink()!.children)
      .filter((child) => child.getAttribute('aria-hidden') !== 'true')
      .map((child) => child.textContent.replace(/\s+/g, ' ').trim())
      .join(' ');
  const BOOKED = {
    ...TRAINING,
    calendarToken: 'cal.token-1',
    bookedCount: 4,
    bookedByMe: true,
    canBook: false,
    canCancel: true,
  };

  it('shows when and where, the bookings and the whole workout', async () => {
    await open();

    expect(page.query('h1')!.textContent.trim()).toBe('Fran');
    expect(page.text()).toContain('Friday, 13 November 18:00 – 19:00');
    expect(details()).toEqual([
      `${texts.day}: Friday, 13 November`,
      `${texts.time}: 18:00 – 19:00`,
      `${texts.gym}: Center`,
      `${texts.trainer}: Velcho Sokolov`,
      `${texts.bookings}: 3 booked`,
      `${texts.yourBooking}: ${texts.notBooked}`,
    ]);
    // The summary keeps its line breaks (white-space: pre-line).
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
    expect(exercises[0].querySelector('a')!.getAttribute('href')).toBe(
      'https://www.youtube.com/watch?v=L219ltL15zk',
    );
    // No description and no video: just the name.
    expect(exercises[1].querySelector('p, app-exercise-video')).toBeNull();
  });

  it('plays an exercise video in place, from youtube-nocookie.com', async () => {
    await open();
    const thruster = page.query(
      '[data-testid="training-exercise-ex-thruster"]',
    )!;
    const play = thruster.querySelector<HTMLButtonElement>(
      '[data-testid="exercise-video-play"]',
    )!;
    expect(play.getAttribute('aria-label')).toBe('Play the video: Thruster');
    expect(thruster.querySelector('iframe')).toBeNull();

    play.click();
    await page.settle();

    const player = thruster.querySelector('iframe')!;
    expect(player.getAttribute('src')).toBe(
      'https://www.youtube-nocookie.com/embed/L219ltL15zk?autoplay=1&rel=0',
    );
    expect(player.getAttribute('title')).toBe('Video: Thruster');
  });

  it('goes back to the week of the training, in its gym', async () => {
    await open();

    expect(page.query('.page-header__back')!.getAttribute('href')).toBe(
      '/schedule?gym=gym-c&week=2026-11-09',
    );
  });

  it('books the training, then opens the confirmation', async () => {
    await open();
    expect(actionButton()!.getAttribute('aria-label')).toBe(
      'Book Friday, 13 November 18:00 – 19:00',
    );

    actionButton()!.click();
    await page.settle();
    expect(actionButton()!.textContent.trim()).toBe(schedule.booking);
    expect(actionButton()!.disabled).toBe(true);
    const request = http.expectOne('/api/bookings');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ slotId: 't-fri' });
    request.flush(
      answer({
        bookedCount: 4,
        bookedByMe: true,
        canBook: false,
        canCancel: true,
      }),
    );
    await page.settle();

    expect(router.url).toBe('/schedule/t-fri/booked');
    http.expectOne('/api/bookings/trainings/t-fri').flush(BOOKED);
    await page.settle();
    expect(page.query('h1')!.textContent.trim()).toBe(booked.title);
  });

  it('celebrates the booking in December', async () => {
    holidayNow = new Date('2026-12-05T10:00:00+02:00');
    await open();
    actionButton()!.click();
    await page.settle();
    http.expectOne('/api/bookings').flush(
      answer({
        bookedCount: 4,
        bookedByMe: true,
        canBook: false,
        canCancel: true,
      }),
    );
    await page.settle();
    http.expectOne('/api/bookings/trainings/t-fri').flush(BOOKED);
    await page.settle();
    expect(TestBed.inject(HolidayService).celebration()?.key).toBe(
      'holidays.celebrate.bookDecember',
    );
    document.documentElement.removeAttribute('data-holiday-snow');
  });

  it('cancels a booking once confirmed', async () => {
    await open({
      ...TRAINING,
      bookedByMe: true,
      canBook: false,
      canCancel: true,
    });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false);

    actionButton()!.click();
    await page.settle();
    expect(confirm).toHaveBeenCalledWith(
      'Cancel your booking for Friday, 13 November 18:00 – 19:00?',
    );
    http.expectNone('/api/bookings/t-fri');

    confirm.mockReturnValueOnce(true);
    actionButton()!.click();
    await page.settle();
    const request = http.expectOne('/api/bookings/t-fri');
    expect(request.request.method).toBe('DELETE');
    request.flush(answer({ bookedCount: 2 }));
    await page.settle();

    expect(page.query('[role="status"]')!.textContent.trim()).toBe(
      texts.cancelledNotice,
    );
    expect(details()[5]).toBe(`${texts.yourBooking}: ${texts.notBooked}`);
    expect(actionButton()!.textContent.trim()).toBe(schedule.book);
  });

  it("shows the API's reason when booking fails, and the training as it is now", async () => {
    await open();

    actionButton()!.click();
    await page.settle();
    const failed = apiError(
      'Booking for this training has closed (30 minutes before it starts)',
    );
    http.expectOne('/api/bookings').flush(failed.body, failed.options);
    await page.settle();
    http
      .expectOne('/api/bookings/trainings/t-fri')
      .flush({ ...TRAINING, canBook: false });
    await page.settle();

    expect(page.alert()).toBe(
      'Booking for this training has closed (30 minutes before it starts)',
    );
    expect(actionButton()).toBeNull();
    expect(page.text()).toContain(schedule.closed);
  });

  it('a training that has started offers no action and no rules', async () => {
    await open({
      ...TRAINING,
      startsAt: '2026-11-12T16:00:00Z',
      date: '2026-11-12',
      bookedByMe: true,
      canBook: false,
    });

    expect(page.query('.form-actions')).toBeNull();
    expect(page.text()).not.toContain(schedule.rules);
    expect(page.text()).toContain(texts.workoutTitle);
  });

  it("says when the training's workout isn't out yet", async () => {
    await open({ ...TRAINING, workout: null });

    expect(page.query('h1')!.textContent.trim()).toBe(texts.title);
    expect(page.text()).toContain(texts.noWorkoutTitle);
    expect(page.queryAll('[data-testid^="training-exercise-"]')).toHaveLength(
      0,
    );
  });

  it('says when a workout that is not out yet comes out (20:00 the day before)', async () => {
    // Seen at 00:30 on Friday: Saturday's workout comes out at 20:00 on Friday (18:00Z).
    await open({
      ...TRAINING,
      date: '2026-11-14',
      weekday: 6,
      startsAt: '2026-11-14T16:00:00Z',
      workout: null,
      workoutReleasesAt: '2026-11-13T18:00:00Z',
    });

    expect(page.text()).toContain(texts.noWorkoutTitle);
    expect(page.text()).toContain(
      "The day's workout comes out on Friday, 13 November at 20:00. Check back then.",
    );
    expect(page.text()).not.toContain(texts.noWorkoutMessage);
  });

  it("shows the API's message when the training can't be loaded", async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/schedule/t-fri');
    page = driver(
      () => harness.routeNativeElement!,
      () => harness.fixture.whenStable(),
    );
    await page.settle();
    const missing = apiError('Training not found', 404);
    http
      .expectOne('/api/bookings/trainings/t-fri')
      .flush(missing.body, missing.options);
    await page.settle();

    expect(page.alert()).toContain('Training not found');
    expect(router.url).toBe('/schedule/t-fri');
  });

  describe('Add to Google Calendar', () => {
    it('is offered once booked, with the time, the address and the trainer', async () => {
      await open({
        ...BOOKED,
        gym: { ...TRAINING.gym, address: 'ul. Ranni list 13, Plovdiv' },
      });

      const link = calendarLink()!;
      expect(link.textContent.replace(/\s+/g, ' ').trim()).toBe(
        `${calendar.add} ${calendar.opensInNewTab}`,
      );
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
      expect(link.href).toMatch(
        /^https:\/\/calendar\.google\.com\/calendar\/render\?action=TEMPLATE&/,
      );
      expect(calendarEvent()).toEqual({
        action: 'TEMPLATE',
        text: 'CrossFit training',
        dates: '20261113T160000Z/20261113T170000Z',
        location: 'ul. Ranni list 13, Plovdiv',
        details: `Group instructor: Velcho Sokolov\nWorkout: Fran\n${trainingPage()}`,
      });
      expect(page.text()).toContain(texts.calendarHint);
      expect(details()[2]).toBe(
        `${texts.gym}: Center ul. Ranni list 13, Plovdiv`,
      );
    });

    it('names the gym when it has no address, and no workout before it is out', async () => {
      await open({
        ...BOOKED,
        workout: null,
        workoutReleasesAt: '2026-11-13T18:00:00Z',
      });

      expect(calendarEvent()).toMatchObject({
        location: 'Center',
        details: `Group instructor: Velcho Sokolov\n${trainingPage()}`,
      });
    });

    it('is written in the language the page is shown in', async () => {
      await open(BOOKED);
      await firstValueFrom(TestBed.inject(LanguageService).use('bg'));
      await page.settle();

      expect(calendarEvent()).toMatchObject({
        text: 'CrossFit тренировка',
        details: `Групов инструктор: Velcho Sokolov\nТренировка на деня: Fran\n${trainingPage()}`,
      });
    });

    it("offers Apple Calendar too: the training's .ics file, with its date on the tile", async () => {
      await open(BOOKED);

      const link = appleLink()!;
      expect(link.getAttribute('href')).toBe(
        '/api/bookings/calendar.ics?token=cal.token-1&lang=en',
      );
      // Same tab: the file is downloaded, or an iPhone offers to add it.
      expect(link.getAttribute('target')).toBeNull();
      expect(appleText()).toBe(
        `${en.appleCalendar.add} ${en.appleCalendar.downloadsFile}`,
      );
      expect(appleTile()).toEqual(['Fri', '13']);
      expect(
        page
          .queryAll('.form-actions a')
          .map((a) => a.getAttribute('data-testid')),
      ).toEqual(['google-calendar-button', 'apple-calendar-button']);
    });

    it('asks for the Apple Calendar file in the language the page is shown in', async () => {
      await open(BOOKED);
      await firstValueFrom(TestBed.inject(LanguageService).use('bg'));
      await page.settle();

      expect(appleLink()!.getAttribute('href')).toBe(
        '/api/bookings/calendar.ics?token=cal.token-1&lang=bg',
      );
      expect(appleTile()).toEqual(['пт', '13']);
    });

    it('is not offered before booking', async () => {
      await open();
      expect(calendarLink()).toBeNull();
      expect(appleLink()).toBeNull();
      expect(page.text()).not.toContain(texts.calendarHint);
    });

    it('is not offered for a booked training that has started', async () => {
      await open({
        ...BOOKED,
        date: '2026-11-12',
        startsAt: '2026-11-12T16:00:00Z',
        canCancel: false,
      });
      expect(calendarLink()).toBeNull();
      expect(appleLink()).toBeNull();
    });

    it('stays next to "Too late to cancel"', async () => {
      await open({ ...BOOKED, canCancel: false });

      expect(actionButton()).toBeNull();
      expect(page.text()).toContain(schedule.cancelClosed);
      expect(calendarLink()).not.toBeNull();
    });
  });

  describe('the booking confirmation (/schedule/:id/booked)', () => {
    it('says the trainee is booked, with every detail of the training and no link to itself', async () => {
      await open(
        {
          ...BOOKED,
          gym: { ...TRAINING.gym, address: 'ul. Ranni list 13, Plovdiv' },
        },
        '/schedule/t-fri/booked',
      );

      expect(page.query('h1')!.textContent.trim()).toBe(booked.title);
      expect(page.text()).toContain('Friday, 13 November 18:00 – 19:00');
      expect(
        page.query('[data-testid="trainee-booked"]')!.textContent.trim(),
      ).toBe(booked.message);
      expect(details()).toEqual([
        `${texts.day}: Friday, 13 November`,
        `${texts.time}: 18:00 – 19:00`,
        `${texts.gym}: Center ul. Ranni list 13, Plovdiv`,
        `${texts.trainer}: Velcho Sokolov`,
        `${texts.bookings}: 4 booked`,
        `${texts.yourBooking}: ${schedule.booked}`,
      ]);
      expect(actionButton()!.textContent.trim()).toBe(schedule.cancel);
      expect(calendarLink()).not.toBeNull();
      expect(page.queryAll('[data-testid^="training-exercise-"]')).toHaveLength(
        2,
      );
      // Back to the week; nothing leads to the training's page, which shows the same.
      const links = page
        .queryAll<HTMLAnchorElement>('a[href]')
        .map((a) => a.getAttribute('href'))
        .filter((href) => href!.startsWith('/'));
      expect(links).toEqual([
        '/schedule?gym=gym-c&week=2026-11-09',
        '/api/bookings/calendar.ics?token=cal.token-1&lang=en',
      ]);
    });

    it('cancelled there, it shows the training as not booked, and books it again in place', async () => {
      await open(BOOKED, '/schedule/t-fri/booked');
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      actionButton()!.click();
      await page.settle();
      http.expectOne('/api/bookings/t-fri').flush(answer({ bookedCount: 3 }));
      await page.settle();

      expect(page.query('h1')!.textContent.trim()).toBe('Fran');
      expect(page.query('[data-testid="trainee-booked"]')).toBeNull();
      expect(page.text()).toContain(texts.cancelledNotice);
      expect(calendarLink()).toBeNull();
      expect(actionButton()!.textContent.trim()).toBe(schedule.book);

      actionButton()!.click();
      await page.settle();
      http.expectOne('/api/bookings').flush(
        answer({
          bookedCount: 4,
          bookedByMe: true,
          canBook: false,
          canCancel: true,
        }),
      );
      await page.settle();
      // The training again, for its new calendar token.
      http
        .expectOne('/api/bookings/trainings/t-fri')
        .flush({ ...BOOKED, calendarToken: 'cal.token-2' });
      await page.settle();

      expect(router.url).toBe('/schedule/t-fri/booked');
      expect(appleLink()!.getAttribute('href')).toBe(
        '/api/bookings/calendar.ics?token=cal.token-2&lang=en',
      );
      expect(page.query('h1')!.textContent.trim()).toBe(booked.title);
      expect(
        page.query('[data-testid="trainee-booked"]')!.textContent.trim(),
      ).toBe(booked.message);
      expect(page.text()).not.toContain(texts.cancelledNotice);
      expect(calendarLink()).not.toBeNull();
    });

    it("says so when the trainee isn't booked (any more), with Book", async () => {
      await open(TRAINING, '/schedule/t-fri/booked');

      expect(page.query('h1')!.textContent.trim()).toBe('Fran');
      expect(
        page
          .query('[data-testid="trainee-booked-missing"]')!
          .textContent.trim(),
      ).toBe(booked.notBookedMessage);
      expect(page.query('[data-testid="trainee-booked"]')).toBeNull();
      expect(calendarLink()).toBeNull();
      expect(actionButton()!.textContent.trim()).toBe(schedule.book);
    });
  });
});
