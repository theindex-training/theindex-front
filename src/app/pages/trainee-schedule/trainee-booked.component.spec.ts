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
import { TraineeBookedComponent } from './trainee-booked.component';

const texts = en.traineeBooked;
const training = en.traineeTraining;

/** Seen at 00:30 on Friday 13 Nov in Sofia (22:30Z on the 12th): it is at 07:10 on Tuesday 17. */
const BOOKED = {
  id: 't-tue',
  date: '2026-11-17',
  weekday: 2,
  trainingTime: { startTime: '07:10:00', endTime: '08:10:00' },
  trainer: { name: 'Krasimir Peykov', nickname: null },
  gym: {
    id: 'gym-p',
    name: 'Plovdiv',
    address: 'ul. Ranni list 13, Plovdiv',
  },
  workout: null,
  workoutReleasesAt: '2026-11-16T18:00:00Z',
  startsAt: '2026-11-17T05:10:00Z',
  endsAt: '2026-11-17T06:10:00Z',
  bookedCount: 4,
  bookedByMe: true,
  bookingClosesAt: '2026-11-17T04:40:00Z',
  cancelUntil: '2026-11-17T04:10:00Z',
  canBook: false,
  canCancel: true,
};

describe('TraineeBookedComponent', () => {
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
          { path: 'schedule/:id/booked', component: TraineeBookedComponent },
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

  async function open(answer: object = BOOKED) {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/schedule/t-tue/booked');
    page = driver(
      () => harness.routeNativeElement!,
      () => harness.fixture.whenStable(),
    );
    await page.settle();
    const request = http.expectOne('/api/bookings/trainings/t-tue');
    expect(request.request.method).toBe('GET');
    request.flush(answer);
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
  const calendarLink = () =>
    page.query<HTMLAnchorElement>('[data-testid="trainee-booked-calendar"]');
  const calendarEvent = () =>
    Object.fromEntries(new URL(calendarLink()!.href).searchParams);
  const trainingPage = () => new URL('/schedule/t-tue', document.baseURI).href;

  it('confirms the booking with when, where and with whom', async () => {
    await open();

    expect(page.query('h1')!.textContent.trim()).toBe(texts.title);
    expect(page.text()).toContain('Tuesday, 17 November 07:10 – 08:10');
    expect(page.query('[role="status"]')!.textContent.trim()).toBe(
      texts.message,
    );
    expect(details()).toEqual([
      `${training.day}: Tuesday, 17 November`,
      `${training.time}: 07:10 – 08:10`,
      `${training.gym}: Plovdiv ul. Ranni list 13, Plovdiv`,
      `${training.trainer}: Krasimir Peykov`,
    ]);
    const links = page.queryAll<HTMLAnchorElement>('.form-actions a');
    expect(links.map((a) => a.textContent.replace(/\s+/g, ' ').trim())).toEqual(
      [texts.openTraining, `${texts.addToCalendar} ${texts.opensInNewTab}`],
    );
    expect(links[0].getAttribute('href')).toBe('/schedule/t-tue');
    expect(page.query('.page-header__back')!.getAttribute('href')).toBe(
      '/schedule?gym=gym-p&week=2026-11-16',
    );
    // The workout isn't out yet: when it comes out.
    expect(page.text()).toContain(training.noWorkoutTitle);
    expect(page.text()).toContain(
      "The day's workout comes out on Monday, 16 November at 20:00. Check back then.",
    );
  });

  it('adds the training to Google Calendar: the time, the address and the trainer', async () => {
    await open();

    const link = calendarLink()!;
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.href).toMatch(
      /^https:\/\/calendar\.google\.com\/calendar\/render\?action=TEMPLATE&/,
    );
    expect(calendarEvent()).toEqual({
      action: 'TEMPLATE',
      text: 'CrossFit training',
      dates: '20261117T051000Z/20261117T061000Z',
      location: 'ul. Ranni list 13, Plovdiv',
      details: `Group instructor: Krasimir Peykov\n${trainingPage()}`,
    });
  });

  it('names the workout once it is out, and the gym when it has no address', async () => {
    await open({
      ...BOOKED,
      gym: { ...BOOKED.gym, address: null },
      workout: { title: 'Fran', summary: '21-15-9', exercises: [] },
      workoutReleasesAt: '2026-11-12T18:00:00Z',
    });

    expect(calendarEvent()).toMatchObject({
      location: 'Plovdiv',
      details: `Group instructor: Krasimir Peykov\nWorkout: Fran\n${trainingPage()}`,
    });
    expect(details()[2]).toBe(`${training.gym}: Plovdiv`);
    expect(
      page.query('[data-testid="training-workout-summary"]')!.textContent,
    ).toBe('21-15-9');
  });

  it('writes the event in the language the page is shown in', async () => {
    await open();
    await firstValueFrom(TestBed.inject(LanguageService).use('bg'));
    await page.settle();

    expect(calendarEvent()).toMatchObject({
      text: 'CrossFit тренировка',
      details: `Групов инструктор: Krasimir Peykov\n${trainingPage()}`,
    });
  });

  it("says so when the trainee isn't booked (any more), with the way to book", async () => {
    await open({
      ...BOOKED,
      bookedByMe: false,
      canBook: true,
      canCancel: false,
    });

    expect(page.query('h1')!.textContent.trim()).toBe(texts.notBookedTitle);
    expect(page.text()).toContain(texts.notBookedMessage);
    expect(page.text()).not.toContain(texts.message);
    expect(calendarLink()).toBeNull();
    const link = page.query<HTMLAnchorElement>('.form-actions a')!;
    expect(link.textContent.trim()).toBe(texts.openTraining);

    link.click();
    await page.settle();
    expect(router.url).toBe('/schedule/t-tue');
  });

  it("shows the API's message when the training can't be loaded, and tries again", async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/schedule/t-tue/booked');
    page = driver(
      () => harness.routeNativeElement!,
      () => harness.fixture.whenStable(),
    );
    await page.settle();
    const missing = apiError('Training not found', 404);
    http
      .expectOne('/api/bookings/trainings/t-tue')
      .flush(missing.body, missing.options);
    await page.settle();

    expect(page.alert()).toContain('Training not found');
    expect(calendarLink()).toBeNull();

    page.query<HTMLButtonElement>('app-empty-state button')!.click();
    await page.settle();
    http.expectOne('/api/bookings/trainings/t-tue').flush(BOOKED);
    await page.settle();
    expect(calendarLink()).not.toBeNull();
  });
});
