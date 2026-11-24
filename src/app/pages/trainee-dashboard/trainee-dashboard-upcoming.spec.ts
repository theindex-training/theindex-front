import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import en from '../../../../public/i18n/en.json';
import { PageDriver, apiError, driver } from '../../../testing/dom';
import { signInAs } from '../../../testing/jwt';
import { BookingGym, GymTraining } from '../../services/bookings.service';
import { Subscription } from '../../services/subscriptions.service';
import { TraineeDashboardComponent } from './trainee-dashboard.component';

const copy = en.traineeDashboard;

/** 00:30 on Sunday 22 Nov 2026 in Sofia (22:30Z on the 21st). */
const NOW = new Date('2026-11-21T22:30:00Z');
const TODAY = '2026-11-22';
const TOMORROW = '2026-11-23';

const CENTER: BookingGym = { id: 'gym-c', name: 'Center', preferred: false };
const LOZENETS: BookingGym = { id: 'gym-l', name: 'Lozenets', preferred: true };

function training(over: Partial<GymTraining>): GymTraining {
  return {
    id: 'slot',
    date: TODAY,
    weekday: 7,
    trainingTime: { startTime: '18:00:00', endTime: '19:00:00' },
    trainer: { name: 'Velcho', nickname: null },
    workout: null,
    workoutReleasesAt: '2026-11-21T18:00:00.000Z',
    startsAt: '2026-11-22T16:00:00.000Z',
    bookedCount: 3,
    bookedByMe: false,
    bookingClosesAt: '2026-11-22T15:30:00.000Z',
    cancelUntil: '2026-11-22T15:00:00.000Z',
    canBook: true,
    canCancel: false,
    gym: { id: LOZENETS.id, name: LOZENETS.name },
    ...over,
  };
}

const LOZENETS_TODAY = training({
  id: 'loz-today',
  workout: { title: 'Fran' },
});
const LOZENETS_TOMORROW = training({
  id: 'loz-tomorrow',
  date: TOMORROW,
  startsAt: '2026-11-23T16:00:00.000Z',
});
/** At the other gym, booked by the trainee: still shown, with its gym. */
const CENTER_BOOKED = training({
  id: 'center-booked',
  gym: { id: CENTER.id, name: CENTER.name },
  trainingTime: { startTime: '07:00:00', endTime: '08:00:00' },
  bookedByMe: true,
  canBook: false,
  canCancel: true,
});
const CENTER_OTHER = training({
  id: 'center-other',
  gym: { id: CENTER.id, name: CENTER.name },
});

function subscription(over: Partial<Subscription>): Subscription {
  return {
    id: 's1',
    traineeId: 'trainee-1',
    planId: 'p1',
    type: 'PUNCH',
    status: 'ACTIVE',
    paidCents: 4550,
    startsAt: '2026-11-01',
    endsAt: null,
    initialCredits: 10,
    remainingCredits: 6,
    ...over,
  };
}

@Component({ template: '' })
class StubPageComponent {}

