import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LanguageService } from '../../i18n/language.service';
import { PageDriver, apiError, driver } from '../../../testing/dom';
import { signInAs } from '../../../testing/jwt';
import {
  RenewalRow,
  SubscriptionRenewals,
} from '../../services/subscription-renewals.service';
import { RenewalsComponent } from './renewals.component';

const row = (overrides: Partial<RenewalRow>): RenewalRow => ({
  traineeId: 't1',
  name: 'Georgi Ivanov',
  nickname: null,
  planTitle: '16 trainings',
  activeSubscriptions: 0,
  remainingCredits: null,
  endsAt: null,
  daysLeft: null,
  daysSinceEnd: null,
  unpaidTrainings: 0,
  lastTrainedAt: null,
  ...overrides,
});

const RENEWALS: SubscriptionRenewals = {
  punch: {
    exhausted: [
      row({
        traineeId: 'p1',
        name: 'Ivan Petrov',
        nickname: 'Vanko',
        unpaidTrainings: 3,
        lastTrainedAt: '2026-11-06T16:00:00.000Z',
      }),
      row({ traineeId: 'p2', name: 'Maria Koleva', unpaidTrainings: 0 }),
    ],
    active: [
      row({
        traineeId: 'p3',
        name: 'Ana Dimova',
        activeSubscriptions: 1,
        remainingCredits: 1,
        lastTrainedAt: '2026-11-08T16:00:00.000Z',
      }),
      row({
        traineeId: 'p4',
        name: 'Boris Stoev',
        activeSubscriptions: 2,
        remainingCredits: 32,
      }),
    ],
  },
  time: {
    exhausted: [
      row({
        traineeId: 't1',
        name: 'Georgi Ivanov',
        planTitle: 'Month',
        endsAt: '2026-10-31T10:00:00.000Z',
        daysSinceEnd: 9,
        unpaidTrainings: 2,
      }),
    ],
    active: [
      row({
        traineeId: 't2',
        name: 'Elena Toneva',
        planTitle: 'Month',
        activeSubscriptions: 1,
        endsAt: '2026-11-09T20:30:00.000Z',
        daysLeft: 0,
      }),
      row({
        traineeId: 't3',
        name: 'Petar Nikolov',
        planTitle: 'Month',
        activeSubscriptions: 1,
        endsAt: '2026-11-19T10:00:00.000Z',
        daysLeft: 10,
      }),
    ],
  },
};

