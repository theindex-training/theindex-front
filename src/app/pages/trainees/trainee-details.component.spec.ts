import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import en from '../../../../public/i18n/en.json';
import { PageDriver, apiError, driver } from '../../../testing/dom';
import { signInAs } from '../../../testing/jwt';
import { LocaleFormatService } from '../../i18n/locale-format.service';
import { Plan } from '../../services/plans.service';
import { Subscription } from '../../services/subscriptions.service';
import { TraineeProfile } from '../../services/trainees.service';
import { TraineeDetailsComponent } from './trainee-details.component';

const copy = en.trainees.details;

const TRAINEE: TraineeProfile = {
  id: 'tr1',
  name: 'Ivan Petrov',
  nickname: 'Vanko',
  phone: null,
  accountId: null,
  gymSubscriptionId: null,
  isActive: true,
};

const PLANS: Plan[] = [
  {
    id: 'p1',
    type: 'PUNCH',
    title: '10 visits',
    priceCents: 4550,
    credits: 10,
    durationDays: null,
    isActive: true,
  },
  {
    id: 'p2',
    type: 'TIME',
    title: 'Monthly',
    priceCents: 6000,
    credits: null,
    durationDays: 30,
    isActive: true,
  },
];

function subscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 's1',
    traineeId: 'tr1',
    planId: 'p1',
    type: 'PUNCH',
    status: 'ACTIVE',
    paidCents: 4550,
    startsAt: '2026-10-01',
    endsAt: null,
    initialCredits: 10,
    remainingCredits: 7,
    ...overrides,
  };
}