describe('TraineeDashboardComponent: subscription and the next trainings', () => {
  let http: HttpTestingController;
  let page: PageDriver;
  let harness: RouterTestingHarness;

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'], now: NOW });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'home', component: TraineeDashboardComponent },
          { path: 'schedule/:id/booked', component: StubPageComponent },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  async function render(
    subscriptions: Subscription[],
    gyms: BookingGym[],
    slots: GymTraining[],
  ) {
    signInAs('TRAINEE', { traineeProfileId: 'trainee-1' });
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/home', TraineeDashboardComponent);
    page = driver(
      () => harness.routeNativeElement!,
      () => harness.fixture.whenStable(),
    );
    http.expectOne('/api/attendance/trainees/trainee-1').flush([]);
    http
      .expectOne('/api/trainees/trainee-1/subscriptions')
      .flush(subscriptions);
    http.expectOne((req) => req.url === '/api/plans').flush([]);
    http.expectOne('/api/bookings/gyms').flush(gyms);
    http
      .expectOne(`/api/bookings/trainings?from=${TODAY}&to=${TOMORROW}`)
      .flush({ from: TODAY, to: TOMORROW, slots });
    await page.settle();
  }

  const summary = () =>
    page.query<HTMLElement>('[data-testid="subscription-summary"]')!;
  const shown = (date: string) =>
    page
      .queryAll(`[data-testid="upcoming-day-${date}"] li`)
      .map((row) =>
        row.getAttribute('data-testid')!.replace('upcoming-training-', ''),
      );
  const row = (id: string) =>
    page.query<HTMLElement>(`[data-testid="upcoming-training-${id}"]`)!;
  const button = (id: string, label: string) =>
    [...row(id).querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === label,
    );

  describe('the subscription card', () => {
    it('shows the trainings left and that all is well', async () => {
      await render([subscription({})], [], []);

      expect(summary().classList).toContain('summary--ok');
      expect(
        summary()
          .querySelector('[data-testid="subscription-credits"]')
          ?.textContent?.trim(),
      ).toBe('6 trainings left');
      expect(summary().textContent).toContain(copy.summary.advice.OK);
    });

    it('warns on the last training', async () => {
      await render([subscription({ remainingCredits: 1 })], [], []);

      expect(summary().classList).toContain('summary--last');
      expect(summary().textContent).toContain('1 training left');
      expect(summary().textContent).toContain(copy.summary.advice.LAST);
    });

    it("shows a time pass's days left and end date", async () => {
      await render(
        [
          subscription({
            type: 'TIME',
            endsAt: '2026-11-27T21:59:59.000Z',
            remainingCredits: null,
          }),
        ],
        [],
        [],
      );

      expect(summary().classList).toContain('summary--low');
      expect(
        summary()
          .querySelector('[data-testid="subscription-days"]')
          ?.textContent?.replace(/\s+/g, ' ')
          .trim(),
      ).toBe('5 days left until 27 Nov 2026');
      expect(summary().textContent).toContain(copy.summary.advice.LOW);
    });

    it('says there is no active subscription', async () => {
      await render([subscription({ status: 'EXHAUSTED' })], [], []);

      expect(summary().classList).toContain('summary--none');
      expect(summary().textContent).toContain(copy.summary.none);
      expect(summary().textContent).toContain(copy.summary.advice.NONE);
    });
  });

  const myBookings = () =>
    page
      .queryAll('[data-testid^="my-booking-"]')
      .map((li) => li.getAttribute('data-testid')!.replace('my-booking-', ''));

  describe('your bookings', () => {
    /** Sunday 22 Nov at Center, 07:00 – 08:00 Sofia, booked. */
    const MORNING_BOOKED = training({
      id: 'morning-booked',
      gym: { id: CENTER.id, name: CENTER.name },
      trainingTime: { startTime: '07:00:00', endTime: '08:00:00' },
      startsAt: '2026-11-22T05:00:00.000Z',
      bookedByMe: true,
      canBook: false,
      canCancel: true,
      workout: { title: 'Fran' },
    });
    /** Sunday 22 Nov at Lozenets, 18:00 – 19:00, booked. */
    const EVENING_BOOKED = training({
      id: 'evening-booked',
      bookedByMe: true,
      canBook: false,
      canCancel: true,
    });
    /** Monday 23 Nov at Lozenets, 18:00 – 19:00, booked. */
    const TOMORROW_BOOKED = training({
      id: 'tomorrow-booked',
      date: TOMORROW,
      startsAt: '2026-11-23T16:00:00.000Z',
      bookedByMe: true,
      canBook: false,
      canCancel: true,
    });

    it("lists the trainee's own bookings of today and tomorrow, in any gym, between the subscription and the trainings", async () => {
      await render(
        [subscription({})],
        [CENTER, LOZENETS],
        [MORNING_BOOKED, LOZENETS_TODAY, EVENING_BOOKED, TOMORROW_BOOKED],
      );

      expect(myBookings()).toEqual([
        'morning-booked',
        'evening-booked',
        'tomorrow-booked',
      ]);
      const section = page.query('[data-testid="my-bookings"]')!;
      expect(section.querySelector('h2')!.textContent.trim()).toBe(
        copy.myBookings.title,
      );
      // After the subscription card, before today's and tomorrow's trainings.
      const order = page
        .queryAll(
          '[data-testid="subscription-summary"], [data-testid="my-bookings"], [data-testid^="upcoming-day-"]',
        )
        .map((el) => el.getAttribute('data-testid'));
      expect(order).toEqual([
        'subscription-summary',
        'my-bookings',
        `upcoming-day-${TODAY}`,
        `upcoming-day-${TOMORROW}`,
      ]);
      const morning = page.query('[data-testid="my-booking-morning-booked"]')!;
      const text = morning.textContent.replace(/\s+/g, ' ');
      expect(text).toContain('Today · Sunday, 22 November');
      expect(text).toContain('07:00 – 08:00');
      expect(text).toContain('Center · Velcho');
      expect(text).toContain('Fran');
      expect(text).toContain(en.traineeSchedule.booked);
      expect(morning.querySelector('a')!.getAttribute('href')).toBe(
        '/schedule/morning-booked',
      );
      expect(
        page.query('[data-testid="my-booking-tomorrow-booked"]')!.textContent,
      ).toContain('Tomorrow · Monday, 23 November');
    });

    it('is left out while the trainee has no bookings', async () => {
      await render([], [LOZENETS], [LOZENETS_TODAY, LOZENETS_TOMORROW]);

      expect(page.query('[data-testid="my-bookings"]')).toBeNull();
    });

    it('marks a booked training that is on now, and drops one that has ended', async () => {
      // 18:30 on Sunday in Sofia: the morning training is over, the evening one is on.
      vi.setSystemTime(new Date('2026-11-22T16:30:00Z'));
      await render(
        [],
        [CENTER, LOZENETS],
        [MORNING_BOOKED, EVENING_BOOKED, TOMORROW_BOOKED],
      );

      expect(myBookings()).toEqual(['evening-booked', 'tomorrow-booked']);
      expect(
        page.query('[data-testid="my-booking-evening-booked"]')!.textContent,
      ).toContain(copy.myBookings.onNow);
      expect(
        page.query('[data-testid="my-booking-tomorrow-booked"]')!.textContent,
      ).toContain(en.traineeSchedule.booked);
    });
  });

  describe("today's and tomorrow's trainings", () => {
    const ALL = [
      CENTER_BOOKED,
      LOZENETS_TODAY,
      CENTER_OTHER,
      LOZENETS_TOMORROW,
    ];

    it('opens on the preferred gym, with the own bookings of the other gyms', async () => {
      await render([], [CENTER, LOZENETS], ALL);

      expect(shown(TODAY)).toEqual(['center-booked', 'loz-today']);
      expect(shown(TOMORROW)).toEqual(['loz-tomorrow']);
      expect(row('center-booked').textContent).toContain('Center · Velcho');
      expect(row('center-booked').textContent).toContain(
        en.traineeSchedule.booked,
      );
      expect(row('loz-today').textContent).not.toContain('Lozenets');
      expect(row('loz-today').textContent).toContain('Fran');
    });

    it('switches gym and remembers it on the device', async () => {
      await render([], [CENTER, LOZENETS], ALL);

      await page.click('input[type="radio"][value="gym-c"]');

      expect(shown(TODAY)).toEqual(['center-booked', 'center-other']);
      expect(localStorage.getItem('scheduleGym')).toBe('gym-c');
    });

    it("links the trainees' Schedule next to the trainings, with one gym too", async () => {
      await render([], [LOZENETS], [LOZENETS_TODAY]);

      const links = page.queryAll<HTMLAnchorElement>(
        '[data-testid="dashboard-full-schedule"]',
      );
      expect(links.map((a) => a.getAttribute('href'))).toEqual(['/schedule']);
      expect(links[0].textContent.trim()).toBe(copy.upcoming.fullSchedule);
      // The heading row of the trainings, not under the list.
      expect(
        links[0].closest('.section-header')?.querySelector('#upcoming-title'),
      ).not.toBeNull();
    });

    it('says when a day has no published trainings', async () => {
      await render([], [LOZENETS], [LOZENETS_TODAY]);

      expect(
        page.query(`[data-testid="upcoming-day-${TOMORROW}"]`)!.textContent,
      ).toContain(copy.upcoming.none);
      // One gym: nothing to choose.
      expect(page.query('input[type="radio"][value="gym-l"]')).toBeNull();
    });

    it('books a training and opens its confirmation', async () => {
      await render([], [LOZENETS], [LOZENETS_TODAY]);

      button('loz-today', en.traineeSchedule.book)!.click();
      const booking = http.expectOne('/api/bookings');
      expect(booking.request.method).toBe('POST');
      expect(booking.request.body).toEqual({ slotId: 'loz-today' });
      booking.flush({ ...LOZENETS_TODAY, bookedByMe: true });
      await page.settle();

      expect(TestBed.inject(Router).url).toBe('/schedule/loz-today/booked');
    });

    it('cancels a booking after asking, and shows it as cancelled', async () => {
      await render([], [CENTER, LOZENETS], [CENTER_BOOKED]);
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
      expect(myBookings()).toEqual(['center-booked']);

      button('center-booked', en.traineeSchedule.cancel)!.click();
      expect(confirm).toHaveBeenCalledWith(
        'Cancel your booking for Sunday, 22 November 07:00 – 08:00?',
      );
      const cancel = http.expectOne('/api/bookings/center-booked');
      expect(cancel.request.method).toBe('DELETE');
      // The API answers the training without its gym.
      const answer: Partial<GymTraining> = { ...CENTER_BOOKED };
      delete answer.gym;
      cancel.flush({
        ...answer,
        bookedByMe: false,
        canBook: true,
        canCancel: false,
      });
      await page.settle();

      // Not booked any more, and at the other gym: it leaves the list, and "Your bookings" goes.
      expect(shown(TODAY)).toEqual([]);
      expect(page.query('[data-testid="my-bookings"]')).toBeNull();
      confirm.mockRestore();
    });

    it("shows a failed booking's message and asks for the trainings again", async () => {
      await render([], [LOZENETS], [LOZENETS_TODAY]);

      button('loz-today', en.traineeSchedule.book)!.click();
      const error = apiError('Booking for this training has closed', 400);
      http.expectOne('/api/bookings').flush(error.body, error.options);
      http.expectOne('/api/bookings/gyms').flush([LOZENETS]);
      http
        .expectOne(`/api/bookings/trainings?from=${TODAY}&to=${TOMORROW}`)
        .flush({
          from: TODAY,
          to: TOMORROW,
          slots: [{ ...LOZENETS_TODAY, canBook: false }],
        });
      await page.settle();

      expect(page.alert()).toBe('Booking for this training has closed');
      expect(row('loz-today').textContent).toContain(en.traineeSchedule.closed);
    });
  });
});
