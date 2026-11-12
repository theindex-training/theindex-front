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
import { ExerciseEditComponent } from './exercises/exercise-edit.component';
import { ExercisesComponent } from './exercises/exercises.component';
import { WorkoutEditComponent } from './workout-edit.component';
import { WorkoutsComponent, mondayOf } from './workouts.component';

/** The workouts area: the week list, the exercise pages and the workout form. */

const texts = en.workouts;

const exercise = (id: string, name: string, over: object = {}) => ({
  id,
  name,
  aliases: [] as string[],
  isActive: true,
  description: null as string | null,
  videoUrl: null as string | null,
  ...over,
});
const RUN = exercise('e-run', 'Run');
const PULL_UP = exercise('e-pull', 'Pull-up', {
  aliases: ['Kipping pull-up'],
  videoUrl: 'https://www.youtube.com/watch?v=lzRo-4pq_AY',
});
const OLD = exercise('e-old', 'Old move', { isActive: false });
const EXERCISES = [OLD, PULL_UP, RUN];

const listed = (e: ReturnType<typeof exercise>) => ({
  id: e.id,
  name: e.name,
  videoUrl: e.videoUrl,
  isActive: e.isActive,
});
const HELEN = {
  id: 'w1',
  date: '2026-11-09',
  title: 'Helen',
  summary: '3 rounds for time:\n400-m run\n12 pull-ups',
  exercises: [listed(RUN), listed(PULL_UP)],
  sourcePdf: null,
};
/** A PDF the API kept: the saved workout's source. */
const SAVED_PDF = {
  id: 'pdf-0',
  originalFilename: 'Helen 261109.pdf',
  sizeBytes: 250_000,
  uploadedAt: '2026-11-08T18:00:00.000Z',
};

