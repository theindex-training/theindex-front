import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import en from '../../../../public/i18n/en.json';
import { PageDriver, apiError, driver } from '../../../testing/dom';
import { signInAs } from '../../../testing/jwt';
import { LocaleFormatService } from '../../i18n/locale-format.service';
import { AttendanceSubscriptionReport } from '../../services/attendance.service';
import {
  AttendanceReportComponent,
  AttendanceReportKind,
} from './attendance-report.component';

// The reports were on the dashboard until it showed the day's trainings; they moved to Renewals.
const copy = en.renewals.reports;
const INACTIVE = '/api/attendance/reports/inactive-trainees';
const WITHOUT = '/api/attendance/reports/without-active-subscription';

const report = (
  overrides: Partial<AttendanceSubscriptionReport> = {},
): AttendanceSubscriptionReport => ({
  planName: '10 visits',
  type: 'PUNCH',
  startDate: '2026-10-01',
  endDate: null,
  remainingTrainings: 4,
  remainingDays: null,
  ...overrides,
});

describe('AttendanceReportComponent', () => {
  let http: HttpTestingController;
  let page: PageDriver;
  let component: AttendanceReportComponent;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function render(kind: AttendanceReportKind) {
    signInAs('TRAINER');
    const fixture = TestBed.createComponent(AttendanceReportComponent);
    fixture.componentRef.setInput('kind', kind);
    component = fixture.componentInstance;
    page = driver(
      () => fixture.nativeElement,
      () => fixture.whenStable(),
    );
    await page.settle();
  }

  async function chooseDays(index: number) {
    const select = page.query<HTMLSelectElement>('select')!;
    await page.select('select', select.options[index].value);
  }

  it('loads the inactive trainees of the last 7 days, with their active subscription', async () => {
    await render('inactive');

    http.expectOne(`${INACTIVE}?skipDays=7`).flush([
      {
        traineeId: 't1',
        name: 'Ivan Petrov',
        nickname: 'Vanko',
        lastTrainingDate: '2026-10-20T16:30:00Z',
        activeSubscription: report(),
      },
    ]);
    await page.settle();

    expect(page.text()).toContain(copy.inactiveTitle);
    expect(page.text()).toContain('Ivan Petrov (Vanko)');
    expect(page.text()).toContain('Plan: 10 visits');
    expect(
      page.query<HTMLAnchorElement>('a.cell-link')?.getAttribute('href'),
    ).toBe('/trainees/t1');
  });

  it('loads the trainees without an active subscription, with their last one', async () => {
    await render('without');

    http.expectOne(WITHOUT).flush([
      {
        traineeId: 't2',
        name: 'Maria',
        lastTrainingDate: null,
        lastActiveSubscription: report({ planName: 'Monthly', type: 'TIME' }),
      },
    ]);
    await page.settle();

    expect(page.text()).toContain(copy.withoutTitle);
    expect(page.text()).toContain('Maria');
    expect(page.text()).toContain('Plan: Monthly');
    // Only the inactive report has a period to choose.
    expect(page.query('select')).toBeNull();
  });

  it('says so when a report is empty', async () => {
    await render('without');
    http.expectOne(WITHOUT).flush([]);
    await page.settle();

    expect(page.text()).toContain(copy.noWithout);
  });

  it('reloads the inactive report when the period changes', async () => {
    await render('inactive');
    http.expectOne(`${INACTIVE}?skipDays=7`).flush([]);
    await page.settle();

    await chooseDays(1);
    http.expectOne(`${INACTIVE}?skipDays=30`).flush([]);
    await chooseDays(2);
    http.expectOne(`${INACTIVE}?skipDays=90`).flush([]);
  });

  it('shows the newest answer only if it arrives last', async () => {
    await render('inactive');
    http.expectOne(`${INACTIVE}?skipDays=7`).flush([]);
    await page.settle();

    await chooseDays(1); // 30 days
    await chooseDays(2); // 90 days
    const thirty = http.expectOne(`${INACTIVE}?skipDays=30`);
    const ninety = http.expectOne(`${INACTIVE}?skipDays=90`);
    ninety.flush([
      { name: 'Ninety', lastTrainingDate: null, activeSubscription: null },
    ]);
    thirty.flush([
      { name: 'Thirty', lastTrainingDate: null, activeSubscription: null },
    ]);
    await page.settle();

    // CHARACTERIZATION: possibly unintended — earlier requests aren't cancelled, so a slow answer for
    // 30 days overwrites the 90-day report the user picked last. TEST_NOTES.md S4.
    expect(page.text()).toContain('Thirty');
    expect(page.text()).not.toContain('Ninety');
  });

  it("shows the API's error", async () => {
    await render('inactive');
    const error = apiError('Report failed', 500);
    http.expectOne(`${INACTIVE}?skipDays=7`).flush(error.body, error.options);
    await page.settle();

    expect(page.query('[role="alert"]')?.textContent?.trim()).toBe(
      'Report failed',
    );
  });

  it("shows the report's own fallback when the API gives no message", async () => {
    await render('without');
    const fallback = apiError(undefined, 500);
    http.expectOne(WITHOUT).flush(fallback.body, fallback.options);
    await page.settle();

    expect(page.query('[role="alert"]')?.textContent?.trim()).toBe(
      copy.withoutError,
    );
  });

  describe('row text', () => {
    beforeEach(async () => {
      await render('inactive');
      http.expectOne(`${INACTIVE}?skipDays=7`).flush([]);
    });

    it('names the trainee, with the nickname, or "Unknown"', () => {
      expect(
        component.traineeDisplayName({ name: ' Ivan ', nickname: 'Vanko' }),
      ).toBe('Ivan (Vanko)');
      expect(
        component.traineeDisplayName({ name: 'Ivan', nickname: '  ' }),
      ).toBe('Ivan');
      expect(component.traineeDisplayName({})).toBe(copy.unknown);
    });

    it('summarizes a subscription, skipping empty parts', () => {
      const format = TestBed.inject(LocaleFormatService);

      expect(component.formatSubscriptionSummary(null)).toBe('—');
      expect(component.formatSubscriptionSummary(report())).toBe(
        `Plan: 10 visits • Type: ${en.enums.planType.PUNCH} • Start: ${format.date('2026-10-01')} • Remaining trainings: 4`,
      );
      expect(
        component.formatSubscriptionSummary(
          report({
            planName: null,
            type: 'TIME',
            startDate: null,
            endDate: '2026-11-30',
            remainingTrainings: null,
            remainingDays: 0,
          }),
        ),
      ).toBe(
        `Type: ${en.enums.planType.TIME} • End: ${format.date('2026-11-30')} • Remaining days: 0`,
      );
      expect(
        component.formatSubscriptionSummary(
          report({
            type: 'FAMILY',
            planName: null,
            startDate: null,
            remainingTrainings: null,
          }),
        ),
      ).toBe('Type: FAMILY');
      expect(
        component.formatSubscriptionSummary(
          report({
            planName: null,
            type: null,
            startDate: null,
            remainingTrainings: null,
          }),
        ),
      ).toBe('—');
    });

    it('shows the last training date, or a dash', () => {
      const format = TestBed.inject(LocaleFormatService);

      expect(component.formatDateOrFallback('2026-10-20T16:30:00Z')).toBe(
        format.dateTime('2026-10-20T16:30:00Z'),
      );
      expect(component.formatDateOrFallback(null)).toBe('—');
    });
  });
});
