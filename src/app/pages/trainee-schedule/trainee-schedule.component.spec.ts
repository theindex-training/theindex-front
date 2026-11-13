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
import { SCHEDULE_GYM_KEY } from '../schedules/schedule-gym';
import { TraineeScheduleComponent } from './trainee-schedule.component';

const texts = en.traineeSchedule;

const GYMS = [
  { id: 'gym-c', name: 'Center', preferred: false },
  { id: 'gym-n', name: 'North', preferred: false },
];
const training = (
  id: string,
  date: string,
  startTime: string,
  over: object = {},
) => ({
  id,
  date,
  weekday: 0,
  trainingTime: { startTime, endTime: '23:00:00' },
  trainer: { name: 'Velcho Sokolov', nickname: null },
  workout: null,
  startsAt: '',
  bookedCount: 0,
  bookedByMe: false,
  bookingClosesAt: '',
  cancelUntil: '',
  canBook: false,
  canCancel: false,
  ...over,
});
/** Seen at 00:30 on Friday 13 Nov in Sofia (22:30Z on the 12th). */
const PAST = training('t-thu', '2026-11-12', '18:00:00', {
  startsAt: '2026-11-12T16:00:00Z',
  bookedByMe: true,
  bookedCount: 5,
});
const CLOSED = training('t-soon', '2026-11-13', '00:45:00', {
  startsAt: '2026-11-12T22:45:00Z',
  bookedCount: 1,
});
const OPEN = training('t-fri', '2026-11-13', '18:00:00', {
  startsAt: '2026-11-13T16:00:00Z',
  bookedCount: 3,
  canBook: true,
  workout: { title: 'Helen' },
});
const MINE = training('t-sat', '2026-11-14', '07:10:00', {
  startsAt: '2026-11-14T05:10:00Z',
  bookedCount: 2,
  bookedByMe: true,
  canCancel: true,
});
const WEEK = {
  gym: GYMS[0],
  weekStart: '2026-11-09',
  weekEnd: '2026-11-15',
  week: { id: 'week-1' },
  slots: [PAST, CLOSED, OPEN, MINE],
};