describe('RenewalsComponent', () => {
  let http: HttpTestingController;
  let page: PageDriver;

  beforeEach(() => {
    localStorage.clear();
    signInAs('TRAINER');
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function render(): Promise<void> {
    const fixture = TestBed.createComponent(RenewalsComponent);
    page = driver(
      () => fixture.nativeElement,
      () => fixture.whenStable(),
    );
    await page.settle();
  }

  async function flush(body: SubscriptionRenewals = RENEWALS) {
    http
      .expectOne(
        (req) =>
          req.method === 'GET' &&
          req.urlWithParams === '/api/subscription-renewals',
      )
      .flush(body);
    await page.settle();
  }

  const squash = (text: string | null | undefined) =>
    (text ?? '').replace(/\s+/g, ' ').trim();

  /** Cell text without the avatar initials. */
  const cellText = (cell: Element) =>
    squash((cell.querySelector('.person-cell__text') ?? cell).textContent);

  /** The desktop table of a section, as rows of cell texts (header row first). */
  const table = (section: string) =>
    page
      .queryAll(`[data-testid="renewals-${section}"] table tr`)
      .map((tr) =>
        Array.from(tr.querySelectorAll('th, td')).map(cellText).filter(Boolean),
      );

  /** The mobile rows of a section as "title | meta | chip". */
  const mobileRows = (section: string) =>
    page
      .queryAll(`[data-testid="renewals-${section}"] app-list-row`)
      .map((el) =>
        ['.list-row__title', '.list-row__meta', '.list-row__trailing']
          .map((part) => squash(el.querySelector(part)?.textContent))
          .join(' | '),
      );

  const section = (id: string) =>
    squash(page.query(`[data-testid="renewals-${id}"]`)?.textContent);

  it('shows the punch tab first: used up by most unpaid, then active by fewest left', async () => {
    await render();
    await flush();

    expect(table('punch-exhausted')).toEqual([
      ['Trainee', 'Plan', 'Unpaid trainings', 'Last training', 'Details'],
      ['Ivan Petrov“Vanko”', '16 trainings', '3', '6 Nov 2026'],
      ['Maria Koleva', '16 trainings', '0', '—'],
    ]);
    expect(section('punch-exhausted')).toContain('2 trainees');
    expect(table('punch-active')).toEqual([
      ['Trainee', 'Plan', 'Trainings left', 'Last training', 'Details'],
      ['Ana Dimova', '16 trainings', '1', '8 Nov 2026'],
      // Two cards running: the API sums the trainings; the plan says how many.
      ['Boris Stoev', '16 trainings · 2 subscriptions', '32', '—'],
    ]);
    expect(mobileRows('punch-exhausted')[0]).toBe(
      'Ivan Petrov “Vanko” | 16 trainings | 3 unpaid',
    );
    expect(mobileRows('punch-active')[1]).toBe(
      'Boris Stoev | 16 trainings · 2 subscriptions | 32 left',
    );
    // The time tab's sections are not shown.
    expect(page.query('[data-testid="renewals-time-active"]')).toBeNull();
  });

  it('links every trainee to their details page', async () => {
    await render();
    await flush();

    const links = page
      .queryAll('[data-testid="renewals-punch-exhausted"] a.cell-link')
      .map((a) => a.getAttribute('href'));
    expect(links).toEqual(['/trainees/p1', '/trainees/p2']);
  });

  it('switches to the time tab without asking the API again', async () => {
    await render();
    await flush();

    await page.click('input[type="radio"][value="time"]');

    expect(table('time-exhausted')).toEqual([
      ['Trainee', 'Plan', 'Ended on', 'Expired', 'Unpaid trainings', 'Details'],
      ['Georgi Ivanov', 'Month', '31 Oct 2026', '9 days ago', '2'],
    ]);
    expect(table('time-active')).toEqual([
      ['Trainee', 'Plan', 'Ends on', 'Days left', 'Last training', 'Details'],
      ['Elena Toneva', 'Month', '9 Nov 2026', 'Ends today', '—'],
      ['Petar Nikolov', 'Month', '19 Nov 2026', '10 days', '—'],
    ]);
    expect(mobileRows('time-exhausted')).toEqual([
      'Georgi Ivanov | Month · 2 unpaid | 9 days ago',
    ]);
    expect(mobileRows('time-active')).toEqual([
      'Elena Toneva | Month · 9 Nov 2026 | Ends today',
      'Petar Nikolov | Month · 19 Nov 2026 | 10 days left',
    ]);
    expect(page.query('[data-testid="renewals-punch-active"]')).toBeNull();
  });

  it('says so when a section is empty', async () => {
    await render();
    await flush({
      punch: { exhausted: [], active: RENEWALS.punch.active },
      time: { exhausted: [], active: [] },
    });

    expect(section('punch-exhausted')).toContain(
      'No one has used up their punch subscription.',
    );
    expect(
      page.queryAll('[data-testid="renewals-punch-exhausted"] table'),
    ).toHaveLength(0);

    await page.click('input[type="radio"][value="time"]');
    expect(section('time-exhausted')).toContain(
      'No expired time-based subscriptions.',
    );
    expect(section('time-active')).toContain(
      'No active time-based subscriptions.',
    );
  });

  it('shows the API error and loads again on "Try again"', async () => {
    await render();
    const error = apiError('Database is down', 500);
    http
      .expectOne('/api/subscription-renewals')
      .flush(error.body, error.options);
    await page.settle();

    expect(page.text()).toContain("Couldn't load subscriptions");
    expect(page.text()).toContain('Database is down');

    await page.click('app-empty-state button');
    await flush();
    expect(table('punch-exhausted')).toHaveLength(3);
  });

  it('renders in Bulgarian, plurals included', async () => {
    TestBed.inject(LanguageService).use('bg').subscribe();
    await render();
    await flush();

    expect(section('punch-exhausted')).toContain('Изчерпани');
    expect(mobileRows('punch-exhausted')[0]).toContain('3 неплатени');
    expect(mobileRows('punch-active')[0]).toContain('Остава 1');
    expect(mobileRows('punch-active')[1]).toContain('2 абонамента');
  });
});
