import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import en from '../../../../public/i18n/en.json';
import { PageDriver, driver } from '../../../testing/dom';
import { signInAs } from '../../../testing/jwt';
import { RenewalsComponent } from './renewals.component';

const INACTIVE = '/api/attendance/reports/inactive-trainees';
const WITHOUT = '/api/attendance/reports/without-active-subscription';
const EMPTY = {
  punch: { exhausted: [], active: [] },
  time: { exhausted: [], active: [] },
};

/** Renewals' views (`?view=`): the renewals, and the attendance reports moved from the dashboard. */
describe('RenewalsComponent views', () => {
  let http: HttpTestingController;
  let page: PageDriver;
  let harness: RouterTestingHarness;

  beforeEach(() => {
    localStorage.clear();
    signInAs('TRAINER');
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'renewals', component: RenewalsComponent }]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function open(url: string) {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, RenewalsComponent);
    page = driver(
      () => harness.routeNativeElement!,
      () => harness.fixture.whenStable(),
    );
    await page.settle();
    http.expectOne('/api/subscription-renewals').flush(EMPTY);
    await page.settle();
  }

  const views = () =>
    page
      .queryAll<HTMLAnchorElement>('nav a')
      .map((link) => [
        link.textContent?.trim(),
        link.getAttribute('href'),
        link.getAttribute('aria-current'),
      ]);

  it('opens on the renewals, with links to the two reports', async () => {
    await open('/renewals');

    expect(views()).toEqual([
      [en.renewals.views.renewals, '/renewals', 'page'],
      [en.renewals.views.inactive, '/renewals?view=inactive', null],
      [en.renewals.views.without, '/renewals?view=without', null],
    ]);
    expect(page.text()).toContain(en.renewals.punch.exhaustedTitle);
    http.expectNone((req) => req.url.startsWith('/api/attendance/reports'));
  });

  it('shows the inactive trainees report at ?view=inactive', async () => {
    await open('/renewals?view=inactive');

    http.expectOne(`${INACTIVE}?skipDays=7`).flush([]);
    await page.settle();

    expect(views()[1][2]).toBe('page');
    expect(page.text()).toContain(en.renewals.reports.inactiveTitle);
    expect(page.text()).toContain(en.renewals.reports.noInactive);
    expect(page.text()).not.toContain(en.renewals.punch.exhaustedTitle);
  });

  it('switches to the report of trainees without a subscription from its link', async () => {
    await open('/renewals');

    await page.click('nav a[href="/renewals?view=without"]');
    http.expectOne(WITHOUT).flush([]);
    await page.settle();

    expect(TestBed.inject(Router).url).toBe('/renewals?view=without');
    expect(page.text()).toContain(en.renewals.reports.withoutTitle);
    expect(page.text()).toContain(en.renewals.reports.noWithout);
  });

  it('falls back to the renewals for an unknown view', async () => {
    await open('/renewals?view=other');

    expect(views()[0][2]).toBe('page');
    expect(page.text()).toContain(en.renewals.punch.exhaustedTitle);
  });
});
