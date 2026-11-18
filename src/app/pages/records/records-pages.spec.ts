import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import en from '../../../../public/i18n/en.json';
import {
  BenchmarkOverview,
  LeaderboardEntry,
} from '../../services/benchmarks.service';
import { PageDriver, apiError, driver } from '../../../testing/dom';
import { signInAs } from '../../../testing/jwt';
import { BenchmarkDetailComponent } from './benchmark-detail.component';
import { RecordsComponent } from './records.component';
import { ResultEditComponent } from './result-edit.component';

/** Records: the overview's tabs, a benchmark's page and the result form. */

const texts = en.records;

/** Answers a request with a NestJS-shaped error. */
function refuse(req: TestRequest, message: string, status: number): void {
  const error = apiError(message, status);
  req.flush(error.body, error.options);
}

const entry = (
  rank: number,
  name: string,
  over: Partial<LeaderboardEntry> = {},
): LeaderboardEntry => ({
  rank,
  resultId: `r-${name}`,
  name,
  personType: 'TRAINEE',
  isMe: false,
  performedOn: '2026-06-20',
  timeSeconds: null,
  capped: false,
  rounds: null,
  reps: null,
  loadKg: null,
  note: null,
  ...over,
});

const FRAN_OVERVIEW: BenchmarkOverview = {
  id: 'fran',
  kind: 'BENCHMARK',
  name: 'Fran',
  scoreType: 'TIME',
  timeCapSeconds: 600,
  exercises: [
    { id: 'e1', name: 'Thruster' },
    { id: 'e2', name: 'Pull-up' },
  ],
  rx: [
    entry(1, 'Mia', { timeSeconds: 240 }),
    entry(2, 'John', { timeSeconds: 266, isMe: true }),
  ],
  rxCount: 2,
  scaled: [
    entry(1, 'Eva', {
      timeSeconds: 400,
      note: 'Band pull-ups',
      personType: 'TRAINER',
    }),
  ],
  scaledCount: 1,
  myRx: entry(2, 'John', { timeSeconds: 266, isMe: true }),
  myScaled: null,
};
const ANNIE_OVERVIEW: BenchmarkOverview = {
  ...FRAN_OVERVIEW,
  id: 'annie',
  name: 'Annie',
  timeCapSeconds: null,
  exercises: [{ id: 'e3', name: 'Double-under' }],
  rx: [],
  rxCount: 0,
  scaled: [],
  scaledCount: 0,
  myRx: null,
};
const DEADLIFT_OVERVIEW: BenchmarkOverview = {
  ...ANNIE_OVERVIEW,
  id: 'dl',
  kind: 'LIFT',
  name: 'Deadlift',
  scoreType: 'LOAD',
  exercises: [{ id: 'e4', name: 'Deadlift' }],
  rx: [entry(1, 'John', { loadKg: 142.5, isMe: true })],
  rxCount: 1,
  myRx: entry(1, 'John', { loadKg: 142.5, isMe: true }),
};

const FRAN = {
  id: 'fran',
  kind: 'BENCHMARK',
  name: 'Fran',
  scoreType: 'TIME',
  timeCapSeconds: 600,
  description: 'For time:\n21-15-9 reps of:\nThrusters\nPull-ups',
  exercises: [
    {
      id: 'e1',
      name: 'Thruster',
      description: 'Front squat into a press.',
      videoUrl: 'https://www.youtube.com/watch?v=L219ltL15zk',
      isActive: true,
    },
  ],
  isActive: true,
  resultCount: 3,
};
const DEADLIFT = {
  ...FRAN,
  id: 'dl',
  kind: 'LIFT',
  name: 'Deadlift',
  scoreType: 'LOAD',
  timeCapSeconds: null,
  description: '',
};

const myResult = (over: object = {}) => ({
  id: 'mine-1',
  benchmark: {
    id: 'fran',
    kind: 'BENCHMARK',
    name: 'Fran',
    scoreType: 'TIME',
    timeCapSeconds: 600,
    isActive: true,
  },
  performedOn: '2026-06-20',
  scaled: false,
  timeSeconds: 266,
  capped: false,
  rounds: null,
  reps: null,
  loadKg: null,
  note: 'Unbroken',
  personalBest: true,
  createdAt: '2026-06-20T10:00:00Z',
  updatedAt: '2026-06-20T10:00:00Z',
  ...over,
});

