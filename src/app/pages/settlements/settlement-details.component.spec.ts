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
const ALLOCATIONS = '/api/settlements/s1/allocations';

/** `count` paid rows, numbered from `from` (their trainee ids say which row they are). */
function allocationRows(from: number, count: number): SettlementAllocation[] {
  return Array.from({ length: count }, (_, i) => {
    const n = from + i;
    return {
      ...ALLOCATION,
      id: `al${n}`,
      attendanceId: `a${n}`,
      attendance: {
        ...ALLOCATION.attendance!,
        id: `a${n}`,
        traineeId: `t${n}`,
      },
    };
  });
}

/** `count` waiting rows of trainer tr1, numbered from 1. */
function waitingRows(count: number): SettlementWaiting[] {
  return Array.from({ length: count }, (_, i) => ({
    ...WAITING[0],
    attendanceId: `w${i + 1}`,
    traineeId: `t${i + 1}`,
  }));
}

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
      url?: string;
      allocationsUrl?: string;
      /** The first page of paid trainings fails. */
      allocationsError?: boolean;
    } = {},
  ) {
    signInAs(role);
    component = await harness.navigateByUrl(
      options.url ?? '/settlements/s1',
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
    const allocations = http.expectOne(
      options.allocationsUrl ?? `${ALLOCATIONS}?offset=0&limit=50`,
    );
    if (options.allocationsError) {
      const error = apiError(undefined, 500);
      allocations.flush(error.body, error.options);
    } else {
      allocations.flush({
        total: options.allocationsTotal ?? 1,
        limit: 50,
        offset: 0,
        rows: options.allocations ?? [ALLOCATION],
      });
    }
    await page.settle();
  }

  const url = () => TestBed.inject(Router).url;
  /** The button with this accessible name, e.g. "Next page". */
  const button = (name: string) =>
    page.query<HTMLButtonElement>(`button[aria-label="${name}"]`);
  const tabLabels = () =>
    page
      .queryAll('app-segmented-control label')
      .map((label) => label.textContent?.trim());
  /** Opens a tab the way a person does: the option's radio. */
  const openTab = (tab: 'paid' | 'waiting') =>
    page.click(`app-segmented-control input[value="${tab}"]`);
  /** The trainee names of the rows in the open tab's table. */
  const tableTrainees = () =>
    page
      .queryAll(
        ['allocations-title', 'waiting-title']
          .map((id) => `[aria-labelledby="${id}"] tbody td:nth-child(2)`)
          .join(', '),
      )
      .map((cell) => cell.textContent?.trim());
  const flushPage = (
    request: string,
    total: number,
    rows: SettlementAllocation[],
  ) => {
    http.expectOne(request).flush({ total, limit: 50, offset: 0, rows });
    return page.settle();
  };

  const count = () =>
    page.query('[data-testid="list-count"]')?.textContent?.trim();
  const tryAgain = () =>
    page
      .queryAll<HTMLButtonElement>('button')
      .find((b) => b.textContent?.trim() === en.common.tryAgain);
  const failPage = (request: string) => {
    const error = apiError(undefined, 500);
    http.expectOne(request).flush(error.body, error.options);
    return page.settle();
  };

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

    await page.select('#settlement-trainer', 'tr2');
    await flushPage(`${ALLOCATIONS}?trainerId=tr2&offset=0&limit=50`, 0, []);
    expect(page.text()).toContain(copy.noAllocations);
    expect(url()).toBe('/settlements/s1?trainer=tr2');

    await page.select('#settlement-trainer', '');
    await flushPage(`${ALLOCATIONS}?offset=0&limit=50`, 1, [ALLOCATION]);
    expect(url()).toBe('/settlements/s1');
  });

  it('pages through every paid training, 50 at a time by default (TEST_NOTES.md S10)', async () => {
    await open('ADMIN', {
      allocationsTotal: 734,
      allocations: allocationRows(1, 50),
    });

    expect(page.query('[data-testid="list-count"]')?.textContent?.trim()).toBe(
      '1–50 of 734 rows',
    );
    expect(tableTrainees()).toHaveLength(50);
    expect(button('Previous page')?.disabled).toBe(true);
    expect(button('First page')?.disabled).toBe(true);
    expect(button('Page 1')?.getAttribute('aria-current')).toBe('page');
    // 734 rows make 15 pages: the first five, a gap and the last.
    expect(
      page
        .queryAll(
          'nav[aria-label="Paid trainings pages"] li:not([data-testid="pagination-status"])',
        )
        .map((li) => li.textContent?.trim())
        // The arrows are icons only.
        .filter((text) => text),
    ).toEqual(['1', '2', '3', '4', '5', '…', '15']);

    await page.click('button[aria-label="Next page"]');
    expect(url()).toBe('/settlements/s1?page=2');
    await flushPage(
      `${ALLOCATIONS}?offset=50&limit=50`,
      734,
      allocationRows(51, 50),
    );
    expect(page.query('[data-testid="list-count"]')?.textContent?.trim()).toBe(
      '51–100 of 734 rows',
    );
    expect(tableTrainees()[0]).toBe('t51');
    expect(button('Page 2')?.getAttribute('aria-current')).toBe('page');

    await page.click('button[aria-label="Last page"]');
    expect(url()).toBe('/settlements/s1?page=15');
    await flushPage(
      `${ALLOCATIONS}?offset=700&limit=50`,
      734,
      allocationRows(701, 34),
    );
    expect(page.query('[data-testid="list-count"]')?.textContent?.trim()).toBe(
      '701–734 of 734 rows',
    );
    expect(tableTrainees()).toHaveLength(34);
    expect(button('Next page')?.disabled).toBe(true);
    expect(
      page
        .queryAll('[data-testid="pagination-status"] span')
        .map((span) => span.textContent?.replace(/\s+/g, ' ').trim()),
      // Phones show the short form; screen readers get the sentence.
    ).toEqual(['15 / 15', 'Page 15 of 15']);

    await page.click('button[aria-label="Page 13"]');
    expect(url()).toBe('/settlements/s1?page=13');
    await flushPage(
      `${ALLOCATIONS}?offset=600&limit=50`,
      734,
      allocationRows(601, 50),
    );

    await page.click('button[aria-label="First page"]');
    expect(url()).toBe('/settlements/s1');
    await flushPage(
      `${ALLOCATIONS}?offset=0&limit=50`,
      734,
      allocationRows(1, 50),
    );
  });

  it('shows as many rows a page as asked, from the first page again', async () => {
    await open('ADMIN', {
      url: '/settlements/s1?page=3',
      allocationsUrl: `${ALLOCATIONS}?offset=100&limit=50`,
      allocationsTotal: 734,
      allocations: allocationRows(101, 50),
    });

    await page.select('nav[aria-label="Paid trainings pages"] select', '200');
    expect(url()).toBe('/settlements/s1?size=200');
    await flushPage(
      `${ALLOCATIONS}?offset=0&limit=200`,
      734,
      allocationRows(1, 200),
    );
    expect(page.query('[data-testid="list-count"]')?.textContent?.trim()).toBe(
      '1–200 of 734 rows',
    );
    expect(tableTrainees()).toHaveLength(200);
    expect(
      page
        .queryAll<HTMLOptionElement>(
          'nav[aria-label="Paid trainings pages"] option',
        )
        .map((option) => option.value),
    ).toEqual(['25', '50', '100', '200']);
  });

  it('opens on the tab, page, size and trainer in the address, so going back returns to the same rows', async () => {
    await open('ADMIN', {
      url: '/settlements/s1?page=3&size=25&trainer=tr2',
      allocationsUrl: `${ALLOCATIONS}?trainerId=tr2&offset=50&limit=25`,
      allocationsTotal: 80,
      allocations: allocationRows(51, 25),
    });

    expect(page.query<HTMLSelectElement>('#settlement-trainer')?.value).toBe(
      'tr2',
    );
    expect(page.query('[data-testid="list-count"]')?.textContent?.trim()).toBe(
      '51–75 of 80 rows',
    );
    expect(button('Page 3')?.getAttribute('aria-current')).toBe('page');

    // A page that isn't a number, or a size not offered, falls back to the defaults.
    await harness.navigateByUrl('/settlements/s1?page=x&size=37');
    await flushPage(`${ALLOCATIONS}?offset=0&limit=50`, 1, [ALLOCATION]);
  });

  it('ignores a trainer in the address for a trainer, whom the API shows only their own rows', async () => {
    await open('TRAINER', {
      url: '/settlements/s1?trainer=tr2&page=2',
      allocationsUrl: `${ALLOCATIONS}?offset=50&limit=50`,
      allocationsTotal: 60,
      allocations: allocationRows(51, 10),
    });

    expect(page.query('#settlement-trainer')).toBeNull();
    expect(tableTrainees()).toHaveLength(10);
  });

  it('goes to the last page when the address asks for one past the end', async () => {
    await open('ADMIN', {
      url: '/settlements/s1?page=40',
      allocationsUrl: `${ALLOCATIONS}?offset=1950&limit=50`,
      allocationsTotal: 734,
      allocations: [],
    });

    expect(url()).toBe('/settlements/s1?page=15');
    await flushPage(
      `${ALLOCATIONS}?offset=700&limit=50`,
      734,
      allocationRows(701, 34),
    );
    expect(tableTrainees()).toHaveLength(34);
  });

  it('has no page controls while every row fits on the smallest page', async () => {
    await open('ADMIN', {
      allocationsTotal: 25,
      allocations: allocationRows(1, 25),
    });

    expect(page.query('app-pagination nav')).toBeNull();
    expect(page.query('[data-testid="list-count"]')?.textContent?.trim()).toBe(
      '1–25 of 25 rows',
    );
  });

  it('keeps the paid rows when a page fails, and asks for it again on "Try again" (TEST_NOTES.md S18)', async () => {
    await open('ADMIN', {
      allocationsTotal: 734,
      allocations: allocationRows(1, 50),
    });

    await page.click('button[aria-label="Next page"]');
    await failPage(`${ALLOCATIONS}?offset=50&limit=50`);

    expect(page.alert()).toBe(copy.loadAllocationsError);
    // The rows, the count and the page controls still describe the page that loaded.
    expect(tableTrainees()).toHaveLength(50);
    expect(tableTrainees()[1]).toBe('t2');
    expect(count()).toBe('1–50 of 734 rows');
    expect(button('Page 1')?.getAttribute('aria-current')).toBe('page');
    expect(url()).toBe('/settlements/s1?page=2');

    tryAgain()!.click();
    await flushPage(
      `${ALLOCATIONS}?offset=50&limit=50`,
      734,
      allocationRows(51, 50),
    );
    expect(page.query('[role="alert"]')).toBeNull();
    expect(tableTrainees()[0]).toBe('t51');
    expect(count()).toBe('51–100 of 734 rows');
    expect(button('Page 2')?.getAttribute('aria-current')).toBe('page');
  });

  it('keeps counting the paid rows shown when a new page size fails', async () => {
    await open('ADMIN', {
      allocationsTotal: 734,
      allocations: allocationRows(1, 50),
    });

    await page.select('nav[aria-label="Paid trainings pages"] select', '200');
    await failPage(`${ALLOCATIONS}?offset=0&limit=200`);

    expect(count()).toBe('1–50 of 734 rows');
    expect(
      page.query<HTMLSelectElement>(
        'nav[aria-label="Paid trainings pages"] select',
      )?.value,
    ).toBe('50');
    expect(tableTrainees()).toHaveLength(50);
  });

  it("drops the rows when another trainer's fail to load, rather than show them as that trainer's", async () => {
    await open('ADMIN', {
      allocationsTotal: 734,
      allocations: allocationRows(1, 50),
    });

    await page.select('#settlement-trainer', 'tr2');
    await failPage(`${ALLOCATIONS}?trainerId=tr2&offset=0&limit=50`);

    expect(page.alert()).toBe(copy.loadAllocationsError);
    expect(tableTrainees()).toHaveLength(0);
    expect(count()).toBeUndefined();
    expect(page.text()).not.toContain(copy.noAllocations);
    expect(tabLabels()[0]).toBe(copy.tabPaid);

    tryAgain()!.click();
    await flushPage(`${ALLOCATIONS}?trainerId=tr2&offset=0&limit=50`, 1, [
      ALLOCATION,
    ]);
    expect(tableTrainees()).toHaveLength(1);
  });

  it('offers "Try again" when the first page of paid trainings fails', async () => {
    await open('ADMIN', { allocationsError: true });

    expect(page.alert()).toBe(copy.loadAllocationsError);
    expect(count()).toBeUndefined();
    expect(page.text()).not.toContain(copy.noAllocations);

    tryAgain()!.click();
    await flushPage(`${ALLOCATIONS}?offset=0&limit=50`, 1, [ALLOCATION]);
    expect(page.query('[role="alert"]')).toBeNull();
    expect(tableTrainees()).toHaveLength(1);
  });

  it('keeps the shown rows while the next page loads, then replaces them', async () => {
    await open('ADMIN', {
      allocationsTotal: 734,
      allocations: allocationRows(1, 50),
    });

    await page.click('button[aria-label="Next page"]');
    expect(tableTrainees()[1]).toBe('t2');
    expect(
      page
        .query('[aria-labelledby="allocations-title"]')
        ?.getAttribute('aria-busy'),
    ).toBe('true');
    await flushPage(
      `${ALLOCATIONS}?offset=50&limit=50`,
      734,
      allocationRows(51, 50),
    );
    expect(tableTrainees()[1]).toBe('t52');
    expect(
      page
        .query('[aria-labelledby="allocations-title"]')
        ?.hasAttribute('aria-busy'),
    ).toBe(false);
  });

  it('shows the paid and the waiting trainings in two tabs, each with its count', async () => {
    await open('ADMIN', {
      allocationsTotal: 734,
      allocations: allocationRows(1, 50),
    });

    expect(tabLabels()).toEqual(['Paid · 734', 'Waiting · 3']);
    expect(page.query('#allocations-title')).not.toBeNull();
    expect(page.query('#waiting-title')).toBeNull();

    await openTab('waiting');
    expect(url()).toBe('/settlements/s1?tab=waiting');
    expect(page.query('#allocations-title')).toBeNull();
    expect(page.query('#waiting-title')).not.toBeNull();
    expect(page.query('[data-testid="list-count"]')?.textContent?.trim()).toBe(
      '1–3 of 3 rows',
    );
    // The paid page shown didn't change: nothing to ask the API for.
    http.expectNone(() => true);

    await openTab('paid');
    expect(url()).toBe('/settlements/s1');
    expect(tableTrainees()).toHaveLength(50);
  });

  it('pages through the waiting trainings in the browser', async () => {
    await open('ADMIN', { waiting: waitingRows(60) });

    await openTab('waiting');
    expect(tabLabels()).toEqual(['Paid · 1', 'Waiting · 60']);
    expect(tableTrainees()).toHaveLength(50);

    await page.click(
      'nav[aria-label="Waiting trainings pages"] button[aria-label="Next page"]',
    );
    expect(url()).toBe('/settlements/s1?tab=waiting&page=2');
    expect(tableTrainees()).toHaveLength(10);
    expect(page.query('[data-testid="list-count"]')?.textContent?.trim()).toBe(
      '51–60 of 60 rows',
    );
    // Rows the browser already has: no request.
    http.expectNone(() => true);

    // Another tab starts on its first page.
    await openTab('paid');
    expect(url()).toBe('/settlements/s1');
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
    await flushPage(`${ALLOCATIONS}?offset=0&limit=50`, 1, [ALLOCATION]);

    expect(finalizeButton()).toBeUndefined();
    expect(page.text()).toContain(en.enums.settlementStatus.FINAL);
    expect(page.text()).toContain(copy.finalizedAt);
    expect(page.text()).not.toContain(copy.draftNoticeAdmin.split('{')[0]);
    await openTab('waiting');
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
    await openTab('waiting');

    const text = page.text();
    expect(text).toContain(copy.waitingUnpaid);
    expect(text).toContain(
      copy.waitingTimePass.replace(
        '{date}',
        format.date('2026-11-20T22:00:00Z'),
      ),
    );
    expect(text).toContain(copy.waitingNextReport);

    await page.select('#settlement-trainer', 'tr2');
    expect(url()).toBe('/settlements/s1?tab=waiting&trainer=tr2');
    await flushPage(`${ALLOCATIONS}?trainerId=tr2&offset=0&limit=50`, 0, []);
    expect(component.shownWaiting.map((w) => w.attendanceId)).toEqual(['w2']);
    expect(page.text()).not.toContain(copy.waitingUnpaid);
    expect(tabLabels()).toEqual(['Paid · 0', 'Waiting · 1']);
  });

  it('says when nothing of the period waits', async () => {
    await open('TRAINER', { waiting: [] });
    await openTab('waiting');
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
