import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import en from '../../../../public/i18n/en.json';
import { PageDriver, apiError, driver } from '../../../testing/dom';
import { TestRole, signInAs } from '../../../testing/jwt';
import { DayTraining } from '../../services/schedules.service';
import { RenewalRow } from '../../services/subscription-renewals.service';
import { StaffDashboardComponent } from './staff-dashboard.component';

const copy = en.dashboard;

/**
 * Now is 00:30 on Sunday 22 Nov 2026 in Sofia (22:30Z on Saturday the 21st), so "today" is the
 * Sofia day, not the UTC one.
 */
const NOW = new Date('2026-11-21T22:30:00Z');
const TODAY = '2026-11-22';
const TOMORROW = '2026-11-23';

const VELCHO = {
  id: 'trainer-v',
  name: 'Velcho',
  nickname: null,
  isActive: true,
};
const ASEN = { id: 'trainer-a', name: 'Asen', nickname: null, isActive: true };

function training(over: Partial<DayTraining>): DayTraining {
  return {
    id: 'slot',
    date: TODAY,
    weekday: 7,
    trainingTime: { id: 'tt-18', startTime: '18:00:00', endTime: '19:00:00' },
    trainer: VELCHO,
    workout: null,
    bookedCount: 0,
    gym: { id: 'gym-c', name: 'Center' },
    weekStart: '2026-11-16',
    weekStatus: 'PUBLISHED',
    startsAt: '2026-11-22T16:00:00.000Z',
    endsAt: '2026-11-22T17:00:00.000Z',
    attendanceCount: 0,
    unregisteredTraineeIds: [],
    ...over,
  };
}

/** The night session that has started (00:15), nobody registered yet; two booked. */
const STARTED = training({
  id: 'night',
  trainingTime: { id: 'tt-0', startTime: '00:15:00', endTime: '01:15:00' },
  startsAt: '2026-11-21T22:15:00.000Z',
  endsAt: '2026-11-21T23:15:00.000Z',
  bookedCount: 2,
  unregisteredTraineeIds: ['t-ana', 't-boris'],
  workout: { id: 'w1', title: 'Fran' },
});
/** Already registered (3 trainees), one booked trainee not among them. */
const REGISTERED = training({
  id: 'registered',
  trainingTime: { id: 'tt-0', startTime: '00:00:00', endTime: '00:20:00' },
  startsAt: '2026-11-21T22:00:00.000Z',
  attendanceCount: 3,
  bookedCount: 4,
  unregisteredTraineeIds: ['t-cveta'],
});
const ASENS = training({
  id: 'asens',
  trainer: ASEN,
  gym: { id: 'gym-l', name: 'Lozenets' },
});
const TOMORROWS = training({
  id: 'tomorrow',
  date: TOMORROW,
  weekStatus: 'DRAFT',
  startsAt: '2026-11-23T16:00:00.000Z',
});

const renewalRow = (traineeId: string) => ({ traineeId }) as RenewalRow;