describe('TraineeScheduleComponent', () => {
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
          { path: 'schedule', component: TraineeScheduleComponent },
          { path: 'schedule/:id', children: [] },
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

  async function open(url = '/schedule', answer: object = WEEK) {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    page = driver(
      () => harness.routeNativeElement!,
      () => harness.fixture.whenStable(),
    );
    await page.settle();
    http.expectOne('/api/bookings/gyms').flush(GYMS);
    await page.settle();
    if (answer) {
      http
        .expectOne('/api/bookings/schedule?gymId=gym-c&week=2026-11-09')
        .flush(answer);
      await page.settle();
    }
  }

  const row = (id: string) =>
    page.query(`[data-testid="trainee-training-${id}"]`)!;
  const rowText = (id: string) =>
    Array.from(row(id).querySelectorAll(':scope > span'))
      // The actions (chip, note, links, button) are laid out apart: read them one by one.
      .map((part) =>
        (part.children.length ? Array.from(part.children) : [part])
          .map((item) => (item.textContent ?? '').replace(/\s+/g, ' ').trim())
          .join(' '),
      )
      .filter(Boolean)
      .join(' | ');
  const buttonIn = (id: string) => row(id).querySelector('button');
  const linkIn = (id: string) => row(id).querySelector('a');

  it('shows each training with its count and what the trainee can do', async () => {
    await open();

    // Past: only its page (with the workout) is left.
    expect(rowText('t-thu')).toBe(
      `18:00 – 23:00 | Velcho Sokolov | 5 booked | Booked ${texts.details}`,
    );
    expect(buttonIn('t-thu')).toBeNull();
    expect(rowText('t-soon')).toBe(
      `00:45 – 23:00 | Velcho Sokolov | 1 booked | ${texts.closed} ${texts.details}`,
    );
    expect(linkIn('t-soon')!.getAttribute('aria-label')).toBe(
      'Details of Friday, 13 November 00:45 – 23:00',
    );
    // Open: Book leads to the training's page, where the trainee books.
    expect(rowText('t-fri')).toBe(
      `18:00 – 23:00 | Velcho Sokolov | Helen | 3 booked | ${texts.book}`,
    );
    expect(buttonIn('t-fri')).toBeNull();
    expect(linkIn('t-fri')!.getAttribute('aria-label')).toBe(
      'Book Friday, 13 November 18:00 – 23:00',
    );
    expect(linkIn('t-fri')!.getAttribute('href')).toBe('/schedule/t-fri');
    // Booked: its page, and Cancel booking right here.
    expect(rowText('t-sat')).toBe(
      `07:10 – 23:00 | Velcho Sokolov | 2 booked | Booked ${texts.details} ${texts.cancel}`,
    );
    expect(linkIn('t-sat')!.getAttribute('href')).toBe('/schedule/t-sat');
    expect(page.text()).toContain(texts.rules);
  });

  it('a booking that is too late to cancel says so and keeps its page', async () => {
    await open('/schedule', {
      ...WEEK,
      slots: [{ ...MINE, canCancel: false }],
    });

    expect(rowText('t-sat')).toBe(
      `07:10 – 23:00 | Velcho Sokolov | 2 booked | Booked ${texts.cancelClosed} ${texts.details}`,
    );
    expect(buttonIn('t-sat')).toBeNull();
  });

  it('opens the gym picked last on this device and remembers a new pick', async () => {
    localStorage.setItem(SCHEDULE_GYM_KEY, 'gym-n');
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/schedule');
    page = driver(
      () => harness.routeNativeElement!,
      () => harness.fixture.whenStable(),
    );
    await page.settle();
    http.expectOne('/api/bookings/gyms').flush(GYMS);
    await page.settle();
    http
      .expectOne('/api/bookings/schedule?gymId=gym-n&week=2026-11-09')
      .flush({ ...WEEK, gym: GYMS[1] });
    await page.settle();

    const center = page.queryAll<HTMLInputElement>('fieldset input')[0];
    center.click();
    center.dispatchEvent(new Event('change'));
    await page.settle();

    expect(localStorage.getItem(SCHEDULE_GYM_KEY)).toBe('gym-c');
    expect(router.url).toBe('/schedule?gym=gym-c');
    http
      .expectOne('/api/bookings/schedule?gymId=gym-c&week=2026-11-09')
      .flush(WEEK);
    await page.settle();
  });

  it('opens the preferred gym first, over the one picked last', async () => {
    localStorage.setItem(SCHEDULE_GYM_KEY, 'gym-c');
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/schedule');
    page = driver(
      () => harness.routeNativeElement!,
      () => harness.fixture.whenStable(),
    );
    await page.settle();
    http
      .expectOne('/api/bookings/gyms')
      .flush([GYMS[0], { ...GYMS[1], preferred: true }]);
    await page.settle();

    http
      .expectOne('/api/bookings/schedule?gymId=gym-n&week=2026-11-09')
      .flush({ ...WEEK, gym: GYMS[1] });
    await page.settle();
  });

  it("Book opens the training's page and books nothing yet", async () => {
    await open();

    linkIn('t-fri')!.click();
    await page.settle();

    expect(router.url).toBe('/schedule/t-fri');
    http.expectNone('/api/bookings');
  });

  it('cancels a booking once confirmed', async () => {
    await open();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false);

    buttonIn('t-sat')!.click();
    await page.settle();
    expect(confirm).toHaveBeenCalledWith(
      'Cancel your booking for Saturday, 14 November 07:10 – 23:00?',
    );
    http.expectNone('/api/bookings/t-sat');

    confirm.mockReturnValueOnce(true);
    buttonIn('t-sat')!.click();
    await page.settle();
    const request = http.expectOne('/api/bookings/t-sat');
    expect(request.request.method).toBe('DELETE');
    request.flush({
      ...MINE,
      bookedCount: 1,
      bookedByMe: false,
      canBook: true,
      canCancel: false,
    });
    await page.settle();

    expect(rowText('t-sat')).toBe(
      `07:10 – 23:00 | Velcho Sokolov | 1 booked | ${texts.book}`,
    );
  });

  it("shows the API's reason when cancelling fails, and the week as it is now", async () => {
    await open();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    buttonIn('t-sat')!.click();
    await page.settle();
    const failed = apiError(
      'A booking can be cancelled only until 1 hour before the training',
    );
    http.expectOne('/api/bookings/t-sat').flush(failed.body, failed.options);
    await page.settle();
    http.expectOne('/api/bookings/schedule?gymId=gym-c&week=2026-11-09').flush({
      ...WEEK,
      slots: [PAST, CLOSED, OPEN, { ...MINE, canCancel: false }],
    });
    await page.settle();

    expect(page.alert()).toBe(
      'A booking can be cancelled only until 1 hour before the training',
    );
    expect(rowText('t-sat')).toContain(texts.cancelClosed);
  });

  it("says when the week's schedule isn't out yet", async () => {
    await open('/schedule', { ...WEEK, week: null, slots: [] });

    expect(page.text()).toContain(texts.notOutTitle);
    expect(page.queryAll('[data-testid^="trainee-day-"]')).toHaveLength(0);
  });
});