describe('workouts area pages', () => {
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
          { path: 'workouts/exercises/new', component: ExerciseEditComponent },
          {
            path: 'workouts/exercises/:id/edit',
            component: ExerciseEditComponent,
          },
          { path: 'workouts/exercises', component: ExercisesComponent },
          { path: 'workouts/new', component: WorkoutEditComponent },
          { path: 'workouts/:id/edit', component: WorkoutEditComponent },
          { path: 'workouts', component: WorkoutsComponent },
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

  /** Answers the form's catalogue requests (and the workout's, on the edit page). */
  async function openForm(url: string, workout?: object): Promise<void> {
    await open(url);
    http.expectOne('/api/exercises').flush(EXERCISES);
    if (workout) {
      http.expectOne('/api/workouts/w1').flush(workout);
    }
    await page.settle();
  }

  describe('week list', () => {
    it('the week starts on Monday', () => {
      expect(mondayOf('2026-11-09')).toBe('2026-11-09');
      expect(mondayOf('2026-11-15')).toBe('2026-11-09');
      expect(mondayOf('2026-11-01')).toBe('2026-10-26');
    });

    it('asks for the week of the day in the address and shows it day by day', async () => {
      await open('/workouts?week=2026-11-12');
      http
        .expectOne('/api/workouts?from=2026-11-09&to=2026-11-15')
        .flush([HELEN]);
      await page.settle();

      expect(
        page.query('[data-testid="workouts-week"]')?.textContent,
      ).toContain('9 Nov – 15 Nov 2026');
      expect(page.queryAll('.day')).toHaveLength(7);
      const monday = page.query('[data-testid="day-2026-11-09"]')!;
      const text = monday.textContent.replace(/\s+/g, ' ');
      expect(text).toContain('Monday, 9 November');
      expect(text).toContain('Helen');
      // The summary as written, line breaks and all.
      expect(
        monday.querySelector('[data-testid="workout-summary-text"]')
          ?.textContent,
      ).toBe('3 rounds for time:\n400-m run\n12 pull-ups');
      // The exercises, linked to their videos when they have one.
      const exercises = Array.from(
        monday.querySelectorAll('.wod__exercises li'),
      ).map((li) => [
        li.textContent.trim(),
        li.querySelector('a')?.getAttribute('href') ?? null,
      ]);
      expect(exercises).toEqual([
        ['Run', null],
        ['Pull-up', 'https://www.youtube.com/watch?v=lzRo-4pq_AY'],
      ]);
      expect(monday.querySelector('a')?.getAttribute('href')).toBe(
        '/workouts/w1/edit',
      );
      // A day can have several workouts: one more is added from the day itself.
      const another = monday.querySelector(
        '[data-testid="workout-add-another"]',
      );
      expect(another?.getAttribute('href')).toBe(
        '/workouts/new?date=2026-11-09',
      );
      expect(another?.getAttribute('aria-label')).toBe(
        'Add another workout for Monday, 9 November',
      );

      const tuesday = page.query('[data-testid="day-2026-11-10"]')!;
      expect(tuesday.textContent).toContain(texts.list.noWorkout);
      expect(tuesday.querySelector('a')?.getAttribute('href')).toBe(
        '/workouts/new?date=2026-11-10',
      );
      expect(
        tuesday.querySelector('[data-testid="workout-add-another"]'),
      ).toBeNull();

      // The Workouts tab is the current one, `?week=` and all.
      const current = page.queryAll('nav a[aria-current="page"]');
      expect(current.map((a) => a.textContent.trim())).toEqual([
        texts.nav.workouts,
      ]);
    });

    it('moves a week at a time and keeps the week in the address', async () => {
      await open('/workouts?week=2026-11-09');
      http.expectOne('/api/workouts?from=2026-11-09&to=2026-11-15').flush([]);
      await page.settle();

      await page.click(`[aria-label="${texts.list.nextWeek}"]`);
      http.expectOne('/api/workouts?from=2026-11-16&to=2026-11-22').flush([]);
      await page.settle();
      expect(router.url).toBe('/workouts?week=2026-11-16');

      await page.click(`[aria-label="${texts.list.previousWeek}"]`);
      await page.click(`[aria-label="${texts.list.previousWeek}"]`);
      // The answer for the week that was skipped over is dropped.
      http
        .expectOne('/api/workouts?from=2026-11-09&to=2026-11-15')
        .flush([HELEN]);
      http.expectOne('/api/workouts?from=2026-11-02&to=2026-11-08').flush([]);
      await page.settle();
      expect(page.text()).not.toContain('Helen');
      expect(page.query('[data-testid="day-2026-11-02"]')).not.toBeNull();
    });

    it('follows the week in the address when only the address changes', async () => {
      await open('/workouts?week=2026-11-16');
      http.expectOne('/api/workouts?from=2026-11-16&to=2026-11-22').flush([]);
      await page.settle();

      // A link to another week (the sidebar's Workouts link, a bookmark) reuses the page.
      await harness.navigateByUrl('/workouts?week=2026-11-09');
      await page.settle();

      http
        .expectOne('/api/workouts?from=2026-11-09&to=2026-11-15')
        .flush([HELEN]);
      await page.settle();
      expect(
        page.query('[data-testid="workouts-week"]')?.textContent,
      ).toContain('9 Nov – 15 Nov 2026');
      expect(page.text()).toContain('Helen');
    });

    it('shows the API error with a way to try again', async () => {
      await open('/workouts?week=2026-11-09');
      http
        .expectOne('/api/workouts?from=2026-11-09&to=2026-11-15')
        .flush(null, { status: 500, statusText: 'Error' });
      await page.settle();

      expect(page.alert()).toContain(texts.list.loadErrorMessage);

      await page.click('.btn--secondary');
      http.expectOne('/api/workouts?from=2026-11-09&to=2026-11-15').flush([]);
      await page.settle();
      expect(page.queryAll('.day')).toHaveLength(7);
    });
  });

  describe('exercises', () => {
    const names = () =>
      page.queryAll('tbody .cell-link').map((a) => a.textContent.trim());

    it('lists the exercises and filters them by status and by name or alias', async () => {
      await open('/workouts/exercises');
      http.expectOne('/api/exercises').flush(EXERCISES);
      await page.settle();

      expect(names()).toEqual(['Old move', 'Pull-up', 'Run']);
      expect(page.query('[data-testid="list-count"]')?.textContent).toContain(
        '3 of 3 exercises',
      );

      await page.type('input[type="search"]', 'KIPPING');
      expect(names()).toEqual(['Pull-up']);

      await page.type('input[type="search"]', '');
      const inactive = page
        .queryAll<HTMLInputElement>('input[type="radio"]')
        .find((radio) => radio.value === 'inactive')!;
      inactive.click();
      await page.settle();
      expect(names()).toEqual(['Old move']);
      expect(page.query('[data-testid="list-count"]')?.textContent).toContain(
        '1 of 3 exercises',
      );
    });

    it('creates an exercise with its other names as a list', async () => {
      await open('/workouts/exercises/new');

      await page.type('#exercise-name', '  Kettlebell swing ');
      await page.type('#exercise-aliases', 'KB swing, American swing ,');
      await page.submit();

      const req = http.expectOne('/api/exercises');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        name: 'Kettlebell swing',
        aliases: ['KB swing', 'American swing'],
        isActive: true,
        description: null,
        videoUrl: null,
      });
      req.flush(exercise('e-new', 'Kettlebell swing'));
      await page.settle();
      expect(router.url).toBe('/workouts/exercises');
      http.expectOne('/api/exercises').flush([]);
    });

    it('links each exercise with a video to it, in a new tab', async () => {
      await open('/workouts/exercises');
      http.expectOne('/api/exercises').flush(EXERCISES);
      await page.settle();

      const links = page.queryAll<HTMLAnchorElement>(
        'tbody a[target="_blank"]',
      );
      expect(
        links.map((a) => [a.getAttribute('aria-label'), a.href, a.rel]),
      ).toEqual([
        [
          'Watch the video of Pull-up',
          'https://www.youtube.com/watch?v=lzRo-4pq_AY',
          'noopener noreferrer',
        ],
      ]);
    });

    it('sends a description and a YouTube link, trimmed, and refuses another kind of link', async () => {
      await open('/workouts/exercises/new');

      await page.type('#exercise-name', 'Air squat');
      await page.type('#exercise-video', 'https://vimeo.com/1');
      await page.submit();
      expect(page.text()).toContain(texts.exercises.fields.videoUrlError);
      expect(page.query('[data-testid="exercise-video-open"]')).toBeNull();

      await page.type(
        '#exercise-video',
        '  https://youtu.be/rMvwVtlqjTE?si=x ',
      );
      expect(
        page.query<HTMLAnchorElement>('[data-testid="exercise-video-open"]')
          ?.href,
      ).toBe('https://www.youtube.com/watch?v=rMvwVtlqjTE');
      await page.type('#exercise-description', '  Hips back and down.  ');
      await page.submit();

      const req = http.expectOne('/api/exercises');
      expect(req.request.body).toMatchObject({
        name: 'Air squat',
        description: 'Hips back and down.',
        videoUrl: 'https://youtu.be/rMvwVtlqjTE?si=x',
      });
      req.flush(exercise('e-new', 'Air squat'));
      await page.settle();
      http.expectOne('/api/exercises').flush([]);
    });

    it('shows the stored video and description, and clearing them sends null', async () => {
      await open('/workouts/exercises/e-pull/edit');
      http
        .expectOne('/api/exercises/e-pull')
        .flush({ ...PULL_UP, description: 'Kip, then pull.' });
      await page.settle();

      expect(page.query<HTMLInputElement>('#exercise-video')?.value).toBe(
        'https://www.youtube.com/watch?v=lzRo-4pq_AY',
      );
      expect(
        page.query<HTMLTextAreaElement>('#exercise-description')?.value,
      ).toBe('Kip, then pull.');

      await page.type('#exercise-video', '');
      await page.type('#exercise-description', '   ');
      await page.submit();

      const req = http.expectOne('/api/exercises/e-pull');
      expect(req.request.body).toMatchObject({
        description: null,
        videoUrl: null,
      });
      req.flush(PULL_UP);
      await page.settle();
      http.expectOne('/api/exercises').flush([]);
    });

    it('sends nothing without a name, and shows the API’s refusal of a taken name', async () => {
      await open('/workouts/exercises/new');

      await page.submit();
      expect(page.text()).toContain(texts.exercises.fields.nameError);

      await page.type('#exercise-name', 'pull ups');
      await page.submit();
      const refusal = apiError(
        '"pull ups" is already the exercise "Pull-up"',
        409,
      );
      http.expectOne('/api/exercises').flush(refusal.body, refusal.options);
      await page.settle();

      expect(page.alert()).toBe('"pull ups" is already the exercise "Pull-up"');
      expect(router.url).toBe('/workouts/exercises/new');
    });

    it('edits an exercise, and deletes it only after a yes', async () => {
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
      await open('/workouts/exercises/e-pull/edit');
      http.expectOne('/api/exercises/e-pull').flush(PULL_UP);
      await page.settle();

      expect(page.query<HTMLInputElement>('#exercise-aliases')?.value).toBe(
        'Kipping pull-up',
      );

      await page.click('[data-testid="exercise-delete"]');
      expect(confirm).toHaveBeenCalledWith(
        "Delete “Pull-up”? An exercise used in workouts can't be deleted, only made inactive.",
      );

      confirm.mockReturnValue(true);
      await page.click('[data-testid="exercise-delete"]');
      const refusal = apiError('"Pull-up" is used in workouts', 409);
      const del = http.expectOne('/api/exercises/e-pull');
      expect(del.request.method).toBe('DELETE');
      del.flush(refusal.body, refusal.options);
      await page.settle();
      expect(page.alert()).toBe('"Pull-up" is used in workouts');

      await page.check('input[type="checkbox"]', false);
      await page.submit();
      const patch = http.expectOne('/api/exercises/e-pull');
      expect(patch.request.method).toBe('PATCH');
      expect(patch.request.body).toMatchObject({
        name: 'Pull-up',
        aliases: ['Kipping pull-up'],
        isActive: false,
      });
      patch.flush(PULL_UP);
      await page.settle();
      expect(router.url).toBe('/workouts/exercises');
      http.expectOne('/api/exercises').flush([]);
    });
  });

  describe('workout form', () => {
    const names = () =>
      page
        .queryAll('[data-testid^="listed-"] .wk-list__name')
        .map((n) => n.textContent.trim());

    async function addFromList(id: string): Promise<void> {
      await page.select('#workout-add-exercise', id);
      await page.click('[data-testid="add-exercise"]');
    }

    it('starts on the day in the address, offering the active exercises', async () => {
      await openForm('/workouts/new?date=2026-11-10');

      expect(page.query<HTMLInputElement>('#workout-date')?.value).toBe(
        '2026-11-10',
      );
      expect(page.query('[data-testid="no-exercises"]')).not.toBeNull();
      const offered = page
        .queryAll<HTMLOptionElement>('#workout-add-exercise option')
        .map((option) => option.textContent.trim());
      expect(offered).toEqual([texts.form.exercises.choose, 'Pull-up', 'Run']);
    });

    it('writes a workout by hand: summary with line breaks, exercises in order', async () => {
      await openForm('/workouts/new?date=2026-11-10');

      await page.type('#workout-title', ' Mini Helen ');
      await page.type(
        '#workout-summary',
        '3 rounds for time:  \n400-m run\n\n\n\n12 pull-ups\n',
      );
      await addFromList('e-pull');
      await addFromList('e-run');
      expect(names()).toEqual(['Pull-up', 'Run']);
      // An exercise is offered once.
      expect(
        page
          .queryAll<HTMLOptionElement>('#workout-add-exercise option')
          .map((o) => o.value),
      ).toEqual(['']);

      // Run first.
      await page.click('[aria-label="Move exercise 2 up"]');
      expect(names()).toEqual(['Run', 'Pull-up']);
      await page.submit('form');

      const req = http.expectOne('/api/workouts');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        date: '2026-11-10',
        title: 'Mini Helen',
        summary: '3 rounds for time:\n400-m run\n\n12 pull-ups',
        exerciseIds: ['e-run', 'e-pull'],
        sourcePdfId: null,
      });
      req.flush({ ...HELEN, date: '2026-11-10' });
      await page.settle();
      expect(router.url).toBe('/workouts?week=2026-11-10');
      http.expectOne('/api/workouts?from=2026-11-09&to=2026-11-15').flush([]);
    });

    it('needs a summary; exercises are optional', async () => {
      await openForm('/workouts/new?date=2026-11-10');

      await page.submit('form');
      expect(page.alert()).toBe(texts.form.invalid);
      expect(page.text()).toContain(texts.form.summaryRequired);
      http.expectNone('/api/workouts');

      await page.type('#workout-summary', 'Mobility');
      await page.submit('form');
      const req = http.expectOne('/api/workouts');
      expect(req.request.body).toMatchObject({
        title: null,
        summary: 'Mobility',
        exerciseIds: [],
      });
      req.flush(HELEN);
      await page.settle();
      http.expectOne('/api/workouts?from=2026-11-09&to=2026-11-15').flush([]);
    });

    it('edits a saved workout: removes an exercise and sends the rest', async () => {
      await openForm('/workouts/w1/edit', HELEN);

      expect(page.query<HTMLTextAreaElement>('#workout-summary')?.value).toBe(
        HELEN.summary,
      );
      expect(names()).toEqual(['Run', 'Pull-up']);

      await page.click('[aria-label="Remove exercise 1"]');
      await page.submit('form');

      const req = http.expectOne('/api/workouts/w1');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({
        date: '2026-11-09',
        title: 'Helen',
        summary: HELEN.summary,
        exerciseIds: ['e-pull'],
        sourcePdfId: null,
      });
      req.flush(HELEN);
      await page.settle();
      expect(router.url).toBe('/workouts?week=2026-11-09');
      http.expectOne('/api/workouts?from=2026-11-09&to=2026-11-15').flush([]);
    });

    it('keeps an inactive exercise a saved workout uses, marked as such', async () => {
      await openForm('/workouts/w1/edit', {
        ...HELEN,
        exercises: [listed(OLD)],
      });

      const row = page.query('[data-testid="listed-0"]')!;
      expect(row.textContent).toContain('Old move');
      expect(row.textContent).toContain('Inactive');
    });

    it('deletes the workout only after a yes', async () => {
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
      await openForm('/workouts/w1/edit', HELEN);

      await page.click('[data-testid="workout-delete"]');
      expect(confirm).toHaveBeenCalledWith(texts.form.deleteConfirm);

      confirm.mockReturnValue(true);
      await page.click('[data-testid="workout-delete"]');
      const del = http.expectOne('/api/workouts/w1');
      expect(del.request.method).toBe('DELETE');
      del.flush({ deleted: true });
      await page.settle();
      expect(router.url).toBe('/workouts?week=2026-11-09');
      http.expectOne('/api/workouts?from=2026-11-09&to=2026-11-15').flush([]);
    });

    it('shows a failed load with a way to try again', async () => {
      await open('/workouts/new');
      http
        .expectOne('/api/exercises')
        .flush(null, { status: 500, statusText: 'Error' });
      await page.settle();

      expect(page.alert()).toBe(texts.form.loadError);
      expect(page.query('form')).toBeNull();

      await page.click('.btn--secondary');
      http.expectOne('/api/exercises').flush(EXERCISES);
      await page.settle();
      expect(page.query('form')).not.toBeNull();
    });

    describe('from a PDF', () => {
      const DRAFT = {
        sourceCode: '261109',
        date: '2026-11-09',
        title: 'Helen',
        summary:
          '3 rounds for time:\n400-m run\n21 Russian KB swings (35/53 lb)\n15 wall balls\n12 pull-ups',
        exercises: [
          { name: 'Run', exerciseId: 'e-run', exerciseName: 'Run' },
          { name: 'Russian KB swing', exerciseId: null, exerciseName: null },
          { name: 'Wall ball', exerciseId: null, exerciseName: null },
          { name: 'Pull-up', exerciseId: 'e-pull', exerciseName: 'Pull-up' },
        ],
        sourcePdf: {
          id: 'pdf-1',
          originalFilename: '261109.pdf',
          sizeBytes: 300_000,
          uploadedAt: '2026-11-12T10:00:00.000Z',
        },
        warnings: [],
      };
      const sourceBlock = () =>
        page.query('[data-testid="workout-source-pdf"]')?.textContent ?? '';

      async function upload(): Promise<File> {
        const file = new File(['%PDF-1.4'], '261109.pdf', {
          type: 'application/pdf',
        });
        const input = page.query<HTMLInputElement>(
          '[data-testid="workout-pdf"]',
        )!;
        Object.defineProperty(input, 'files', {
          value: [file],
          configurable: true,
        });
        input.dispatchEvent(new Event('change'));
        await page.settle();
        return file;
      }

      it('fills the form; one movement is linked to an exercise, another created, then it saves', async () => {
        await openForm('/workouts/new');

        const file = await upload();
        const importReq = http.expectOne('/api/workouts/import-pdf');
        expect(
          ((importReq.request.body as FormData).get('file') as File).name,
        ).toBe(file.name);
        importReq.flush(DRAFT);
        await page.settle();

        expect(page.query<HTMLInputElement>('#workout-date')?.value).toBe(
          '2026-11-09',
        );
        expect(page.query<HTMLInputElement>('#workout-title')?.value).toBe(
          'Helen',
        );
        expect(page.query<HTMLTextAreaElement>('#workout-summary')?.value).toBe(
          DRAFT.summary,
        );
        expect(names()).toEqual([
          'Run',
          '“Russian KB swing” (from the PDF)',
          '“Wall ball” (from the PDF)',
          'Pull-up',
        ]);
        // The API kept the PDF: it goes with the workout when it is saved.
        expect(sourceBlock()).toContain('261109.pdf');
        expect(sourceBlock()).toContain('293 KB · uploaded 12 Nov 2026');
        expect(sourceBlock()).toContain(texts.import.sourceUnsaved);

        // Saving waits until every movement has an exercise.
        await page.submit('form');
        expect(page.alert()).toBe(texts.form.pending);
        http.expectNone('/api/workouts');

        // "Russian KB swing" is another name of an existing exercise.
        await page.select('#link-1', 'e-pull');
        await page.click('[data-testid="listed-1"] .btn--secondary');
        const link = http.expectOne('/api/exercises/e-pull/aliases');
        expect(link.request.method).toBe('POST');
        expect(link.request.body).toEqual({ alias: 'Russian KB swing' });
        link.flush({
          ...PULL_UP,
          aliases: ['Kipping pull-up', 'Russian KB swing'],
        });
        await page.settle();
        // Pull-up was listed already: it stays there once.
        expect(names()).toEqual([
          'Run',
          '“Wall ball” (from the PDF)',
          'Pull-up',
        ]);

        // "Wall ball" is new.
        await page.click('[data-testid="listed-1"] .btn--primary');
        const create = http.expectOne('/api/exercises');
        expect(create.request.method).toBe('POST');
        expect(create.request.body).toEqual({ name: 'Wall ball' });
        create.flush(exercise('e-wb', 'Wall ball'));
        await page.settle();
        expect(names()).toEqual(['Run', 'Wall ball', 'Pull-up']);

        await page.submit('form');
        const save = http.expectOne('/api/workouts');
        expect(save.request.body).toEqual({
          date: '2026-11-09',
          title: 'Helen',
          summary: DRAFT.summary,
          exerciseIds: ['e-run', 'e-wb', 'e-pull'],
          sourcePdfId: 'pdf-1',
        });
        save.flush(HELEN);
        await page.settle();
        http.expectOne('/api/workouts?from=2026-11-09&to=2026-11-15').flush([]);
      });

      it('a movement can also be removed, and a failed create keeps it waiting', async () => {
        await openForm('/workouts/new');
        await upload();
        http.expectOne('/api/workouts/import-pdf').flush(DRAFT);
        await page.settle();

        await page.click('[data-testid="listed-1"] .btn--primary');
        const refusal = apiError(
          '"Russian KB swing" is already the exercise "X"',
          409,
        );
        http.expectOne('/api/exercises').flush(refusal.body, refusal.options);
        await page.settle();
        expect(page.alert()).toBe(
          '"Russian KB swing" is already the exercise "X"',
        );
        expect(names()[1]).toBe('“Russian KB swing” (from the PDF)');

        await page.click('[aria-label="Remove exercise 2"]');
        await page.click('[aria-label="Remove exercise 2"]');
        expect(names()).toEqual(['Run', 'Pull-up']);

        await page.submit('form');
        const save = http.expectOne('/api/workouts');
        expect(
          (save.request.body as { exerciseIds: string[] }).exerciseIds,
        ).toEqual(['e-run', 'e-pull']);
        save.flush(HELEN);
        await page.settle();
        http.expectOne('/api/workouts?from=2026-11-09&to=2026-11-15').flush([]);
      });

      it('saves nothing while a PDF is being read', async () => {
        await openForm('/workouts/w1/edit', HELEN);

        await upload();
        const importReq = http.expectOne('/api/workouts/import-pdf');
        const save = page.query<HTMLButtonElement>('button[type="submit"]')!;
        expect(save.disabled).toBe(true);
        // The form is valid as loaded: a submit now would save it without the PDF.
        await page.submit('form');
        http.expectNone('/api/workouts/w1');

        importReq.flush({ ...DRAFT, exercises: [] });
        await page.settle();
        expect(save.disabled).toBe(false);
      });

      it('a saved workout shows its PDF and keeps it; a new PDF replaces it, or clears it when the API could not keep it', async () => {
        await openForm('/workouts/w1/edit', { ...HELEN, sourcePdf: SAVED_PDF });

        expect(sourceBlock()).toContain('Helen 261109.pdf');
        expect(sourceBlock()).toContain('244 KB · uploaded 8 Nov 2026');
        expect(sourceBlock()).toContain(texts.import.sourceSaved);

        // Saved as it is, the workout keeps its PDF.
        await page.submit('form');
        const keep = http.expectOne('/api/workouts/w1');
        expect(keep.request.body).toMatchObject({ sourcePdfId: 'pdf-0' });
        keep.flush(null, { status: 500, statusText: 'Error' });
        await page.settle();

        // Another PDF: the workout now comes from it.
        await upload();
        http.expectOne('/api/workouts/import-pdf').flush(DRAFT);
        await page.settle();
        expect(sourceBlock()).toContain('261109.pdf');
        expect(sourceBlock()).not.toContain('Helen 261109.pdf');
        expect(sourceBlock()).toContain(texts.import.sourceUnsaved);

        // One the API could not keep (its warning says why): no source any more.
        await upload();
        http.expectOne('/api/workouts/import-pdf').flush({
          ...DRAFT,
          exercises: [],
          sourcePdf: null,
          warnings: ['The PDF was not kept: file storage is not configured.'],
        });
        await page.settle();
        expect(page.query('[data-testid="workout-source-pdf"]')).toBeNull();
        await page.submit('form');
        const save = http.expectOne('/api/workouts/w1');
        expect(save.request.body).toMatchObject({ sourcePdfId: null });
        save.flush(HELEN);
        await page.settle();
        http.expectOne('/api/workouts?from=2026-11-09&to=2026-11-15').flush([]);
      });

      describe('opening the PDF', () => {
        function fakeTab() {
          return {
            opener: {} as unknown,
            location: { href: '' },
            close: vi.fn(),
          };
        }
        const objectUrls: string[] = [];
        const revoked: string[] = [];

        beforeEach(() => {
          objectUrls.length = 0;
          revoked.length = 0;
          // jsdom has no object URLs.
          Object.defineProperty(URL, 'createObjectURL', {
            configurable: true,
            value: (blob: Blob) => {
              objectUrls.push(`blob:pdf-${objectUrls.length + 1}`);
              expect(blob.type).toBe('application/pdf');
              return objectUrls[objectUrls.length - 1];
            },
          });
          Object.defineProperty(URL, 'revokeObjectURL', {
            configurable: true,
            value: (url: string) => revoked.push(url),
          });
        });

        const pdfRequest = (id: string) => {
          const req = http.expectOne(`/api/workouts/source-pdfs/${id}`);
          expect(req.request.method).toBe('GET');
          expect(req.request.responseType).toBe('blob');
          return req;
        };
        const pdfBlob = () =>
          new Blob(['%PDF-1.4'], { type: 'application/pdf' });

        it('opens a tab in the click, then shows the PDF in it; the next open frees the last file', async () => {
          const tab = fakeTab();
          const open = vi
            .spyOn(window, 'open')
            .mockReturnValue(tab as unknown as Window);
          await openForm('/workouts/w1/edit', {
            ...HELEN,
            sourcePdf: SAVED_PDF,
          });

          await page.click('[data-testid="workout-source-pdf-open"]');
          expect(open).toHaveBeenCalledWith('', '_blank');
          expect(tab.opener).toBeNull();
          expect(
            page.query<HTMLButtonElement>(
              '[data-testid="workout-source-pdf-open"]',
            )?.textContent,
          ).toContain(texts.import.opening);
          pdfRequest('pdf-0').flush(pdfBlob());
          await page.settle();

          expect(tab.location.href).toBe('blob:pdf-1');
          expect(page.query('[role="alert"]')).toBeNull();

          // A PDF imported but not saved yet opens too.
          await upload();
          http.expectOne('/api/workouts/import-pdf').flush(DRAFT);
          await page.settle();
          const next = fakeTab();
          open.mockReturnValue(next as unknown as Window);
          await page.click('[data-testid="workout-source-pdf-open"]');
          pdfRequest('pdf-1').flush(pdfBlob());
          await page.settle();
          expect(next.location.href).toBe('blob:pdf-2');
          expect(revoked).toEqual(['blob:pdf-1']);

          // Leaving the page frees it too.
          await harness.navigateByUrl('/elsewhere');
          expect(revoked).toEqual(['blob:pdf-1', 'blob:pdf-2']);
        });

        it('leaving the page while the PDF loads drops the request and closes its tab', async () => {
          const tab = fakeTab();
          vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
          await openForm('/workouts/w1/edit', {
            ...HELEN,
            sourcePdf: SAVED_PDF,
          });

          await page.click('[data-testid="workout-source-pdf-open"]');
          const pending = pdfRequest('pdf-0');
          await harness.navigateByUrl('/elsewhere');

          expect(pending.cancelled).toBe(true);
          expect(tab.close).toHaveBeenCalled();
          expect(objectUrls).toEqual([]);
        });

        it('closes the tab and says so when the PDF cannot be fetched', async () => {
          const tab = fakeTab();
          vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
          await openForm('/workouts/w1/edit', {
            ...HELEN,
            sourcePdf: SAVED_PDF,
          });

          await page.click('[data-testid="workout-source-pdf-open"]');
          pdfRequest('pdf-0').flush(new Blob(['{}']), {
            status: 404,
            statusText: 'Not Found',
          });
          await page.settle();

          expect(tab.close).toHaveBeenCalled();
          expect(page.alert()).toBe(texts.import.openError);
          expect(objectUrls).toEqual([]);
        });
      });

      it('shows the import warnings, and why a PDF could not be read', async () => {
        await openForm('/workouts/new?date=2026-11-10');
        await page.type('#workout-title', 'Mine');

        await upload();
        const refusal = apiError('The file is not a PDF');
        http
          .expectOne('/api/workouts/import-pdf')
          .flush(refusal.body, refusal.options);
        await page.settle();
        expect(page.alert()).toBe('The file is not a PDF');
        expect(page.query<HTMLInputElement>('#workout-title')?.value).toBe(
          'Mine',
        );

        await upload();
        http.expectOne('/api/workouts/import-pdf').flush({
          ...DRAFT,
          date: null,
          warnings: ['The date could not be read from the heading'],
        });
        await page.settle();
        expect(
          page.query('[data-testid="import-warnings"]')?.textContent,
        ).toContain('The date could not be read from the heading');
        expect(page.query<HTMLInputElement>('#workout-date')?.value).toBe(
          '2026-11-10',
        );
      });
    });
  });
});