describe('TraineeDetailsComponent: selling a subscription', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let component: TraineeDetailsComponent;
  let page: PageDriver;

  beforeEach(async () => {
    // 00:30 on 2 Nov in Sofia is still 1 Nov in UTC. Only Date is faked; timers stay real.
    vi.useFakeTimers({
      toFake: ['Date'],
      now: new Date('2026-11-01T22:30:00Z'),
    });
    localStorage.clear();
    signInAs('TRAINER');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'trainees/:id', component: TraineeDetailsComponent },
          { path: '**', children: [] },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  async function open(
    options: {
      plans?: Plan[];
      subscriptions?: Subscription[];
      trainee?: TraineeProfile;
      trainings?: object[];
    } = {},
  ) {
    component = await harness.navigateByUrl(
      '/trainees/tr1',
      TraineeDetailsComponent,
    );
    page = driver(
      () => harness.routeNativeElement!,
      () => harness.fixture.whenStable(),
    );
    http.expectOne('/api/trainees/tr1').flush(options.trainee ?? TRAINEE);
    http
      .expectOne('/api/trainees/tr1/subscriptions')
      .flush(options.subscriptions ?? []);
    http
      .expectOne('/api/attendance/trainees/tr1')
      .flush(options.trainings ?? []);
    http.expectOne('/api/plans?active=true').flush(options.plans ?? PLANS);
    await page.settle();
  }

  const value = (selector: string) =>
    page.query<HTMLInputElement | HTMLSelectElement>(selector)!.value;

  function expectSale() {
    const req = http.expectOne('/api/trainees/tr1/subscriptions');
    expect(req.request.method).toBe('POST');
    return req;
  }

  it('loads the trainee, subscriptions, trainings and only the active plans', async () => {
    await open();

    expect(page.text()).toContain('Ivan Petrov');
    expect(
      page
        .queryAll('#buy-plan option')
        .map((option) => option.textContent?.trim()),
    ).toEqual([
      component.formatPlanOption(PLANS[0]),
      component.formatPlanOption(PLANS[1]),
    ]);
  });

  it("shows the trainee's trainings in a calendar of the current month by default, and as a list on request", async () => {
    await open({
      trainings: [
        {
          id: 'a1',
          traineeId: 'tr1',
          trainerId: 'trn1',
          trainer: { id: 'trn1', name: 'Petar Petrov', nickname: 'Pepi' },
          locationId: 'g1',
          location: { id: 'g1', name: 'Center' },
          trainedAt: '2026-11-01T16:30:00Z',
          subscriptionId: null,
          gymSubscriptionId: null,
          paymentStatus: 'UNPAID',
          createdAt: '2026-11-01T16:30:00Z',
        },
      ],
    });

    const section = page.query('section[aria-labelledby="trainings-title"]')!;
    expect(section.querySelector('#trainings-title')!.textContent.trim()).toBe(
      copy.trainings,
    );
    expect(
      section
        .querySelector('[data-testid="calendar-month"]')!
        .textContent.trim(),
    ).toBe('November 2026');
    expect(
      section
        .querySelector('[data-testid="calendar-day-2026-11-01"]')!
        .getAttribute('aria-label'),
    ).toBe('Sunday, 1 November 2026, 1 training, 1 unpaid');

    await page.click(
      'section[aria-labelledby="trainings-title"] input[type="radio"][value="list"]',
    );
    expect(section.querySelector('table caption')!.textContent.trim()).toBe(
      'Trainings',
    );
    expect(section.querySelector('tbody')!.textContent).toContain('Pepi');
  });

  it('says there are no trainings yet in the calendar', async () => {
    await open();

    expect(
      page.query('[data-testid="calendar-summary"]')!.textContent.trim(),
    ).toBe(copy.noTrainings);
  });

  it('also loads the linked account', async () => {
    component = await harness.navigateByUrl(
      '/trainees/tr1',
      TraineeDetailsComponent,
    );
    page = driver(
      () => harness.routeNativeElement!,
      () => harness.fixture.whenStable(),
    );
    http
      .expectOne('/api/trainees/tr1')
      .flush({ ...TRAINEE, accountId: 'acc-9' });
    http.expectOne('/api/trainees/tr1/subscriptions').flush([]);
    http.expectOne('/api/attendance/trainees/tr1').flush([]);
    http.expectOne('/api/plans?active=true').flush(PLANS);
    http.expectOne('/api/accounts/acc-9').flush({
      id: 'acc-9',
      email: 'ivan@gym.test',
      role: 'TRAINEE',
      status: 'ACTIVE',
    });
    await page.settle();

    expect(page.text()).toContain('ivan@gym.test');
  });

  it('preselects the first plan and prefills its price in euros', async () => {
    await open();

    expect(value('#buy-plan')).toBe('p1');
    expect(value('#buy-paid')).toBe('45.5');
  });

  it('refills the price when another plan is picked, overwriting a typed amount', async () => {
    await open();
    await page.type('#buy-paid', '30');
    await page.select('#buy-plan', 'p2');

    expect(value('#buy-paid')).toBe('60');
  });

  it("defaults the start date to today's local date", async () => {
    await open();

    // Fixed S2 (TEST_NOTES.md): at 00:30 Sofia time on 2 Nov this used to be 1 Nov (the UTC date).
    expect(value('#buy-starts-at')).toBe('2026-11-02');
  });

  it('sells the subscription: plan, start date and the paid amount in cents', async () => {
    await open();
    await page.select('#buy-plan', 'p2');
    await page.type('#buy-starts-at', '2026-11-03');
    await page.type('#buy-paid', '40.5');
    await page.submit('form');

    const req = expectSale();
    expect(req.request.body).toEqual({
      planId: 'p2',
      startsAt: '2026-11-03',
      paidCents: 4050,
    });
    req.flush(subscription({ id: 's9', planId: 'p2', type: 'TIME' }));
    await page.settle();

    const reload = http.expectOne('/api/trainees/tr1/subscriptions');
    expect(reload.request.method).toBe('GET');
    reload.flush([
      subscription({
        id: 's9',
        planId: 'p2',
        type: 'TIME',
        endsAt: '2026-12-03',
      }),
    ]);
    await page.settle();

    expect(page.text()).toContain('Monthly');
    expect(value('#buy-plan')).toBe('p2');
    expect(value('#buy-paid')).toBe('60');
    expect(value('#buy-starts-at')).toBe('2026-11-02');
  });

  it('converts euros to cents without floating-point drift', async () => {
    await open();
    await page.type('#buy-paid', '19.99');
    await page.submit('form');

    expect(expectSale().request.body.paidCents).toBe(1999);
  });

  it.each([
    ['empty', ''],
    ['negative', '-1'],
    ['more than two decimals', '45.555'],
  ])('rejects an %s paid amount', async (_, paid) => {
    await open();
    await page.type('#buy-paid', paid);
    await page.submit('form');

    http.expectNone((req) => req.method === 'POST');
    expect(page.text()).toContain(copy.paidError);
  });

  it('accepts a free subscription (paid 0)', async () => {
    await open();
    await page.type('#buy-paid', '0');
    await page.submit('form');

    expect(expectSale().request.body.paidCents).toBe(0);
  });

  it('shows a failed sale and gives the button back', async () => {
    await open();
    await page.submit('form');
    expect(page.text()).toContain(copy.purchasing);

    const error = apiError('Trainee already has an active subscription');
    expectSale().flush(error.body, error.options);
    await page.settle();

    // Fixed S1 (TEST_NOTES.md): the alert used to stay invisible and the button stuck on "Purchasing...".
    expect(page.alert()).toBe('Trainee already has an active subscription');
    expect(page.text()).not.toContain(copy.purchasing);
    expect(page.text()).toContain(copy.buySubmit);
  });

  it('names a subscription on a deactivated plan by its raw plan id', async () => {
    await open({
      subscriptions: [subscription({ planId: 'retired-plan-id' })],
    });

    // CHARACTERIZATION: possibly unintended — only active plans are loaded (?active=true), so a
    // subscription on a deactivated plan shows the plan's id instead of its title. TEST_NOTES.md S3.
    expect(page.text()).toContain('retired-plan-id');
  });
});