describe('records pages', () => {
  let http: HttpTestingController;
  let router: Router;
  let harness: RouterTestingHarness;
  let page: PageDriver;

  async function setUp(role: 'ADMIN' | 'TRAINER' | 'TRAINEE') {
    localStorage.clear();
    signInAs(role);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'records', component: RecordsComponent },
          { path: 'records/:id', component: BenchmarkDetailComponent },
          { path: 'records/:id/log', component: ResultEditComponent },
          {
            path: 'records/:id/results/:resultId',
            component: ResultEditComponent,
          },
          { path: '**', children: [] },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create();
  }

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  async function open(url: string): Promise<void> {
    await harness.navigateByUrl(url);
    page = driver(
      () => harness.routeNativeElement!,
      () => harness.fixture.whenStable(),
    );
    await page.settle();
  }

  /** An element's text as read: each piece of text once, separated by spaces. */
  const words = (element: Element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const parts: string[] = [];
    while (walker.nextNode()) {
      const text = walker.currentNode.textContent?.trim();
      if (text) {
        parts.push(text.replace(/\s+/g, ' '));
      }
    }
    return parts.join(' ');
  };
  const rowsOf = (selector: string) =>
    page.queryAll(`${selector} li`).map(words);

  /** After a save, the benchmark's page opens and loads; its requests aren't this test's. */
  const leavePage = () => http.match(() => true);

  describe('overview', () => {
    beforeEach(() => setUp('TRAINEE'));

    it('shows each benchmark with the top of its Rx and scaled lists, and my place', async () => {
      await open('/records');
      http
        .expectOne('/api/leaderboards?kind=BENCHMARK')
        .flush([ANNIE_OVERVIEW, FRAN_OVERVIEW]);
      await page.settle();

      const fran = page.query('[data-testid="benchmark-card-fran"]')!;
      const text = fran.textContent.replace(/\s+/g, ' ');
      expect(text).toContain('For time · Time cap 10:00');
      expect(text).toContain('Thruster · Pull-up');
      const [rx, scaled] = Array.from(fran.querySelectorAll('ol'));
      expect(Array.from(rx.querySelectorAll('li')).map(words)).toEqual([
        '1 Place 1: Mia 20 Jun 2026 4:00',
        '2 Place 2: John You 20 Jun 2026 4:26',
      ]);
      expect(rx.querySelectorAll('li.is-me')).toHaveLength(1);
      expect(scaled.textContent).toContain('Coach');
      expect(scaled.textContent).toContain('Band pull-ups');
      expect(
        fran.querySelector('[data-testid="benchmark-card-mine"]')?.textContent,
      ).toContain('Your Rx best: 4:26 (#2)');
      expect(
        fran.querySelector('a[href="/records/fran/log"]')?.textContent.trim(),
      ).toBe(texts.log);

      // Nobody on Annie yet: one line, no empty lists.
      const annie = page.query('[data-testid="benchmark-card-annie"]')!;
      expect(annie.querySelector('ol')).toBeNull();
      expect(annie.textContent).toContain(texts.board.empty);
    });

    it('searches by name or movement', async () => {
      await open('/records');
      http
        .expectOne('/api/leaderboards?kind=BENCHMARK')
        .flush([ANNIE_OVERVIEW, FRAN_OVERVIEW]);
      await page.settle();

      await page.type('input[type="search"]', 'double');
      expect(
        page.queryAll('[data-testid^="benchmark-card-"]').map((c) => c.id),
      ).toHaveLength(1);
      expect(page.query('[data-testid="benchmark-card-annie"]')).not.toBeNull();
    });

    it('switches to heavy lifts and to my results, keeping the tab in the address', async () => {
      await open('/records');
      http.expectOne('/api/leaderboards?kind=BENCHMARK').flush([]);
      await page.settle();
      expect(page.text()).toContain(texts.emptyBenchmarks);

      await page.click('input[type="radio"][value="lifts"]');
      expect(router.url).toBe('/records?tab=lifts');
      http.expectOne('/api/leaderboards?kind=LIFT').flush([DEADLIFT_OVERVIEW]);
      await page.settle();
      const lift = page.query('[data-testid="benchmark-card-dl"]')!;
      // A lift has one list, and no scaled one.
      expect(lift.querySelectorAll('ol')).toHaveLength(1);
      expect(lift.textContent).not.toContain(texts.scaled);
      expect(lift.textContent).toContain('142.5 kg');
      expect(lift.textContent).toContain('Your best: 142.5 kg (#1)');

      await page.click('input[type="radio"][value="mine"]');
      expect(router.url).toBe('/records?tab=mine');
      http
        .expectOne('/api/benchmark-results/mine')
        .flush([
          myResult(),
          myResult({ id: 'mine-2', scaled: true, personalBest: false }),
        ]);
      await page.settle();
      expect(rowsOf('[data-testid="my-results"]')).toEqual([
        'Fran 20 Jun 2026 Unbroken 4:26 Personal best',
        'Fran 20 Jun 2026 Unbroken 4:26 Scaled',
      ]);
    });

    it('shows the API error with Try again', async () => {
      await open('/records?tab=lifts');
      refuse(
        http.expectOne('/api/leaderboards?kind=LIFT'),
        'Database down',
        500,
      );
      await page.settle();
      expect(page.alert()).toContain('Database down');

      await page.click('app-empty-state button');
      http.expectOne('/api/leaderboards?kind=LIFT').flush([]);
      await page.settle();
      expect(page.text()).toContain(texts.emptyLifts);
    });
  });

  it('an admin without a profile gets no "Mine" tab and no log links', async () => {
    await setUp('ADMIN');
    await open('/records?tab=mine');
    http.expectOne('/api/leaderboards?kind=BENCHMARK').flush([FRAN_OVERVIEW]);
    await page.settle();

    expect(page.query('input[type="radio"][value="mine"]')).toBeNull();
    expect(page.query('a[href="/records/fran/log"]')).toBeNull();
    expect(page.query('[data-testid="benchmark-card-mine"]')).toBeNull();
  });

  describe('benchmark page', () => {
    async function openFran(mine: object[] = [myResult()]) {
      await open('/records/fran');
      http.expectOne('/api/benchmarks/fran').flush(FRAN);
      http.expectOne('/api/benchmarks/fran/leaderboard').flush({
        rx: FRAN_OVERVIEW.rx,
        scaled: FRAN_OVERVIEW.scaled,
      });
      if (mine) {
        http
          .expectOne('/api/benchmark-results/mine?benchmarkId=fran')
          .flush(mine);
      }
      await page.settle();
    }

    it('shows the workout, its movements, both whole lists and my results', async () => {
      await setUp('TRAINEE');
      await openFran();

      expect(page.query('h1')?.textContent).toContain('Fran');
      expect(
        page.query('[data-testid="benchmark-description"]')?.textContent,
      ).toBe('For time:\n21-15-9 reps of:\nThrusters\nPull-ups');
      const thruster = page.query('[data-testid="benchmark-exercise-e1"]')!;
      expect(thruster.textContent).toContain('Front squat into a press.');
      expect(thruster.querySelector('app-exercise-video')).not.toBeNull();
      expect(rowsOf('[data-testid="board-rx"]')).toHaveLength(2);
      expect(rowsOf('[data-testid="board-scaled"]')).toHaveLength(1);
      expect(
        page.query('[data-testid="log-result"]')?.getAttribute('href'),
      ).toBe('/records/fran/log');
      // Trainees delete nothing on the leaderboards.
      expect(page.query('[data-testid="board-rx"] button')).toBeNull();
      expect(
        page.query('[data-testid="my-result-mine-1"] a')?.getAttribute('href'),
      ).toBe('/records/fran/results/mine-1');
    });

    it('deletes one of my results after asking, then reloads', async () => {
      await setUp('TRAINEE');
      await openFran();
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);

      await page.click('[data-testid="my-result-mine-1"] button');
      expect(confirm).toHaveBeenCalledWith(
        "Delete your result of 20 Jun 2026? This can't be undone.",
      );
      const del = http.expectOne('/api/benchmark-results/mine-1');
      expect(del.request.method).toBe('DELETE');
      del.flush({ deleted: true });
      await page.settle();
      await openReload([]);
      expect(page.query('[data-testid="no-my-results"]')).not.toBeNull();
    });

    async function openReload(mine: object[]) {
      http.expectOne('/api/benchmarks/fran').flush(FRAN);
      http
        .expectOne('/api/benchmarks/fran/leaderboard')
        .flush({ rx: [], scaled: [] });
      http
        .expectOne('/api/benchmark-results/mine?benchmarkId=fran')
        .flush(mine);
      await page.settle();
    }

    it("lets an admin delete someone's result from a leaderboard, after asking", async () => {
      await setUp('ADMIN');
      await open('/records/fran');
      http.expectOne('/api/benchmarks/fran').flush(FRAN);
      http.expectOne('/api/benchmarks/fran/leaderboard').flush({
        rx: FRAN_OVERVIEW.rx,
        scaled: [],
      });
      await page.settle();
      // No profile: no log button and no "My results".
      expect(page.query('[data-testid="log-result"]')).toBeNull();
      expect(page.text()).not.toContain(texts.detail.mine);
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);

      await page.click('[aria-label="Delete the result of Mia"]');
      expect(confirm).toHaveBeenCalled();
      http.expectNone('/api/benchmark-results/r-Mia');

      confirm.mockReturnValue(true);
      await page.click('[aria-label="Delete the result of Mia"]');
      refuse(
        http.expectOne('/api/benchmark-results/r-Mia'),
        'Result not found',
        404,
      );
      await page.settle();
      expect(page.alert()).toBe('Result not found');
    });

    it("goes back to the tab it is on: a lift's page to Heavy lifts", async () => {
      await setUp('TRAINEE');
      await open('/records/dl');
      http.expectOne('/api/benchmarks/dl').flush(DEADLIFT);
      http
        .expectOne('/api/benchmarks/dl/leaderboard')
        .flush({ rx: DEADLIFT_OVERVIEW.rx, scaled: [] });
      http.expectOne('/api/benchmark-results/mine?benchmarkId=dl').flush([]);
      await page.settle();

      const back = page.query<HTMLAnchorElement>(
        `a[href^="/records"]:not([href*="/dl"])`,
      )!;
      expect(back.textContent).toContain(texts.backToRecords);
      expect(back.getAttribute('href')).toBe('/records?tab=lifts');
      // A lift has one leaderboard and no scaled one.
      expect(page.query('[data-testid="board-scaled"]')).toBeNull();

      await page.click(`a[href="/records?tab=lifts"]`);
      expect(router.url).toBe('/records?tab=lifts');
      leavePage();
    });

    it('says when it is no longer active, and offers no logging', async () => {
      await setUp('TRAINEE');
      await open('/records/fran');
      http
        .expectOne('/api/benchmarks/fran')
        .flush({ ...FRAN, isActive: false });
      http
        .expectOne('/api/benchmarks/fran/leaderboard')
        .flush({ rx: [], scaled: [] });
      http.expectOne('/api/benchmark-results/mine?benchmarkId=fran').flush([]);
      await page.settle();

      expect(page.query('[data-testid="benchmark-inactive"]')).not.toBeNull();
      expect(page.query('[data-testid="log-result"]')).toBeNull();
    });
  });

  describe('result form', () => {
    beforeEach(() => setUp('TRAINEE'));

    it('logs a Fran time and goes back to the benchmark', async () => {
      vi.useFakeTimers({
        toFake: ['Date'],
        now: new Date('2026-11-18T10:00:00Z'),
      });
      await open('/records/fran/log');
      http.expectOne('/api/benchmarks/fran').flush(FRAN);
      await page.settle();
      expect(page.query('input#result-day')?.getAttribute('max')).toBe(
        '2026-11-18',
      );

      await page.type('#result-minutes', '4');
      await page.type('#result-seconds', '26');
      await page.check('[data-testid="result-scaled"]', true);
      await page.type('#result-note', '  30 kg thrusters ');
      await page.submit();

      const req = http.expectOne('/api/benchmark-results');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        benchmarkId: 'fran',
        performedOn: '2026-11-18',
        scaled: true,
        timeSeconds: 266,
        capped: false,
        rounds: null,
        reps: null,
        loadKg: null,
        note: '30 kg thrusters',
      });
      req.flush(myResult());
      await page.settle();
      expect(router.url).toBe('/records/fran');
      leavePage();
    });

    it('logs the reps done when capped, and refuses a time over the cap', async () => {
      await open('/records/fran/log');
      http.expectOne('/api/benchmarks/fran').flush(FRAN);
      await page.settle();

      await page.type('#result-minutes', '11');
      await page.type('#result-seconds', '0');
      await page.submit();
      http.expectNone('/api/benchmark-results');
      expect(page.text()).toContain(
        en.records.form.overCapError.replace('{cap}', '10:00'),
      );

      await page.check('[data-testid="result-capped"]', true);
      expect(page.query('#result-minutes')).toBeNull();
      await page.type('#result-reps', '80');
      await page.submit();

      const req = http.expectOne('/api/benchmark-results');
      expect(req.request.body).toMatchObject({
        timeSeconds: null,
        capped: true,
        reps: 80,
      });
      refuse(req, 'This benchmark has no time cap', 400);
      await page.settle();
      expect(page.alert()).toBe('This benchmark has no time cap');
      expect(router.url).toBe('/records/fran/log');
    });

    it('edits a lift result: kg, no scaled box, a PATCH', async () => {
      await open('/records/dl/results/mine-9');
      http.expectOne('/api/benchmarks/dl').flush(DEADLIFT);
      http.expectOne('/api/benchmark-results/mine-9').flush(
        myResult({
          id: 'mine-9',
          benchmark: { ...myResult().benchmark, id: 'dl', scoreType: 'LOAD' },
          timeSeconds: null,
          loadKg: 140,
          note: null,
        }),
      );
      await page.settle();
      expect(page.query('[data-testid="result-scaled"]')).toBeNull();
      expect(page.query<HTMLInputElement>('#result-load')?.value).toBe('140');

      await page.type('#result-load', '142.5');
      await page.submit();

      const req = http.expectOne('/api/benchmark-results/mine-9');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({
        performedOn: '2026-06-20',
        scaled: false,
        timeSeconds: null,
        capped: false,
        rounds: null,
        reps: null,
        loadKg: 142.5,
        note: null,
      });
      req.flush({});
      await page.settle();
      expect(router.url).toBe('/records/dl');
      leavePage();
    });
  });
});
