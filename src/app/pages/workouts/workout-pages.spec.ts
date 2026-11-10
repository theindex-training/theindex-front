import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import en from '../../../../public/i18n/en.json';
import { PageDriver, apiError, driver } from '../../../testing/dom';
import { signInAs } from '../../../testing/jwt';
import { ExerciseEditComponent } from './exercises/exercise-edit.component';
import { ExercisesComponent } from './exercises/exercises.component';
import { WorkoutTypeEditComponent } from './types/workout-type-edit.component';
import { WorkoutTypesComponent } from './types/workout-types.component';
import { WorkoutEditComponent } from './workout-edit.component';
import { WorkoutsComponent, mondayOf } from './workouts.component';

/** The workouts area: the week list, the exercise and type pages, and the workout form. */

const texts = en.workouts;

const exercise = (id: string, name: string, over: object = {}) => ({
  id,
  name,
  aliases: [] as string[],
  modality: 'GYMNASTICS',
  defaultMeasure: 'REPS',
  isActive: true,
  description: null as string | null,
  videoUrl: null as string | null,
  ...over,
});
const RUN = exercise('e-run', 'Run', {
  modality: 'MONOSTRUCTURAL',
  defaultMeasure: 'DISTANCE',
});
const PULL_UP = exercise('e-pull', 'Pull-up', {
  aliases: ['Kipping pull-up'],
  videoUrl: 'https://www.youtube.com/watch?v=lzRo-4pq_AY',
});
const OLD = exercise('e-old', 'Old move', { isActive: false });
const EXERCISES = [OLD, PULL_UP, RUN];

const type = (
  id: string,
  name: string,
  code: string | null,
  scoreType: string,
) => ({
  id,
  name,
  description: null,
  code,
  scoreType,
});
const FOR_TIME = type('t-time', 'For time', 'FOR_TIME', 'TIME');
const AMRAP = type('t-amrap', 'AMRAP', 'AMRAP', 'ROUNDS_REPS');
const CHIPPER = type('t-chip', 'Chipper', null, 'TIME');
const TYPES = [FOR_TIME, AMRAP, CHIPPER];

const NO_ITEM = {
  quantity: null,
  quantityMax: null,
  quantityFemale: null,
  maxEffort: false,
  loadKg: null,
  loadFemaleKg: null,
  loadPercent: null,
  slot: null,
  notes: null,
};
const NO_STRUCTURE = {
  rounds: null,
  repScheme: null,
  durationSeconds: null,
  timeCapSeconds: null,
  intervalSeconds: null,
  workSeconds: null,
  restSeconds: null,
  notes: null,
};
const HELEN = {
  id: 'w1',
  date: '2026-11-09',
  title: 'Helen',
  notes: null,
  summary: {
    blocks: [
      { type: 'paragraph', data: { text: '<b>3 rounds for time:</b>' } },
      { type: 'paragraph', data: { text: '400-m run<br>12 pull-ups' } },
    ],
  },
  summaryText: '3 rounds for time:\n400-m run\n12 pull-ups',
  parts: [
    {
      id: 'p1',
      title: null,
      workoutTypeId: 't-time',
      workoutType: { id: 't-time', name: 'For time', code: 'FOR_TIME' },
      scoreType: 'TIME',
      variants: [
        {
          ...NO_STRUCTURE,
          level: 'RX',
          rounds: 3,
          items: [
            {
              ...NO_ITEM,
              exerciseId: 'e-run',
              exercise: { id: 'e-run', name: 'Run' },
              measure: 'DISTANCE',
              quantity: 400,
            },
            {
              ...NO_ITEM,
              exerciseId: 'e-pull',
              exercise: { id: 'e-pull', name: 'Pull-up' },
              measure: 'REPS',
              quantity: 12,
            },
          ],
        },
      ],
    },
  ],
};

