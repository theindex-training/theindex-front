import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import en from '../../../../public/i18n/en.json';
import { PageDriver, apiError, driver } from '../../../testing/dom';
import { signInAs } from '../../../testing/jwt';
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
  isActive: true
};

const PLANS: Plan[] = [
  { id: 'p1', type: 'PUNCH', title: '10 visits', priceCents: 4550, credits: 10, durationDays: null, isActive: true },
  { id: 'p2', type: 'TIME', title: 'Monthly', priceCents: 6000, credits: null, durationDays: 30, isActive: true }
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
    ...overrides
  };
}

describe('TraineeDetailsComponent: selling a subscription', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let component: TraineeDetailsComponent;
  let page: PageDriver;

  beforeEach(async () => {
    // 00:30 on 2 Nov in Sofia is still 1 Nov in UTC. Only Date is faked; timers stay real.
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-01T22:30:00Z') });
    localStorage.clear();
    signInAs('TRAINER');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'trainees/:id', component: TraineeDetailsComponent },
          { path: '**', children: [] }
        ])
      ]
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  async function open(options: { plans?: Plan[]; subscriptions?: Subscription[]; trainee?: TraineeProfile } = {}) {
    component = await harness.navigateByUrl('/trainees/tr1', TraineeDetailsComponent);
    page = driver(() => harness.routeNativeElement!, () => harness.fixture.whenStable());
    http.expectOne('/api/trainees/tr1').flush(options.trainee ?? TRAINEE);
    http.expectOne('/api/trainees/tr1/subscriptions').flush(options.subscriptions ?? []);
    http.expectOne('/api/attendance/trainees/tr1').flush([]);
    http.expectOne('/api/plans?active=true').flush(options.plans ?? PLANS);
    await page.settle();
  }

  const value = (selector: string) => page.query<HTMLInputElement | HTMLSelectElement>(selector)!.value;

  function expectSale() {
    const req = http.expectOne('/api/trainees/tr1/subscriptions');
    expect(req.request.method).toBe('POST');
    return req;
  }

  it('loads the trainee, subscriptions, trainings and only the active plans', async () => {
    await open();

    expect(page.text()).toContain('Ivan Petrov');
    expect(page.queryAll('#buy-plan option').map(option => option.textContent?.trim())).toEqual([
      component.formatPlanOption(PLANS[0]),
      component.formatPlanOption(PLANS[1])
    ]);
  });

  it('also loads the linked account', async () => {
    component = await harness.navigateByUrl('/trainees/tr1', TraineeDetailsComponent);
    page = driver(() => harness.routeNativeElement!, () => harness.fixture.whenStable());
    http.expectOne('/api/trainees/tr1').flush({ ...TRAINEE, accountId: 'acc-9' });
    http.expectOne('/api/trainees/tr1/subscriptions').flush([]);
    http.expectOne('/api/attendance/trainees/tr1').flush([]);
    http.expectOne('/api/plans?active=true').flush(PLANS);
    http
      .expectOne('/api/accounts/acc-9')
      .flush({ id: 'acc-9', email: 'ivan@gym.test', role: 'TRAINEE', status: 'ACTIVE' });
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

  it("defaults the start date to today's UTC date", async () => {
    await open();

    // CHARACTERIZATION: possibly unintended — toISOString() gives the UTC date: at 00:30 Sofia time
    // on 2 Nov this is still 1 Nov. Register attendance and settlements use the local date.
    // TEST_NOTES.md S2.
    expect(value('#buy-starts-at')).toBe('2026-11-01');
  });

  it('sells the subscription: plan, start date and the paid amount in cents', async () => {
    await open();
    await page.select('#buy-plan', 'p2');
    await page.type('#buy-starts-at', '2026-11-03');
    await page.type('#buy-paid', '40.5');
    await page.submit('form');

    const req = expectSale();
    expect(req.request.body).toEqual({ planId: 'p2', startsAt: '2026-11-03', paidCents: 4050 });
    req.flush(subscription({ id: 's9', planId: 'p2', type: 'TIME' }));
    await page.settle();

    const reload = http.expectOne('/api/trainees/tr1/subscriptions');
    expect(reload.request.method).toBe('GET');
    reload.flush([subscription({ id: 's9', planId: 'p2', type: 'TIME', endsAt: '2026-12-03' })]);
    await page.settle();

    expect(page.text()).toContain('Monthly');
    expect(value('#buy-plan')).toBe('p2');
    expect(value('#buy-paid')).toBe('60');
    expect(value('#buy-starts-at')).toBe('2026-11-01');
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
    ['more than two decimals', '45.555']
  ])('rejects an %s paid amount', async (_, paid) => {
    await open();
    await page.type('#buy-paid', paid);
    await page.submit('form');

    http.expectNone(req => req.method === 'POST');
    expect(page.text()).toContain(copy.paidError);
  });

  it('accepts a free subscription (paid 0)', async () => {
    await open();
    await page.type('#buy-paid', '0');
    await page.submit('form');

    expect(expectSale().request.body.paidCents).toBe(0);
  });

  it('does not show a failed sale to the user', async () => {
    await open();
    await page.submit('form');
    expect(page.text()).toContain(copy.purchasing);

    const error = apiError('Trainee already has an active subscription');
    expectSale().flush(error.body, error.options);
    await page.settle();

    expect(component.subscriptionErrorMessage).toEqual({
      text: 'Trainee already has an active subscription'
    });
    // CHARACTERIZATION: possibly unintended — no detectChanges() in the error handler (zoneless):
    // the alert never renders and the button stays "Purchasing..." until the next interaction.
    // TEST_NOTES.md S1.
    expect(page.alert()).toBeUndefined();
    expect(page.text()).toContain(copy.purchasing);
  });

  it('names a subscription on a deactivated plan by its raw plan id', async () => {
    await open({ subscriptions: [subscription({ planId: 'retired-plan-id' })] });

    // CHARACTERIZATION: possibly unintended — only active plans are loaded (?active=true), so a
    // subscription on a deactivated plan shows the plan's id instead of its title. TEST_NOTES.md S3.
    expect(page.text()).toContain('retired-plan-id');
  });
});
