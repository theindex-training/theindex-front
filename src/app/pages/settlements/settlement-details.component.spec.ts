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
import { SettlementAllocation } from '../../services/settlements.service';
import { SettlementDetailsComponent } from './settlement-details.component';

const copy = en.settlements.details;

const SETTLEMENT = {
  id: 's1',
  periodStart: '2026-10-01',
  periodEnd: '2026-10-31',
  generatedAt: '2026-11-01T09:00:00Z',
  status: 'DRAFT',
  notes: null,
};
const LINES = [
  {
    id: 'l1',
    settlementId: 's1',
    trainerId: 'tr1',
    amountCents: 9000,
    attendanceCount: 12,
    unpaidAttendanceCount: 1,
    details: { punchCents: 5000, timeCents: 4000 },
  },
];
const ALLOCATION: SettlementAllocation = {
  id: 'al1',
  settlementId: 's1',
  attendanceId: 'a1',
  trainerId: 'tr1',
  subscriptionId: 'sub1',
  subscriptionType: 'PUNCH',
  valueCents: 450,
  reason: 'PUNCH_CREDIT',
  attendance: {
    id: 'a1',
    trainedAt: '2026-10-05T16:30:00Z',
    paymentStatus: 'PAID',
    trainerId: 'tr1',
    traineeId: 't1',
    subscriptionId: 'sub1',
    locationId: 'g1',
  },
};