describe('StaffDashboardComponent', () => {
  let http: HttpTestingController;
  let page: PageDriver;

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'], now: NOW });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  async function render(
    role: TestRole,
    trainerProfileId: string | null,
    trainings: DayTraining[] | 'pending' = [],
  ) {
    signInAs(role, { trainerProfileId });
    const fixture = TestBed.createComponent(StaffDashboardComponent);
    page = driver(
      () => fixture.nativeElement,
      () => fixture.whenStable(),
    );
    await page.settle();
    http.expectOne('/api/subscription-renewals').flush({
      punch: { exhausted: [renewalRow('a'), renewalRow('b')], active: [] },
      time: { exhausted: [renewalRow('c')], active: [renewalRow('d')] },
    });
    if (trainings !== 'pending') {
      await answerTrainings(trainings);
    }
  }

  async function answerTrainings(trainings: DayTraining[]) {
    http
      .expectOne(`/api/schedules/slots?from=${TODAY}&to=${TOMORROW}`)
      .flush({ from: TODAY, to: TOMORROW, slots: trainings });
    await page.settle();
  }

  const shown = (date: string) =>
    page
      .queryAll(
        `[data-testid="dashboard-day-${date}"] [data-testid^="dashboard-training-"]:not([data-testid="dashboard-training-status"])`,
      )
      .map((row) =>
        row.getAttribute('data-testid')!.replace('dashboard-training-', ''),
      );
  const row = (id: string) =>
    page.query<HTMLElement>(`[data-testid="dashboard-training-${id}"]`)!;
  const registerLink = (id: string) =>
    [...row(id).querySelectorAll<HTMLAnchorElement>('a')].find(
      (link) => link.textContent?.trim() === copy.trainings.register,
    );

  it("asks for today's and tomorrow's trainings (Sofia days) and starts on the trainer's own", async () => {
    await render('TRAINER', 'trainer-v', [STARTED, ASENS, TOMORROWS]);

    expect(shown(TODAY)).toEqual(['night']);
    expect(shown(TOMORROW)).toEqual(['tomorrow']);
    expect(page.text()).toContain(copy.trainings.today);
    expect(page.text()).toContain('Sunday, 22 November');
    expect(page.text()).toContain('Monday, 23 November');
    // Trainers get no admin notices.
    http.expectNone('/api/accounts?link=unlinked');
    http.expectNone('/api/settlements');
  });

  it("shows everyone's trainings with All, and keeps the choice on the device", async () => {
    await render('TRAINER', 'trainer-v', [STARTED, ASENS]);

    await page.click('input[type="radio"][value="all"]');

    expect(shown(TODAY)).toEqual(['night', 'asens']);
    expect(row('asens').textContent).toContain('Lozenets · Asen');
    expect(localStorage.getItem('dashboardTrainings')).toBe('all');
  });

  it("links the staff's Schedule next to the trainings, already while they load", async () => {
    await render('TRAINER', 'trainer-v', 'pending');

    const link = page.query<HTMLAnchorElement>(
      '[data-testid="dashboard-full-schedule"]',
    )!;
    expect(link.textContent.trim()).toBe(copy.trainings.fullSchedule);
    expect(link.getAttribute('href')).toBe('/workouts/schedule');

    await answerTrainings([]);
    expect(
      page.query('[data-testid="dashboard-full-schedule"]'),
    ).not.toBeNull();
  });

  it('says when the trainer has no trainings on a day', async () => {
    await render('TRAINER', 'trainer-v', [ASENS]);

    expect(
      page.query(`[data-testid="dashboard-day-${TODAY}"]`)!.textContent,
    ).toContain(copy.trainings.noneMine);
  });

  it('marks a started training without attendance and links Register attendance filled in with it', async () => {
    await render('TRAINER', 'trainer-v', [STARTED]);

    const status = row('night').querySelector(
      '[data-testid="dashboard-training-status"]',
    );
    expect(status?.textContent?.trim()).toBe(copy.trainings.unregistered);
    expect(row('night').textContent).toContain('Fran');
    expect(row('night').textContent).toContain('2 booked');
    const link = registerLink('night')!;
    expect(link.classList).toContain('btn--primary');
    expect(link.getAttribute('href')).toBe(
      `/attendance/new?date=${TODAY}&time=00:15&trainer=trainer-v&gym=gym-c&trainees=t-ana,t-boris`,
    );
    expect(link.getAttribute('aria-label')).toBe(
      'Register attendance for the training on Sunday, 22 November 00:15 – 01:15, Center',
    );
    expect(
      [...row('night').querySelectorAll('a')]
        .find((a) => a.textContent?.trim() === copy.trainings.details)
        ?.getAttribute('href'),
    ).toBe('/workouts/schedule/night');
  });

  it("shows a registered training's count and who booked but isn't registered", async () => {
    await render('TRAINER', 'trainer-v', [REGISTERED]);

    expect(
      row('registered')
        .querySelector('[data-testid="dashboard-training-status"]')
        ?.textContent?.trim(),
    ).toBe('Registered: 3');
    expect(row('registered').textContent).toContain(
      '1 booked trainee not registered',
    );
    expect(registerLink('registered')!.classList).toContain('btn--secondary');
  });

  it("offers no Register for tomorrow's trainings, and marks a draft week's", async () => {
    await render('TRAINER', 'trainer-v', [TOMORROWS]);

    expect(registerLink('tomorrow')).toBeUndefined();
    expect(row('tomorrow').textContent).toContain(copy.trainings.draft);
    expect(
      row('tomorrow')
        .querySelector('[data-testid="dashboard-training-status"]')
        ?.textContent?.trim(),
    ).toBe(copy.trainings.upcoming);
  });

  it('counts the trainees to renew on the Renewals shortcut', async () => {
    await render('TRAINER', 'trainer-v');

    expect(
      page
        .query('[data-testid="dashboard-renewals-count"]')
        ?.textContent?.trim(),
    ).toBe('3 to renew');
  });

  it('shows an error with Try again, which asks again', async () => {
    await render('TRAINER', 'trainer-v', 'pending');
    const error = apiError('Schedules are down', 503);
    http
      .expectOne(`/api/schedules/slots?from=${TODAY}&to=${TOMORROW}`)
      .flush(error.body, error.options);
    await page.settle();

    expect(page.alert()).toContain('Schedules are down');

    await page.click('app-empty-state button');
    await answerTrainings([STARTED]);
    expect(shown(TODAY)).toEqual(['night']);
  });

  describe('for an admin', () => {
    async function answerAdmin(
      accounts: number,
      settlements: {
        id: string;
        periodStart: string;
        periodEnd: string;
        status: string;
      }[],
    ) {
      http
        .expectOne('/api/accounts?link=unlinked')
        .flush(
          Array.from({ length: accounts }, (_, i) => ({ id: `acc-${i}` })),
        );
      http.expectOne('/api/settlements').flush(settlements);
      await page.settle();
    }

    it("lists every trainer's trainings without a scope switch when not linked to a trainer profile", async () => {
      await render('ADMIN', null, [STARTED, ASENS]);
      await answerAdmin(0, []);

      expect(shown(TODAY)).toEqual(['night', 'asens']);
      expect(page.query('input[type="radio"][value="mine"]')).toBeNull();
      expect(page.query('[data-testid="dashboard-accounts"]')).toBeNull();
      expect(page.query('[data-testid="dashboard-settlement"]')).toBeNull();
    });

    it('starts on its own trainings when linked to a trainer profile', async () => {
      await render('ADMIN', 'trainer-a', [STARTED, ASENS]);
      await answerAdmin(0, []);

      expect(shown(TODAY)).toEqual(['asens']);
    });

    it('says how many accounts wait to be connected, and which report is ready to finalize', async () => {
      await render('ADMIN', null);
      await answerAdmin(2, [
        {
          id: 'nov-1',
          periodStart: '2026-11-01',
          periodEnd: '2026-11-15',
          status: 'DRAFT',
        },
        {
          id: 'oct-2',
          periodStart: '2026-10-16',
          periodEnd: '2026-10-31',
          status: 'FINAL',
        },
      ]);

      const accounts = page.query('[data-testid="dashboard-accounts"]')!;
      expect(accounts.textContent).toContain(
        '2 accounts are waiting to be connected to a profile.',
      );
      expect(accounts.querySelector('a')?.getAttribute('href')).toBe(
        '/accounts',
      );
      const settlement = page.query('[data-testid="dashboard-settlement"]')!;
      expect(settlement.textContent).toContain(
        'The report for 1 Nov – 15 Nov 2026 is ready to finalize.',
      );
      expect(settlement.querySelector('a')?.getAttribute('href')).toBe(
        '/settlements/nov-1',
      );
    });
  });
});
