import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import en from '../../../../../public/i18n/en.json';
import { PageDriver, apiError, driver } from '../../../../testing/dom';
import { signInAs } from '../../../../testing/jwt';
import { BenchmarkEditComponent } from './benchmark-edit.component';
import { BenchmarksComponent } from './benchmarks.component';

/** The staff's catalogue of benchmarks and heavy lifts (Workouts → Benchmarks). */

const texts = en.workouts.benchmarks;

const exercise = (id: string, name: string, isActive = true) => ({
  id,
  name,
  aliases: [] as string[],
  isActive,
  description: null,
  videoUrl: null,
});
const EXERCISES = [
  exercise('e-dl', 'Deadlift'),
  exercise('e-old', 'Old move', false),
  exercise('e-pull', 'Pull-up'),
  exercise('e-thr', 'Thruster'),
];

const FRAN = {
  id: 'fran',
  kind: 'BENCHMARK',
  name: 'Fran',
  scoreType: 'TIME',
  timeCapSeconds: 600,
  description: '21-15-9',
  exercises: [
    {
      id: 'e-thr',
      name: 'Thruster',
      description: null,
      videoUrl: null,
      isActive: true,
    },
    {
      id: 'e-pull',
      name: 'Pull-up',
      description: null,
      videoUrl: null,
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
  exercises: [FRAN.exercises[0]],
  resultCount: 0,
};

describe('benchmark catalogue pages', () => {
  let http: HttpTestingController;
  let router: Router;
  let harness: RouterTestingHarness;
  let page: PageDriver;

  beforeEach(async () => {
    localStorage.clear();
    signInAs('TRAINER');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          {
            path: 'workouts/benchmarks/new',
            component: BenchmarkEditComponent,
          },
          {
            path: 'workouts/benchmarks/:id/edit',
            component: BenchmarkEditComponent,
          },
          { path: 'workouts/benchmarks', component: BenchmarksComponent },
          { path: '**', children: [] },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  async function open(url: string): Promise<void> {
    await harness.navigateByUrl(url);
    page = driver(
      () => harness.routeNativeElement!,
      () => harness.fixture.whenStable(),
    );
    await page.settle();
  }

  async function openForm(url: string, benchmark?: object) {
    await open(url);
    http.expectOne('/api/exercises').flush(EXERCISES);
    if (benchmark) {
      http
        .expectOne(`/api/benchmarks/${(benchmark as { id: string }).id}`)
        .flush(benchmark);
    }
    await page.settle();
  }

  /** After a save the list opens and loads; that request isn't this test's. */
  const leavePage = () => http.match('/api/benchmarks');

  it('lists them with their kind, scoring and results, and filters by kind', async () => {
    await open('/workouts/benchmarks');
    http.expectOne('/api/benchmarks').flush([FRAN, DEADLIFT]);
    await page.settle();

    const rows = page.queryAll('tbody tr').map((tr) =>
      Array.from(tr.querySelectorAll('td'))
        .slice(0, 4)
        .map((td) => td.textContent.trim()),
    );
    expect(rows).toEqual([
      ['Fran', 'Benchmark', 'For time · Time cap 10:00', '3'],
      ['Deadlift', 'Heavy lift', 'Max load (1RM)', '0'],
    ]);
    // The Benchmarks tab of the workouts area is the current one.
    expect(
      page
        .queryAll('nav a[aria-current="page"]')
        .map((a) => a.textContent.trim()),
    ).toEqual([en.workouts.nav.benchmarks]);

    await page.click('input[type="radio"][value="LIFT"]');
    expect(page.queryAll('tbody tr')).toHaveLength(1);
    expect(page.query('[data-testid="list-count"]')?.textContent).toContain(
      '1 of 2',
    );
  });

  it('creates a heavy lift: one movement, no score type or time cap', async () => {
    await openForm('/workouts/benchmarks/new');

    await page.click('[data-testid="benchmark-kind-LIFT"]');
    expect(page.query('#benchmark-score')).toBeNull();
    expect(page.query('#benchmark-cap')).toBeNull();
    // Inactive movements aren't offered.
    const options = page
      .queryAll<HTMLOptionElement>('#benchmark-lift-exercise option')
      .map((o) => o.textContent.trim());
    expect(options).not.toContain('Old move');

    await page.type('#benchmark-name', 'Deadlift');
    await page.submit();
    http.expectNone('/api/benchmarks');
    expect(page.text()).toContain(texts.fields.liftExerciseError);

    await page.select('#benchmark-lift-exercise', 'e-dl');
    await page.submit();

    const req = http.expectOne('/api/benchmarks');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      kind: 'LIFT',
      name: 'Deadlift',
      description: '',
      exerciseIds: ['e-dl'],
      isActive: true,
    });
    req.flush(DEADLIFT);
    await page.settle();
    expect(router.url).toBe('/workouts/benchmarks');
    leavePage();
  });

  it('creates a benchmark with its movements in the order given', async () => {
    await openForm('/workouts/benchmarks/new');

    await page.type('#benchmark-name', 'Fran');
    await page.type('#benchmark-description', '21-15-9\nThrusters\nPull-ups');
    await page.type('#benchmark-cap', '10');
    await page.submit();
    http.expectNone('/api/benchmarks');
    expect(page.query('[data-testid="no-exercises"]')?.className).toBe(
      'form-field__error',
    );

    await page.select('#benchmark-add-exercise', 'e-pull');
    await page.click('[data-testid="add-exercise"]');
    await page.select('#benchmark-add-exercise', 'e-thr');
    await page.click('[data-testid="add-exercise"]');
    await page.click('[aria-label="Move exercise 2 up"]');
    await page.submit();

    const req = http.expectOne('/api/benchmarks');
    expect(req.request.body).toEqual({
      kind: 'BENCHMARK',
      name: 'Fran',
      scoreType: 'TIME',
      timeCapSeconds: 600,
      description: '21-15-9\nThrusters\nPull-ups',
      exerciseIds: ['e-thr', 'e-pull'],
      isActive: true,
    });
    const refusal = apiError(
      'A benchmark or lift named "Fran" already exists',
      409,
    );
    req.flush(refusal.body, refusal.options);
    await page.settle();
    expect(page.alert()).toBe(
      'A benchmark or lift named "Fran" already exists',
    );
    expect(router.url).toBe('/workouts/benchmarks/new');
  });

  it('edits one with results: its score type is fixed and it is not deleted', async () => {
    await openForm('/workouts/benchmarks/fran/edit', FRAN);
    const confirm = vi.spyOn(window, 'confirm');

    expect(page.query<HTMLSelectElement>('#benchmark-score')?.disabled).toBe(
      true,
    );
    expect(page.query<HTMLInputElement>('#benchmark-cap')?.value).toBe('10');
    expect(page.query('[data-testid="benchmark-kind-LIFT"]')).toBeNull();

    await page.click('[data-testid="benchmark-delete"]');
    expect(confirm).not.toHaveBeenCalled();
    expect(page.alert()).toBe(
      "It has 3 results, so it can't be deleted. Make it inactive instead.",
    );

    await page.type('#benchmark-cap', '');
    await page.submit();
    const req = http.expectOne('/api/benchmarks/fran');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({
      name: 'Fran',
      scoreType: 'TIME',
      timeCapSeconds: null,
      description: '21-15-9',
      exerciseIds: ['e-thr', 'e-pull'],
      isActive: true,
    });
    req.flush(FRAN);
    await page.settle();
    expect(router.url).toBe('/workouts/benchmarks');
    leavePage();
  });

  it('deletes one without results after asking', async () => {
    await openForm('/workouts/benchmarks/dl/edit', DEADLIFT);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    expect(
      page.query<HTMLSelectElement>('#benchmark-lift-exercise')?.value,
    ).toBe('e-thr');

    await page.click('[data-testid="benchmark-delete"]');
    const req = http.expectOne('/api/benchmarks/dl');
    expect(req.request.method).toBe('DELETE');
    req.flush({ deleted: true });
    await page.settle();
    expect(router.url).toBe('/workouts/benchmarks');
    leavePage();
  });
});
