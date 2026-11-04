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
import { Plan } from '../../services/plans.service';
import { PlanEditComponent } from './plan-edit.component';

const PUNCH_PLAN: Plan = {
  id: 'p1',
  type: 'PUNCH',
  title: '10 visits',
  priceCents: 4550,
  credits: 10,
  durationDays: null,
  isActive: true,
};

describe('PlanEditComponent', () => {
  let http: HttpTestingController;
  let router: Router;
  let harness: RouterTestingHarness;
  let page: PageDriver;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'plans/:id/edit', component: PlanEditComponent },
          { path: 'plans/edit', component: PlanEditComponent },
          { path: '**', children: [] },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => http.verify());

  async function open(
    url = '/plans/p1/edit',
    plan: Plan | 'error' = PUNCH_PLAN,
  ) {
    await harness.navigateByUrl(url, PlanEditComponent);
    page = driver(
      () => harness.routeNativeElement!,
      () => harness.fixture.whenStable(),
    );
    const req = http.expectOne(`/api/plans/${url.split('/')[2]}`);
    expect(req.request.method).toBe('GET');
    if (plan === 'error') {
      const error = apiError('Plan not found', 404);
      req.flush(error.body, error.options);
    } else {
      req.flush(plan);
    }
    await page.settle();
  }

  function expectPatch() {
    const req = http.expectOne('/api/plans/p1');
    expect(req.request.method).toBe('PATCH');
    return req;
  }

  it('fills the form from the plan, with the price in euros', async () => {
    await open();

    expect(page.query<HTMLInputElement>('#plan-title')!.value).toBe(
      '10 visits',
    );
    expect(page.query<HTMLInputElement>('#plan-price')!.value).toBe('45.5');
    expect(page.query<HTMLInputElement>('#plan-credits')!.value).toBe('10');
    expect(page.query('#plan-duration')).toBeNull();
  });

  it('sends every field, with the unused one as null', async () => {
    await open();
    await page.type('#plan-title', ' 12 visits ');
    await page.type('#plan-credits', '12');
    await page.type('#plan-price', '52.2');
    await page.submit();

    const req = expectPatch();
    expect(req.request.body).toEqual({
      type: 'PUNCH',
      title: '12 visits',
      priceCents: 5220,
      isActive: true,
      credits: 12,
      durationDays: null,
    });
    req.flush({ ...PUNCH_PLAN, title: '12 visits' });
    await page.settle();

    expect(router.url).toBe('/plans');
  });

  it('switches a punch card to time-based: credits cleared, days required', async () => {
    await open();
    await page.select('#plan-type', 'TIME');
    await page.submit();
    http.expectNone('/api/plans/p1');
    expect(page.query('#plan-duration')!.getAttribute('aria-invalid')).toBe(
      'true',
    );

    await page.type('#plan-duration', '30');
    await page.submit();

    expect(expectPatch().request.body).toEqual({
      type: 'TIME',
      title: '10 visits',
      priceCents: 4550,
      isActive: true,
      credits: null,
      durationDays: 30,
    });
  });

  it('can deactivate the plan from the form', async () => {
    await open();
    await page.check('input[type="checkbox"]', false);
    await page.submit();

    expect(expectPatch().request.body.isActive).toBe(false);
  });

  it('shows the load error instead of the form', async () => {
    await open('/plans/p1/edit', 'error');

    expect(page.alert()).toBe('Plan not found');
    expect(page.query('form')).toBeNull();
  });

  it('reports a missing id without calling the API', async () => {
    await harness.navigateByUrl('/plans/edit', PlanEditComponent);
    page = driver(
      () => harness.routeNativeElement!,
      () => harness.fixture.whenStable(),
    );
    await page.settle();

    http.expectNone(() => true);
    expect(page.alert()).toBe(en.plans.errors.missingId);
  });

  it('shows a failed save and gives the button back', async () => {
    await open();
    await page.submit();
    const error = apiError('Validation failed');
    expectPatch().flush(error.body, error.options);
    await page.settle();

    // Fixed S1 (TEST_NOTES.md).
    expect(page.alert()).toBe('Validation failed');
    expect(page.text()).not.toContain(en.common.saving);
    expect(
      page.query<HTMLButtonElement>('button[type="submit"]')!.disabled,
    ).toBe(false);
  });
});
