import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import en from '../../../../public/i18n/en.json';
import { PageDriver, apiError, driver } from '../../../testing/dom';
import { signInAs } from '../../../testing/jwt';
import { SettlementGenerateComponent } from './settlement-generate.component';

const copy = en.settlements.generate;

describe('SettlementGenerateComponent', () => {
  let http: HttpTestingController;
  let router: Router;
  let page: PageDriver;

  beforeEach(async () => {
    // 00:30 on 2 Nov in Sofia, still 1 Nov in UTC. Only Date is faked.
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-01T22:30:00Z') });
    localStorage.clear();
    signInAs('ADMIN');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        // Routed as in the app, so navigating away after generating destroys the page.
        provideRouter([
          { path: 'settlements/new', component: SettlementGenerateComponent },
          { path: '**', children: [] }
        ])
      ]
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/settlements/new', SettlementGenerateComponent);
    page = driver(() => harness.routeNativeElement!, () => harness.fixture.whenStable());
    await page.settle();
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  const generate = () =>
    page.click('button[type="button"]');

  it('defaults both dates to the local today', () => {
    expect(page.query<HTMLInputElement>('#settlement-period-start')!.value).toBe('2026-11-02');
    expect(page.query<HTMLInputElement>('#settlement-period-end')!.value).toBe('2026-11-02');
  });

  it('generates the report for the period and opens it', async () => {
    await page.type('#settlement-period-start', '2026-10-01');
    await page.type('#settlement-period-end', '2026-10-31');
    await generate();

    const req = http.expectOne('/api/settlements');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ periodStart: '2026-10-01', periodEnd: '2026-10-31' });
    req.flush({ settlement: { id: 'new-1' }, lines: [] });
    await page.settle();

    expect(router.url).toBe('/settlements/new-1');
  });

  it('needs both dates', async () => {
    await page.type('#settlement-period-end', '');
    await generate();

    http.expectNone('/api/settlements');
    expect(page.alert()).toBe(copy.missingDates);
  });

  it('sends a period that ends before it starts', async () => {
    await page.type('#settlement-period-start', '2026-10-31');
    await page.type('#settlement-period-end', '2026-10-01');
    await generate();

    // CHARACTERIZATION: possibly unintended — no client-side check that the start is on or before
    // the end; only the API can reject it. TEST_NOTES.md S11.
    expect(http.expectOne('/api/settlements').request.body).toEqual({
      periodStart: '2026-10-31',
      periodEnd: '2026-10-01'
    });
  });

  it('shows the API error and stays on the page', async () => {
    await generate();
    const error = apiError('A settlement already covers this period', 409);
    http.expectOne('/api/settlements').flush(error.body, error.options);
    await page.settle();

    expect(page.alert()).toBe('A settlement already covers this period');
    expect(page.text()).toContain(copy.submit);
    expect(router.url).toBe('/settlements/new');
  });
});