describe('TraineeDetailsComponent: subscriptions list', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let component: TraineeDetailsComponent;
  let page: PageDriver;

  const SUBSCRIPTIONS = [
    subscription({ id: 's-active', status: 'ACTIVE', startsAt: '2026-10-01' }),
    subscription({
      id: 's-used',
      status: 'exhausted',
      remainingCredits: 0,
      startsAt: '2026-09-01',
    }),
    subscription({
      id: 's-old',
      planId: 'p2',
      type: 'TIME',
      status: 'EXPIRED',
      endsAt: '2026-08-31',
      startsAt: '2026-08-01',
    }),
  ];

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'trainees/:id', component: TraineeDetailsComponent },
          { path: '**', children: [] },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  async function open(
    options: {
      role?: 'ADMIN' | 'TRAINER';
      subscriptions?: Subscription[];
      plans?: 'ok' | 'error';
    } = {},
  ) {
    signInAs(options.role ?? 'TRAINER');
    component = await harness.navigateByUrl(
      '/trainees/tr1',
      TraineeDetailsComponent,
    );
    page = driver(
      () => harness.routeNativeElement!,
      () => harness.fixture.whenStable(),
    );
    http.expectOne('/api/trainees/tr1').flush(TRAINEE);
    http
      .expectOne('/api/trainees/tr1/subscriptions')
      .flush(options.subscriptions ?? SUBSCRIPTIONS);
    http.expectOne('/api/attendance/trainees/tr1').flush([]);
    const plans = http.expectOne('/api/plans?active=true');
    if (options.plans === 'error') {
      const error = apiError('Plans are unavailable', 503);
      plans.flush(error.body, error.options);
    } else {
      plans.flush(PLANS);
    }
    await page.settle();
  }

  const deleteButtons = () =>
    page.queryAll<HTMLButtonElement>(
      'button[aria-label^="Delete subscription"]',
    );

  async function showFilter(value: 'ACTIVE' | 'EXHAUSTED' | 'ALL') {
    await page.click(`input[type="radio"][value="${value}"]`);
  }

  it('shows active subscriptions first, and filters by status (any case)', async () => {
    await open();
    expect(component.filteredSubscriptions.map((item) => item.id)).toEqual([
      's-active',
    ]);

    await showFilter('EXHAUSTED');
    expect(component.filteredSubscriptions.map((item) => item.id)).toEqual([
      's-used',
    ]);

    await showFilter('ALL');
    expect(component.filteredSubscriptions.map((item) => item.id)).toEqual([
      's-active',
      's-used',
      's-old',
    ]);
  });

  it.each([
    ['ACTIVE', copy.noActiveSubscriptions],
    ['EXHAUSTED', copy.noExhaustedSubscriptions],
    ['ALL', copy.noSubscriptions],
  ] as const)('explains an empty %s list', async (filter, message) => {
    await open({ subscriptions: [] });
    await showFilter(filter);

    expect(page.text()).toContain(message);
  });

  it.each(['ADMIN', 'TRAINER'] as const)(
    'lets a %s delete subscriptions',
    async (role) => {
      await open({ role });

      expect(component.canDeleteSubscriptions).toBe(true);
      expect(deleteButtons().length).toBeGreaterThan(0);
    },
  );

  it('asks before deleting, and does nothing when cancelled', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await open();
    const format = TestBed.inject(LocaleFormatService);

    deleteButtons()[0].click();
    await page.settle();

    expect(confirm).toHaveBeenCalledWith(
      `Delete the 10 visits subscription from ${format.date('2026-10-01')}?`,
    );
    http.expectNone('/api/subscriptions/s-active');
  });

  it('deletes the subscription and removes it from the list', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await open();

    deleteButtons()[0].click();
    await page.settle();
    const req = http.expectOne('/api/subscriptions/s-active');
    expect(req.request.method).toBe('DELETE');
    req.flush({ deleted: true });
    await page.settle();

    expect(component.subscriptions.map((item) => item.id)).toEqual([
      's-used',
      's-old',
    ]);
    expect(page.text()).toContain(copy.noActiveSubscriptions);
  });

  it('ignores a second delete while one is in progress', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await open();
    await showFilter('ALL');

    component.deleteSubscription(SUBSCRIPTIONS[0]);
    component.deleteSubscription(SUBSCRIPTIONS[1]);

    http.expectOne('/api/subscriptions/s-active').flush({ deleted: true });
    http.expectNone('/api/subscriptions/s-used');
  });

  it('shows the API error when a delete fails, and keeps the subscription', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await open();

    deleteButtons()[0].click();
    await page.settle();
    const error = apiError('Subscription has attendance', 409);
    http
      .expectOne('/api/subscriptions/s-active')
      .flush(error.body, error.options);
    await page.settle();

    expect(page.alert()).toBe('Subscription has attendance');
    expect(component.subscriptions.length).toBe(3);
  });

  it('reports a plans load error in the subscriptions area', async () => {
    await open({ plans: 'error' });

    expect(component.subscriptionErrorMessage).toEqual({
      text: 'Plans are unavailable',
    });
    expect(page.alert()).toBe('Plans are unavailable');
    expect(page.queryAll('#buy-plan option').length).toBe(0);
  });

  it('describes each plan option as "title · type · price"', async () => {
    await open();
    const format = TestBed.inject(LocaleFormatService);

    expect(component.formatPlanOption(PLANS[1])).toBe(
      `Monthly · ${en.enums.planType.TIME} · ${format.money(6000)}`,
    );
  });
});
