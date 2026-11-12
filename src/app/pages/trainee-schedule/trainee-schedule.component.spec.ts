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
  { id: 'gym-c', name: 'Center' },
  { id: 'gym-n', name: 'North' },
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
      .map((part) => (part.textContent ?? '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join(' | ');
  const buttonIn = (id: string) => row(id).querySelector('button');

  it('shows each training with its count and what the trainee can do', async () => {
    await open();

    expect(rowText('t-thu')).toBe(
      '18:00 – 23:00 | Velcho Sokolov | 5 booked | Booked',
    );
    expect(buttonIn('t-thu')).toBeNull();
    expect(rowText('t-soon')).toBe(
      `00:45 – 23:00 | Velcho Sokolov | 1 booked | ${texts.closed}`,
    );
    expect(rowText('t-fri')).toBe(
      `18:00 – 23:00 | Velcho Sokolov | Helen | 3 booked | ${texts.book}`,
    );
    expect(buttonIn('t-fri')!.getAttribute('aria-label')).toBe(
      'Book Friday, 13 November 18:00 – 23:00',
    );
    expect(rowText('t-sat')).toBe(
      `07:10 – 23:00 | Velcho Sokolov | 2 booked | Booked ${texts.cancel}`,
    );
    expect(page.text()).toContain(texts.rules);
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

  it('books a training and shows it booked', async () => {
    await open();

    buttonIn('t-fri')!.click();
    await page.settle();
    const request = http.expectOne('/api/bookings');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ slotId: 't-fri' });
    request.flush({
      ...OPEN,
      bookedCount: 4,
      bookedByMe: true,
      canBook: false,
      canCancel: true,
    });
    await page.settle();

    expect(rowText('t-fri')).toBe(
      `18:00 – 23:00 | Velcho Sokolov | Helen | 4 booked | Booked ${texts.cancel}`,
    );
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

  it("shows the API's reason when booking fails, and the week as it is now", async () => {
    await open();

    buttonIn('t-fri')!.click();
    await page.settle();
    const failed = apiError(
      'Booking for this training has closed (30 minutes before it starts)',
    );
    http.expectOne('/api/bookings').flush(failed.body, failed.options);
    await page.settle();
    http.expectOne('/api/bookings/schedule?gymId=gym-c&week=2026-11-09').flush({
      ...WEEK,
      slots: [PAST, CLOSED, { ...OPEN, canBook: false }, MINE],
    });
    await page.settle();

    expect(page.alert()).toBe(
      'Booking for this training has closed (30 minutes before it starts)',
    );
    expect(rowText('t-fri')).toContain(texts.closed);
  });

  it("says when the week's schedule isn't out yet", async () => {
    await open('/schedule', { ...WEEK, week: null, slots: [] });

    expect(page.text()).toContain(texts.notOutTitle);
    expect(page.queryAll('[data-testid^="trainee-day-"]')).toHaveLength(0);
  });
});