describe('workouts area pages', () => {
  let http: HttpTestingController;
  let router: Router;
  let harness: RouterTestingHarness;
  let page: PageDriver;

  const originalMatchMedia = window.matchMedia;

  beforeEach(async () => {
    localStorage.clear();
    signInAs('TRAINER');
    // jsdom has no matchMedia, which Editor.js (the summary editor) asks for.
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
    })) as unknown as typeof window.matchMedia;
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
          { path: 'workouts/types/new', component: WorkoutTypeEditComponent },
          {
            path: 'workouts/types/:id/edit',
            component: WorkoutTypeEditComponent,
          },
          { path: 'workouts/types', component: WorkoutTypesComponent },
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
    window.matchMedia = originalMatchMedia;
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
    http.expectOne('/api/workout-types').flush(TYPES);
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
      expect(text).toContain('For time');
      expect(text).toContain('Score: Time');
      // The summary, with its formatting.
      const summary = monday.querySelector(
        '[data-testid="workout-summary-text"]',
      )!;
      expect(
        Array.from(summary.querySelectorAll('p')).map((p) => p.innerHTML),
      ).toEqual(['<b>3 rounds for time:</b>', '400-m run<br>12 pull-ups']);
      // Not the generated exercise lines.
      expect(text).not.toContain('400 m Run');
      expect(monday.querySelector('a')?.getAttribute('href')).toBe(
        '/workouts/w1/edit',
      );

      const tuesday = page.query('[data-testid="day-2026-11-10"]')!;
      expect(tuesday.textContent).toContain(texts.list.noWorkout);
      expect(tuesday.querySelector('a')?.getAttribute('href')).toBe(
        '/workouts/new?date=2026-11-10',
      );
    });

    it('shows the RX exercises of a workout saved without a summary', async () => {
      await open('/workouts?week=2026-11-09');
      http
        .expectOne('/api/workouts?from=2026-11-09&to=2026-11-15')
        .flush([{ ...HELEN, summary: { blocks: [] }, summaryText: '' }]);
      await page.settle();

      const monday = page.query('[data-testid="day-2026-11-09"]')!;
      const text = monday.textContent.replace(/\s+/g, ' ');
      expect(
        monday.querySelector('[data-testid="workout-summary-text"]'),
      ).toBeNull();
      expect(text).toContain('3 rounds');
      expect(text).toContain('400 m Run');
      expect(text).toContain('12 Pull-up');
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
      await page.select('#exercise-measure', 'TIME');
      await page.submit();

      const req = http.expectOne('/api/exercises');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        name: 'Kettlebell swing',
        aliases: ['KB swing', 'American swing'],
        modality: 'WEIGHTLIFTING',
        defaultMeasure: 'TIME',
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

  describe('workout types', () => {
    it('lists the types and marks the built-in ones', async () => {
      await open('/workouts/types');
      http.expectOne('/api/workout-types').flush(TYPES);
      await page.settle();

      const rows = page
        .queryAll('tbody tr')
        .map((row) => row.textContent.replace(/\s+/g, ' ').trim());
      expect(rows[0]).toContain('For time');
      expect(rows[0]).toContain(texts.types.list.builtIn);
      expect(rows[1]).toContain('Rounds + reps');
      expect(rows[2]).toContain('Chipper');
      expect(rows[2]).not.toContain(texts.types.list.builtIn);
    });

    it('creates a type with its score', async () => {
      await open('/workouts/types/new');

      await page.type('#type-name', ' Ladder ');
      await page.type('#type-description', ' Up and down. ');
      await page.select('#type-score', 'REPS');
      await page.submit();

      const req = http.expectOne('/api/workout-types');
      expect(req.request.body).toEqual({
        name: 'Ladder',
        description: 'Up and down.',
        scoreType: 'REPS',
      });
      req.flush(type('t-new', 'Ladder', null, 'REPS'));
      await page.settle();
      expect(router.url).toBe('/workouts/types');
      http.expectOne('/api/workout-types').flush([]);
    });

    it('a built-in type can be edited but offers no delete', async () => {
      await open('/workouts/types/t-amrap/edit');
      http.expectOne('/api/workout-types/t-amrap').flush(AMRAP);
      await page.settle();

      expect(page.query('[data-testid="type-delete"]')).toBeNull();
      expect(page.text()).toContain(texts.types.edit.builtIn);
    });

    it('a type of the trainers’ own is deleted after a yes', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      await open('/workouts/types/t-chip/edit');
      http.expectOne('/api/workout-types/t-chip').flush(CHIPPER);
      await page.settle();
      await page.click('[data-testid="type-delete"]');
      const del = http.expectOne('/api/workout-types/t-chip');
      expect(del.request.method).toBe('DELETE');
      del.flush({ deleted: true });
      await page.settle();
      expect(router.url).toBe('/workouts/types');
      http.expectOne('/api/workout-types').flush([]);
    });
  });

  describe('workout form', () => {
    const item = (n: number, field: string) => `#p0-RX-i${n}-${field}`;

    /** Editor.js starts watching a rendered block for edits in an idle callback. */
    const idle = () =>
      new Promise<void>((resolve) => requestIdleCallback(() => resolve()));

    const summaryParagraphs = () =>
      page
        .queryAll('[data-testid="workout-summary"] .ce-paragraph')
        .map((p) => p.innerHTML);

    /** Types into the summary editor's first paragraph, as a trainer would. */
    async function typeSummary(html: string): Promise<void> {
      await idle();
      page.query('[data-testid="workout-summary"] .ce-paragraph')!.innerHTML =
        html;
    }

    /**
     * Submits; the page reads the summary from Editor.js first, so the request (or the
     * refusal) comes a moment later.
     */
    async function submitAndSend(url: string): Promise<TestRequest> {
      await page.submit('form');
      return vi.waitFor(() => http.expectOne(url), { timeout: 3000 });
    }

    async function submitAndRefuse(): Promise<void> {
      await page.submit('form');
      await vi.waitFor(() => expect(page.alert()).toBe(texts.form.invalid), {
        timeout: 3000,
      });
      await page.settle();
    }

    it('starts on the day in the address with the first type and its score', async () => {
      await openForm('/workouts/new?date=2026-11-10');

      expect(page.query<HTMLInputElement>('#workout-date')?.value).toBe(
        '2026-11-10',
      );
      expect(page.query<HTMLSelectElement>('#part-0-type')?.value).toBe(
        't-time',
      );
      expect(page.query<HTMLSelectElement>('#part-0-score')?.value).toBe(
        'TIME',
      );
      // Inactive exercises aren't offered for a new item.
      const offered = page
        .queryAll<HTMLOptionElement>(`${item(0, 'exercise')} option`)
        .map((option) => option.textContent.trim());
      expect(offered).toEqual([texts.form.item.choose, 'Pull-up', 'Run']);
    });

    it('builds a workout by hand and sends it whole', async () => {
      await openForm('/workouts/new?date=2026-11-10');

      await page.type('#workout-title', ' Mini Helen ');
      await page.type('#p0-RX-rounds', '3');
      await page.select(item(0, 'exercise'), 'e-run');
      // Picking Run switched the item to metres.
      expect(page.query<HTMLSelectElement>(item(0, 'measure'))?.value).toBe(
        'DISTANCE',
      );
      await page.type(item(0, 'quantity'), '400');
      await page.click('.wk-variant__footer button');
      await page.select(item(1, 'exercise'), 'e-pull');
      await page.type(item(1, 'quantity'), '12');
      await page.type(item(1, 'load'), '10');
      await typeSummary(
        '<b>3 rounds for time:</b><br>400-m run<br>12 pull-ups',
      );

      const req = await submitAndSend('/api/workouts');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        date: '2026-11-10',
        title: 'Mini Helen',
        notes: null,
        summary: {
          time: expect.any(Number),
          version: expect.any(String),
          blocks: [
            {
              id: expect.any(String),
              type: 'paragraph',
              data: {
                text: '<b>3 rounds for time:</b><br>400-m run<br>12 pull-ups',
              },
            },
          ],
        },
        parts: [
          {
            title: null,
            workoutTypeId: 't-time',
            scoreType: 'TIME',
            variants: [
              {
                ...NO_STRUCTURE,
                level: 'RX',
                rounds: 3,
                items: [
                  {
                    ...NO_ITEM,
                    exerciseId: 'e-run',
                    measure: 'DISTANCE',
                    quantity: 400,
                  },
                  {
                    ...NO_ITEM,
                    exerciseId: 'e-pull',
                    measure: 'REPS',
                    quantity: 12,
                    loadKg: 10,
                  },
                ],
              },
            ],
          },
        ],
      });
      req.flush({ ...HELEN, date: '2026-11-10' });
      await page.settle();
      expect(router.url).toBe('/workouts?week=2026-11-10');
      http.expectOne('/api/workouts?from=2026-11-09&to=2026-11-15').flush([]);
    });

    it('sends nothing while an exercise has a problem, and says which', async () => {
      await openForm('/workouts/new?date=2026-11-10');

      await submitAndRefuse();
      expect(page.text()).toContain(texts.form.itemErrors.exercise);
      expect(page.text()).toContain(texts.form.summaryError);

      await page.select(item(0, 'exercise'), 'e-pull');
      await typeSummary('21-15-9 pull-ups');
      await submitAndRefuse();
      expect(page.text()).toContain(texts.form.itemErrors.repsRequired);
      expect(page.text()).not.toContain(texts.form.summaryError);

      // A rep scheme on the level gives the reps.
      await page.type('#p0-RX-repScheme', '21-15-9');
      const req = await submitAndSend('/api/workouts');
      expect(
        (req.request.body as { parts: { variants: object[] }[] }).parts[0]
          .variants[0],
      ).toMatchObject({
        repScheme: [21, 15, 9],
        items: [{ exerciseId: 'e-pull', quantity: null }],
      });
      req.flush(HELEN);
      await page.settle();
      http.expectOne('/api/workouts?from=2026-11-09&to=2026-11-15').flush([]);
    });

    it('choosing a type sets its score and shows the fields it uses', async () => {
      await openForm('/workouts/new');
      const fields = () =>
        page
          .queryAll('.wk-structure label')
          .map((label) => label.textContent.trim());

      expect(fields()).toEqual(['Rounds', 'Rep scheme', 'Time cap', 'Rest']);

      await page.select('#part-0-type', 't-amrap');

      expect(page.query<HTMLSelectElement>('#part-0-score')?.value).toBe(
        'ROUNDS_REPS',
      );
      expect(fields()).toEqual(['Duration']);
    });

    it('shows the saved summary and the RX workout, and sends them back with the part’s id', async () => {
      await openForm('/workouts/w1/edit', HELEN);
      await idle();

      expect(summaryParagraphs()).toEqual([
        '<b>3 rounds for time:</b>',
        '400-m run<br>12 pull-ups',
      ]);
      // One part, its RX level: nothing to add parts or levels with.
      expect(page.text()).toContain(texts.form.rx.title);
      expect(page.queryAll('[data-testid^="part-"]')).toHaveLength(1);
      expect(page.query('[data-testid="hidden-sections"]')).toBeNull();

      await page.type(item(0, 'quantity'), '800');
      const req = await submitAndSend('/api/workouts/w1');
      expect(req.request.method).toBe('PATCH');
      const body = req.request.body as {
        summary: { blocks: { data: { text: string } }[] };
        parts: { id: string; variants: { level: string; items: object[] }[] }[];
      };
      expect(body.summary.blocks.map((b) => b.data.text)).toEqual([
        '<b>3 rounds for time:</b>',
        '400-m run<br>12 pull-ups',
      ]);
      // The part keeps its id, so results can hang on it later.
      expect(body.parts.map((p) => p.id)).toEqual(['p1']);
      expect(body.parts[0].variants.map((v) => v.level)).toEqual(['RX']);
      expect(body.parts[0].variants[0].items[0]).toMatchObject({
        quantity: 800,
      });
      req.flush(HELEN);
      await page.settle();
      expect(router.url).toBe('/workouts?week=2026-11-09');
      http.expectOne('/api/workouts?from=2026-11-09&to=2026-11-15').flush([]);
    });

    it('keeps the levels and parts it doesn’t show, and says so', async () => {
      const rx = HELEN.parts[0].variants[0];
      const older = {
        ...HELEN,
        parts: [
          {
            ...HELEN.parts[0],
            variants: [rx, { ...rx, level: 'BEGINNER', rounds: 2 }],
          },
          { ...HELEN.parts[0], id: 'p2', title: 'Skill' },
        ],
      };
      await openForm('/workouts/w1/edit', older);

      expect(
        page.query('[data-testid="hidden-sections"]')?.textContent,
      ).toContain('also has 2 levels or parts');

      const req = await submitAndSend('/api/workouts/w1');
      const body = req.request.body as {
        parts: { id: string; variants: { level: string; rounds: number }[] }[];
      };
      expect(body.parts.map((p) => p.id)).toEqual(['p1', 'p2']);
      expect(body.parts[0].variants.map((v) => [v.level, v.rounds])).toEqual([
        ['RX', 3],
        ['BEGINNER', 2],
      ]);
      req.flush(HELEN);
      await page.settle();
      http.expectOne('/api/workouts?from=2026-11-09&to=2026-11-15').flush([]);
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
      http.expectOne('/api/exercises').flush(EXERCISES);
      http
        .expectOne('/api/workout-types')
        .flush(null, { status: 500, statusText: 'Error' });
      await page.settle();

      expect(page.alert()).toBe(texts.form.loadError);
      expect(page.query('form')).toBeNull();

      await page.click('.btn--secondary');
      http.expectOne('/api/exercises').flush(EXERCISES);
      http.expectOne('/api/workout-types').flush(TYPES);
      await page.settle();
      expect(page.query('form')).not.toBeNull();
    });

    describe('from a PDF', () => {
      const DRAFT = {
        sourceCode: '261114',
        date: '2026-11-14',
        title: null,
        summary: {
          blocks: [
            { type: 'paragraph', data: { text: '<b>AMRAP 12:</b>' } },
            { type: 'paragraph', data: { text: '200-m run' } },
            { type: 'paragraph', data: { text: '15 wall balls (20/14 lb)' } },
          ],
        },
        unknownExercises: ['Wall ball'],
        warnings: ['The date could not be read from the heading'],
        parts: [
          {
            title: null,
            typeCode: 'AMRAP',
            workoutTypeId: 't-amrap',
            scoreType: 'ROUNDS_REPS',
            variants: [
              {
                ...NO_STRUCTURE,
                level: 'RX',
                durationSeconds: 720,
                items: [
                  {
                    ...NO_ITEM,
                    exerciseId: 'e-run',
                    exerciseName: 'Run',
                    measure: 'DISTANCE',
                    quantity: 200,
                  },
                  {
                    ...NO_ITEM,
                    exerciseId: null,
                    exerciseName: 'Wall ball',
                    measure: 'REPS',
                    quantity: 15,
                    loadKg: 9,
                    loadFemaleKg: 6,
                  },
                ],
              },
            ],
          },
        ],
      };

      async function upload(): Promise<File> {
        const file = new File(['%PDF-1.4'], '261114.pdf', {
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

      it('fills the form from the draft, creates the missing exercise, then saves', async () => {
        await openForm('/workouts/new');

        const file = await upload();
        const importReq = http.expectOne('/api/workouts/import-pdf');
        expect(
          ((importReq.request.body as FormData).get('file') as File).name,
        ).toBe(file.name);
        importReq.flush(DRAFT);
        await page.settle();

        expect(page.query<HTMLInputElement>('#workout-date')?.value).toBe(
          '2026-11-14',
        );
        expect(page.query<HTMLSelectElement>('#part-0-type')?.value).toBe(
          't-amrap',
        );
        expect(page.query<HTMLInputElement>('#p0-RX-duration')?.value).toBe(
          '12:00',
        );
        expect(
          page.query('[data-testid="import-warnings"]')?.textContent,
        ).toContain('The date could not be read from the heading');
        // The summary is the RX column as printed.
        await vi.waitFor(() =>
          expect(summaryParagraphs()).toEqual([
            '<b>AMRAP 12:</b>',
            '200-m run',
            '15 wall balls (20/14 lb)',
          ]),
        );
        const pending = page.query('[data-testid="pending-exercises"]')!;
        expect(pending.textContent).toContain('Wall ball');
        // The women's load opened the item's extra fields.
        expect(
          page.query<HTMLInputElement>('#p0-RX-i1-female-load')?.value,
        ).toBe('6');

        // Saving waits for the exercise.
        await submitAndRefuse();

        await page.select('#pending-modality-0', 'WEIGHTLIFTING');
        await page.click('[data-testid="pending-exercises"] button');
        const create = http.expectOne('/api/exercises');
        expect(create.request.body).toEqual({
          name: 'Wall ball',
          modality: 'WEIGHTLIFTING',
          defaultMeasure: 'REPS',
        });
        create.flush(
          exercise('e-wb', 'Wall ball', { modality: 'WEIGHTLIFTING' }),
        );
        await page.settle();
        expect(page.query('[data-testid="pending-exercises"]')).toBeNull();
        expect(page.query<HTMLSelectElement>('#p0-RX-i1-exercise')?.value).toBe(
          'e-wb',
        );

        const save = await submitAndSend('/api/workouts');
        expect(save.request.body).toMatchObject({
          date: '2026-11-14',
          summary: {
            blocks: [
              { data: { text: '<b>AMRAP 12:</b>' } },
              { data: { text: '200-m run' } },
              { data: { text: '15 wall balls (20/14 lb)' } },
            ],
          },
          parts: [
            {
              workoutTypeId: 't-amrap',
              scoreType: 'ROUNDS_REPS',
              variants: [
                {
                  level: 'RX',
                  durationSeconds: 720,
                  items: [
                    { exerciseId: 'e-run', measure: 'DISTANCE', quantity: 200 },
                    {
                      exerciseId: 'e-wb',
                      quantity: 15,
                      loadKg: 9,
                      loadFemaleKg: 6,
                    },
                  ],
                },
              ],
            },
          ],
        });
        save.flush({ ...HELEN, date: '2026-11-14' });
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
        await idle();
        await page.settle();
        http.expectNone('/api/workouts/w1');

        importReq.flush(DRAFT);
        await page.settle();
        expect(save.disabled).toBe(false);
        expect(page.query<HTMLInputElement>('#workout-date')?.value).toBe(
          '2026-11-14',
        );
      });

      it('shows why a PDF could not be read and leaves the form as it was', async () => {
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
        expect(page.query<HTMLInputElement>('#workout-date')?.value).toBe(
          '2026-11-10',
        );
      });
    });
  });
});
