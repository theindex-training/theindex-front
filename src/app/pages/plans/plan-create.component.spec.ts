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
import { PlanCreateComponent } from './plan-create.component';

describe('PlanCreateComponent', () => {
  let component: PlanCreateComponent;
  let http: HttpTestingController;
  let router: Router;
  let page: PageDriver;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        // Routed as in the app, so navigating away after a save destroys the page.
        provideRouter([
          { path: 'plans/new', component: PlanCreateComponent },
          { path: '**', children: [] },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    const harness = await RouterTestingHarness.create();
    component = await harness.navigateByUrl('/plans/new', PlanCreateComponent);
    page = driver(
      () => harness.routeNativeElement!,
      () => harness.fixture.whenStable(),
    );
    await page.settle();
  });

  afterEach(() => http.verify());

  async function fill(values: {
    title?: string;
    type?: string;
    credits?: string;
    days?: string;
    price?: string;
  }) {
    if (values.title !== undefined)
      await page.type('#plan-title', values.title);
    if (values.type !== undefined) await page.select('#plan-type', values.type);
    if (values.credits !== undefined)
      await page.type('#plan-credits', values.credits);
    if (values.days !== undefined)
      await page.type('#plan-duration', values.days);
    if (values.price !== undefined)
      await page.type('#plan-price', values.price);
  }

  function expectPost() {
    const req = http.expectOne('/api/plans');
    expect(req.request.method).toBe('POST');
    return req;
  }

  it('creates a punch card: credits, price in cents, trimmed title, no duration', async () => {
    await fill({ title: '  10 visits ', credits: '10', price: '45.5' });
    await page.submit();

    const req = expectPost();
    expect(req.request.body).toEqual({
      type: 'PUNCH',
      title: '10 visits',
      priceCents: 4550,
      isActive: true,
      credits: 10,
    });
    expect('durationDays' in req.request.body).toBe(false);
    req.flush({ id: 'p1' });
    await page.settle();

    expect(router.url).toBe('/plans');
  });

  it('creates a time-based plan: duration, no credits', async () => {
    await fill({ title: 'Monthly', type: 'TIME', days: '30', price: '60' });
    await page.submit();

    const req = expectPost();
    expect(req.request.body).toEqual({
      type: 'TIME',
      title: 'Monthly',
      priceCents: 6000,
      isActive: true,
      durationDays: 30,
    });
    expect('credits' in req.request.body).toBe(false);
    req.flush({ id: 'p2' });
  });

  it('can create an inactive plan', async () => {
    await fill({ title: 'Old plan', credits: '5', price: '20' });
    await page.check('input[type="checkbox"]', false);
    await page.submit();

    expect(expectPost().request.body.isActive).toBe(false);
  });

  it('converts euros to cents without floating-point drift', async () => {
    // 19.99 * 100 is 1998.9999999999998 in floating point.
    await fill({ title: 'Drop-in', credits: '1', price: '19.99' });
    await page.submit();

    expect(expectPost().request.body.priceCents).toBe(1999);
  });

  it('allows a free plan (price 0)', async () => {
    await fill({ title: 'Trial', credits: '1', price: '0' });
    await page.submit();

    expect(expectPost().request.body.priceCents).toBe(0);
  });

  it.each([
    ['negative', '-1'],
    ['more than two decimals', '1.005'],
  ])('rejects a %s price', async (_, price) => {
    await fill({ title: 'Plan', credits: '10', price });
    await page.submit();

    http.expectNone('/api/plans');
    expect(page.query('#plan-price')!.getAttribute('aria-invalid')).toBe(
      'true',
    );
  });

  it.each([
    ['missing', ''],
    ['zero', '0'],
    ['fractional', '2.5'],
  ])(
    'a punch card needs whole credits of 1 or more (%s)',
    async (_, credits) => {
      await fill({ title: 'Plan', credits, price: '10' });
      await page.submit();

      http.expectNone('/api/plans');
      expect(page.query('#plan-credits')!.getAttribute('aria-invalid')).toBe(
        'true',
      );
    },
  );

  it('a time-based plan needs a whole number of days of 1 or more', async () => {
    await fill({ title: 'Plan', type: 'TIME', days: '0', price: '10' });
    await page.submit();

    http.expectNone('/api/plans');
    expect(page.query('#plan-duration')!.getAttribute('aria-invalid')).toBe(
      'true',
    );
  });

  it('clears the credits when switching to time-based and back', async () => {
    await fill({ credits: '10' });
    await fill({ type: 'TIME' });
    expect(page.query('#plan-credits')).toBeNull();
    await fill({ type: 'PUNCH' });

    expect(page.query<HTMLInputElement>('#plan-credits')!.value).toBe('');

    expect(component.form.controls.credits.value).toBeNull();
  });

  it('requires a title', async () => {
    await fill({ credits: '10', price: '10' });
    await page.submit();

    http.expectNone('/api/plans');
    expect(page.query('#plan-title')!.getAttribute('aria-invalid')).toBe(
      'true',
    );
  });

  it('accepts a title of only spaces and sends it as an empty string', async () => {
    await fill({ title: '   ', credits: '10', price: '10' });
    await page.submit();

    // CHARACTERIZATION: possibly unintended — the title has only Validators.required, unlike the
    // other forms' trimmedLength; "   " passes and is sent as "". TEST_NOTES.md S7.
    expect(expectPost().request.body.title).toBe('');
  });

  it('shows a failed save and gives the button back', async () => {
    await fill({ title: 'Plan', credits: '10', price: '10' });
    await page.submit();
    expect(page.text()).toContain(en.common.saving);

    const error = apiError('A plan with this title already exists');
    expectPost().flush(error.body, error.options);
    await page.settle();

    // Fixed S1 (TEST_NOTES.md): the error used to stay invisible and the button stuck on "Saving...".
    expect(page.alert()).toBe('A plan with this title already exists');
    expect(page.text()).not.toContain(en.common.saving);
    expect(
      page.query<HTMLButtonElement>('button[type="submit"]')!.disabled,
    ).toBe(false);
    expect(router.url).toBe('/plans/new');
  });
});
