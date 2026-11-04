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
import { Subscription } from '../../services/subscriptions.service';
import { TraineeDashboardComponent } from './trainee-dashboard.component';

const copy = en.traineeDashboard;

const subscription = (
  id: string,
  status: string,
  planId = 'p1',
): Subscription => ({
  id,
  traineeId: 'trainee-1',
  planId,
  type: 'PUNCH',
  status,
  paidCents: 4550,
  startsAt: '2026-10-01',
  endsAt: null,
  initialCredits: 10,
  remainingCredits: 3,
});

describe('TraineeDashboardComponent', () => {
  let http: HttpTestingController;
  let page: PageDriver;
  let component: TraineeDashboardComponent;

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

  async function render(traineeProfileId: string | null = 'trainee-1') {
    signInAs('TRAINEE', { traineeProfileId });
    const fixture = TestBed.createComponent(TraineeDashboardComponent);
    component = fixture.componentInstance;
    page = driver(
      () => fixture.nativeElement,
      () => fixture.whenStable(),
    );
    await page.settle();
  }

  async function flushAll(subscriptions: Subscription[]) {
    http.expectOne('/api/attendance/trainees/trainee-1').flush([]);
    http
      .expectOne('/api/trainees/trainee-1/subscriptions')
      .flush(subscriptions);
    http
      .expectOne((req) => req.urlWithParams === '/api/plans')
      .flush([
        {
          id: 'p1',
          type: 'PUNCH',
          title: '10 visits',
          priceCents: 4550,
          credits: 10,
          durationDays: null,
          isActive: false,
        },
      ]);
    await page.settle();
  }

  it('loads trainings, subscriptions and every plan (inactive ones too) for the signed-in trainee', async () => {
    await render();
    await flushAll([subscription('s1', 'ACTIVE')]);

    expect(page.text()).toContain('10 visits');
    expect(page.text()).toContain(copy.noTrainings);
  });

  it('shows my trainings in a calendar of the current month by default, and as a list on request', async () => {
    vi.useFakeTimers({
      toFake: ['Date'],
      now: new Date('2026-10-31T10:00:00Z'),
    });
    try {
      await render();
      http.expectOne('/api/attendance/trainees/trainee-1').flush([
        {
          id: 'a1',
          traineeId: 'trainee-1',
          trainerId: 'tr1',
          trainer: { id: 'tr1', name: 'Petar Petrov', nickname: 'Pepi' },
          locationId: 'g1',
          location: { id: 'g1', name: 'Center' },
          trainedAt: '2026-10-30T16:30:00Z',
          subscriptionId: null,
          gymSubscriptionId: null,
          paymentStatus: 'PAID',
          createdAt: '2026-10-30T16:30:00Z',
        },
      ]);
      http.expectOne('/api/trainees/trainee-1/subscriptions').flush([]);
      http.expectOne((req) => req.urlWithParams === '/api/plans').flush([]);
      await page.settle();

      expect(page.query('#my-trainings-title')!.textContent.trim()).toBe(
        copy.trainings,
      );
      expect(
        page.query('[data-testid="calendar-month"]')!.textContent.trim(),
      ).toBe('October 2026');
      expect(
        page.query('[data-testid="calendar-summary"]')!.textContent.trim(),
      ).toBe('1 training · 1 paid · 0 unpaid');
      expect(
        page.query('[data-testid="calendar-day-2026-10-30"]')!.textContent,
      ).toContain('Pepi');

      await page.click('input[type="radio"][value="list"]');
      expect(page.query('app-trainings-calendar')).toBeNull();
      expect(page.query('table caption')?.textContent?.trim()).toBe(
        'Trainings',
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows active subscriptions first and filters by status, in any case', async () => {
    await render();
    await flushAll([
      subscription('s1', 'active'),
      subscription('s2', 'EXHAUSTED'),
      subscription('s3', 'EXPIRED'),
    ]);
    expect(component.filteredSubscriptions.map((item) => item.id)).toEqual([
      's1',
    ]);

    await page.click('input[type="radio"][value="EXHAUSTED"]');
    expect(component.filteredSubscriptions.map((item) => item.id)).toEqual([
      's2',
    ]);

    await page.click('input[type="radio"][value="ALL"]');
    expect(component.filteredSubscriptions.map((item) => item.id)).toEqual([
      's1',
      's2',
      's3',
    ]);
  });

  it.each([
    ['ACTIVE', copy.noActiveSubscriptions],
    ['EXHAUSTED', copy.noExhaustedSubscriptions],
    ['ALL', copy.noSubscriptions],
  ])('explains an empty %s list', async (filter, message) => {
    await render();
    await flushAll([]);
    await page.click(`input[type="radio"][value="${filter}"]`);

    expect(page.text()).toContain(message);
  });

  it('shows one error everywhere when any request fails', async () => {
    await render();
    const error = apiError('Service unavailable', 503);
    http
      .expectOne('/api/attendance/trainees/trainee-1')
      .flush(error.body, error.options);
    http.match(() => true);
    await page.settle();

    expect(component.errorMessage).toEqual({ text: 'Service unavailable' });
    expect(component.subscriptionErrorMessage).toEqual({
      text: 'Service unavailable',
    });
    expect(component.trainingErrorMessage).toEqual({
      text: 'Service unavailable',
    });
    expect(page.text()).toContain('Service unavailable');
  });

  it('shows empty lists, not an explanation, for a token without a trainee profile', async () => {
    await render(null);

    http.expectNone(() => true);
    expect(component.errorMessage).toEqual({
      key: 'traineeDashboard.missingProfile',
      params: undefined,
    });
    // CHARACTERIZATION: possibly unintended — the page-level error only renders while `loading` is
    // true, but loading is always false once an error is set, so it never shows. With no profile id
    // the tables get no error either: the trainee reads "No active subscriptions" / "No trainings
    // yet" instead of the missing-profile message. TEST_NOTES.md S16.
    expect(page.text()).not.toContain(copy.missingProfile);
    expect(page.text()).toContain(copy.noActiveSubscriptions);
    expect(page.text()).toContain(copy.noTrainings);
  });

  it('never shows the page-level error, even when loading fails', async () => {
    await render();
    const error = apiError('Service unavailable', 503);
    http
      .expectOne('/api/attendance/trainees/trainee-1')
      .flush(error.body, error.options);
    http.match(() => true);
    await page.settle();

    // CHARACTERIZATION: possibly unintended — same `errorMessage && loading` condition (S16); the
    // error still reaches the user through the two tables.
    expect(page.text()).not.toContain(copy.loadErrorTitle);
    expect(page.queryAll('[role="alert"]').length).toBe(2);
  });
});