describe('SettlementDetailsComponent', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let component: SettlementDetailsComponent;
  let page: PageDriver;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'settlements/:id', component: SettlementDetailsComponent },
          { path: 'missing-id', component: SettlementDetailsComponent },
          { path: '**', children: [] },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => http.verify());

  async function open(
    role: 'ADMIN' | 'TRAINER',
    options: {
      settlement?: object;
      entities?: 'ok' | 'error';
      allocationsTotal?: number;
    } = {},
  ) {
    signInAs(role);
    component = await harness.navigateByUrl(
      '/settlements/s1',
      SettlementDetailsComponent,
    );
    page = driver(
      () => harness.routeNativeElement!,
      () => harness.fixture.whenStable(),
    );
    const entities = [
      http.expectOne('/api/trainers'),
      http.expectOne('/api/trainees'),
      http.expectOne('/api/gym-locations?includeInactive=true'),
    ];
    if (options.entities === 'error') {
      const error = apiError(undefined, 403);
      entities.forEach((req) => req.flush(error.body, error.options));
    } else {
      entities[0].flush([
        {
          id: 'tr1',
          name: 'Petar Petrov',
          nickname: ' Pepi ',
          accountId: null,
          isActive: true,
        },
        {
          id: 'tr2',
          name: 'Maria Koleva',
          nickname: null,
          accountId: null,
          isActive: true,
        },
      ]);
      entities[1].flush([
        {
          id: 't1',
          name: 'Ivan Petrov',
          nickname: 'Vanko',
          phone: null,
          accountId: null,
          gymSubscriptionId: null,
          isActive: true,
        },
      ]);
      entities[2].flush([
        {
          id: 'g1',
          name: 'Center',
          address: null,
          notes: null,
          isActive: false,
        },
      ]);
    }
    http
      .expectOne('/api/settlements/s1')
      .flush({ settlement: options.settlement ?? SETTLEMENT, lines: LINES });
    http.expectOne('/api/settlements/s1/allocations?offset=0&limit=500').flush({
      total: options.allocationsTotal ?? 1,
      limit: 500,
      offset: 0,
      rows: [ALLOCATION],
    });
    await page.settle();
  }

  const finalizeButton = () =>
    page
      .queryAll<HTMLButtonElement>('button')
      .find((button) => button.textContent?.trim() === copy.finalize);

  it('loads the report, its allocations and the names to show', async () => {
    await open('ADMIN');

    expect(page.text()).toContain('Pepi');
    expect(page.text()).toContain('Ivan Petrov (Vanko)');
    expect(page.text()).toContain('Center');
    expect(page.text()).toContain(en.enums.settlementStatus.DRAFT);
  });

  it('links each allocation row to its trainee and shows when the training was', async () => {
    await open('ADMIN');

    const traineeLinks = page
      .queryAll<HTMLAnchorElement>('a')
      .filter((link) => link.textContent?.includes('Ivan Petrov (Vanko)'));
    // The desktop table and the phone list both render the row.
    expect(traineeLinks.map((link) => link.getAttribute('href'))).toEqual([
      '/trainees/t1',
      '/trainees/t1',
    ]);
    const trainedAt = component.formatOptionalDate(
      ALLOCATION.attendance!.trainedAt,
    );
    expect(trainedAt).not.toBe('—');
    expect(page.text().split(trainedAt).length - 1).toBe(2);
  });

  it('shows raw ids when the names cannot be loaded', async () => {
    await open('TRAINER', { entities: 'error' });

    expect(component.formatTrainer('tr1')).toBe('tr1');
    expect(component.formatTrainee('t1')).toBe('t1');
    expect(component.formatGym('g1')).toBe('g1');
    expect(component.formatTrainee(undefined)).toBe('—');
    expect(component.formatGym(null)).toBe('—');
  });

  it('lets an admin filter allocations by trainer', async () => {
    await open('ADMIN');

    await page.select('select', 'tr2');
    http
      .expectOne(
        '/api/settlements/s1/allocations?trainerId=tr2&offset=0&limit=500',
      )
      .flush({ total: 0, limit: 500, offset: 0, rows: [] });
    await page.settle();
    expect(page.text()).toContain(copy.noAllocations);

    await page.select('select', '');
    http
      .expectOne('/api/settlements/s1/allocations?offset=0&limit=500')
      .flush({ total: 1, limit: 500, offset: 0, rows: [ALLOCATION] });
  });

  it('shows at most 500 allocation rows, with no way to see the rest', async () => {
    await open('ADMIN', { allocationsTotal: 734 });

    // CHARACTERIZATION: possibly unintended — the page asks for the first 500 rows only and has no
    // paging; it says "Showing N of 734 rows". TEST_NOTES.md S10.
    expect(page.text()).toContain('Showing 1 of 734 rows');
  });

  it('lets an admin finalize a draft, then hides the button', async () => {
    await open('ADMIN');

    finalizeButton()!.click();
    await page.settle();
    const req = http.expectOne('/api/settlements/s1/finalize');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({ ...SETTLEMENT, status: 'FINAL' });
    await page.settle();

    expect(finalizeButton()).toBeUndefined();
    expect(page.text()).toContain(en.enums.settlementStatus.FINAL);
  });

  it('shows a failed finalize and keeps the draft', async () => {
    await open('ADMIN');

    finalizeButton()!.click();
    await page.settle();
    const error = apiError('Settlement has unpaid attendance', 409);
    http
      .expectOne('/api/settlements/s1/finalize')
      .flush(error.body, error.options);
    await page.settle();

    expect(page.alert()).toBe('Settlement has unpaid attendance');
    expect(finalizeButton()).toBeDefined();
  });

  it('gives a trainer no finalize button and no trainer filter', async () => {
    await open('TRAINER');

    expect(finalizeButton()).toBeUndefined();
    expect(page.query('select')).toBeNull();
    component.finalizeSettlement();
    http.expectNone('/api/settlements/s1/finalize');
  });

  it('has nothing to finalize on a final report', async () => {
    await open('ADMIN', { settlement: { ...SETTLEMENT, status: 'FINAL' } });

    expect(finalizeButton()).toBeUndefined();
    component.finalizeSettlement();
    http.expectNone('/api/settlements/s1/finalize');
  });

  it('reports a missing id without calling the API', async () => {
    signInAs('ADMIN');
    await harness.navigateByUrl('/missing-id', SettlementDetailsComponent);
    page = driver(
      () => harness.routeNativeElement!,
      () => harness.fixture.whenStable(),
    );
    await page.settle();

    http.expectNone(() => true);
    expect(page.alert()).toBe(en.settlements.errors.missingId);
  });
});
