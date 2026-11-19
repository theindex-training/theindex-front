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
import {
  SettlementAllocation,
  SettlementLine,
  SettlementWaiting,
} from '../../services/settlements.service';
import { SettlementDetailsComponent } from './settlement-details.component';

const copy = en.settlements.details;

const SETTLEMENT = {
  id: 's1',
  periodStart: '2026-10-01',
  periodEnd: '2026-10-31',
  generatedAt: '2026-11-01T09:00:00Z',
  status: 'DRAFT',
  finalizedAt: null,
  notes: null,
};
const LINES: SettlementLine[] = [
  {
    trainerId: 'tr1',
    amountCents: 9000,
    attendanceCount: 12,
    punchCents: 5000,
    timeCents: 4000,
    earlierPeriodsCents: 1234,
    earlierPeriodsCount: 2,
    waitingCount: 3,
  },
];
const WAITING: SettlementWaiting[] = [
  {
    attendanceId: 'w1',
    trainerId: 'tr1',
    traineeId: 't1',
    locationId: 'g1',
    trainedAt: '2026-10-07T16:30:00Z',
    reason: 'UNPAID',
    subscriptionType: null,
    availableFrom: null,
  },
  {
    attendanceId: 'w2',
    trainerId: 'tr2',
    traineeId: 't1',
    locationId: 'g1',
    trainedAt: '2026-10-08T16:30:00Z',
    reason: 'TIME_PASS_NOT_ENDED',
    subscriptionType: 'TIME',
    availableFrom: '2026-11-20T22:00:00Z',
  },
  {
    attendanceId: 'w3',
    trainerId: 'tr1',
    traineeId: 't1',
    locationId: 'g1',
    trainedAt: '2026-10-09T16:30:00Z',
    reason: 'NEXT_REPORT',
    subscriptionType: 'PUNCH',
    availableFrom: '2026-11-02T10:00:00Z',
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
  fromEarlierPeriod: false,
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

const PETAR_PHOTO = 'https://media.test/profile-photos/tr1/s128.webp';

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

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  async function open(
    role: 'ADMIN' | 'TRAINER',
    options: {
      settlement?: object;
      entities?: 'ok' | 'error';
      allocationsTotal?: number;
      allocations?: SettlementAllocation[];
      waiting?: SettlementWaiting[];
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
          photoUrl: PETAR_PHOTO,
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
    http.expectOne('/api/settlements/s1').flush({
      settlement: options.settlement ?? SETTLEMENT,
      lines: LINES,
      waiting: options.waiting ?? WAITING,
    });
    http.expectOne('/api/settlements/s1/allocations?offset=0&limit=500').flush({
      total: options.allocationsTotal ?? 1,
      limit: 500,
      offset: 0,
      rows: options.allocations ?? [ALLOCATION],
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
      .queryAll<HTMLAnchorElement>('[aria-labelledby="allocations-title"] a')
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
    const allocationsText =
      page.query('[aria-labelledby="allocations-title"]')?.textContent ?? '';
    expect(allocationsText.split(trainedAt).length - 1).toBe(2);
  });

  it("shows each trainer's photo on their lines, from the trainers list", async () => {
    await open('ADMIN');

    const photos = page
      .queryAll('[data-testid="avatar-photo"]')
      .map((img) => img.getAttribute('src'));
    expect(photos.length).toBeGreaterThan(0);
    expect(new Set(photos)).toEqual(new Set([PETAR_PHOTO]));
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

  it('asks before finalizing, naming the period and the total paid out, and does nothing when cancelled', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await open('ADMIN');
    const format = TestBed.inject(LocaleFormatService);

    finalizeButton()!.click();
    await page.settle();

    expect(confirm).toHaveBeenCalledWith(
      `Finalize the report for ${format.date('2026-10-01')} to ${format.date('2026-10-31')}? ${format.money(9000)} is paid out of the cash register, and attendance on or before ${format.date('2026-10-31')} can no longer be added or deleted.`,
    );
    http.expectNone('/api/settlements/s1/finalize');
  });

  it('lets an admin finalize a draft, then shows the report as the API stored it', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await open('ADMIN');

    finalizeButton()!.click();
    await page.settle();
    const req = http.expectOne('/api/settlements/s1/finalize');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    const finalized = {
      ...SETTLEMENT,
      status: 'FINAL',
      finalizedAt: '2026-11-03T08:00:00Z',
    };
    req.flush(finalized);
    await page.settle();
    http
      .expectOne('/api/settlements/s1')
      .flush({ settlement: finalized, lines: LINES, waiting: [] });
    http
      .expectOne('/api/settlements/s1/allocations?offset=0&limit=500')
      .flush({ total: 1, limit: 500, offset: 0, rows: [ALLOCATION] });
    await page.settle();

    expect(finalizeButton()).toBeUndefined();
    expect(page.text()).toContain(en.enums.settlementStatus.FINAL);
    expect(page.text()).toContain(copy.finalizedAt);
    expect(page.text()).not.toContain(copy.draftNoticeAdmin.split('{')[0]);
    expect(page.text()).toContain(copy.noWaiting);
  });

  it("shows the API's reason when finalizing fails, and keeps the draft", async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await open('ADMIN');

    finalizeButton()!.click();
    await page.settle();
    const error = apiError(
      'Finalize the report for 2026-09-16 to 2026-09-30 first',
      409,
    );
    http
      .expectOne('/api/settlements/s1/finalize')
      .flush(error.body, error.options);
    await page.settle();

    expect(page.alert()).toBe(
      'Finalize the report for 2026-09-16 to 2026-09-30 first',
    );
    expect(finalizeButton()).toBeDefined();
    expect(page.text()).toContain(en.enums.settlementStatus.DRAFT);
  });

  it('tells an admin what finalizing a draft does, and a trainer that it can still change', async () => {
    await open('ADMIN');
    const format = TestBed.inject(LocaleFormatService);
    expect(page.text()).toContain(
      copy.draftNoticeAdmin.replace('{end}', format.date('2026-10-31')),
    );
  });

  it('shows what each trainer is paid, with the part carried over from earlier periods', async () => {
    await open('ADMIN');
    const format = TestBed.inject(LocaleFormatService);

    const text = page.text();
    expect(text).toContain(format.money(9000));
    expect(text).toContain(format.money(1234));
    expect(text).toContain(
      `Incl. ${format.money(1234)} carried over (2 trainings)`,
    );
    expect(text).toContain('3 waiting');
  });

  it('marks a paid training carried over from an earlier period', async () => {
    await open('ADMIN', {
      allocations: [{ ...ALLOCATION, fromEarlierPeriod: true }],
    });

    expect(
      page
        .queryAll('app-chip')
        .filter((chip) => chip.textContent?.includes(copy.earlierPeriod)),
    ).toHaveLength(2); // table and phone list
  });

  it('lists the trainings of the period that wait, with why, and filters them by trainer', async () => {
    await open('ADMIN');
    const format = TestBed.inject(LocaleFormatService);

    const text = page.text();
    expect(text).toContain(copy.waitingUnpaid);
    expect(text).toContain(
      copy.waitingTimePass.replace(
        '{date}',
        format.date('2026-11-20T22:00:00Z'),
      ),
    );
    expect(text).toContain(copy.waitingNextReport);

    await page.select('select', 'tr2');
    http
      .expectOne(
        '/api/settlements/s1/allocations?trainerId=tr2&offset=0&limit=500',
      )
      .flush({ total: 0, limit: 500, offset: 0, rows: [] });
    await page.settle();
    expect(component.shownWaiting.map((w) => w.attendanceId)).toEqual(['w2']);
    expect(page.text()).not.toContain(copy.waitingUnpaid);
  });

  it('says when nothing of the period waits', async () => {
    await open('TRAINER', { waiting: [] });
    expect(page.text()).toContain(copy.noWaiting);
  });

  it('gives a trainer no finalize button and no trainer filter', async () => {
    await open('TRAINER');

    expect(page.text()).toContain(copy.draftNoticeTrainer);
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
