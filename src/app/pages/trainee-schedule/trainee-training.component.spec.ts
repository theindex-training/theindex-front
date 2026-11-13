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
import { TraineeTrainingComponent } from './trainee-training.component';

const texts = en.traineeTraining;
const schedule = en.traineeSchedule;

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
  gym: { id: 'gym-c', name: 'Center' },
  workout: WORKOUT,
  startsAt: '2026-11-13T16:00:00Z',
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

  beforeEach(() => {
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
          { path: '**', children: [] },
        ]),
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

  async function open(training: object = TRAINING) {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/schedule/t-fri');
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
      page.query('[data-testid="trainee-workout-summary"]')!.textContent,
    ).toBe('21-15-9\nThrusters 43/30 kg\nPull-ups');
    const exercises = page.queryAll('[data-testid^="trainee-exercise-"]');
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
      '[data-testid="trainee-exercise-ex-thruster"]',
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

  it('books the training and shows it booked, keeping the workout', async () => {
    await open();
    expect(actionButton()!.getAttribute('aria-label')).toBe(
      'Book Friday, 13 November 18:00 – 19:00',
    );

    actionButton()!.click();
    await page.settle();
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

    expect(page.query('[role="status"]')!.textContent.trim()).toBe(
      texts.bookedNotice,
    );
    expect(details().slice(4)).toEqual([
      `${texts.bookings}: 4 booked`,
      `${texts.yourBooking}: ${schedule.booked}`,
    ]);
    expect(actionButton()!.textContent.trim()).toBe(schedule.cancel);
    expect(page.queryAll('[data-testid^="trainee-exercise-"]')).toHaveLength(2);
    expect(page.query('h1')!.textContent.trim()).toBe('Fran');
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
    expect(page.queryAll('[data-testid^="trainee-exercise-"]')).toHaveLength(0);
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
});
