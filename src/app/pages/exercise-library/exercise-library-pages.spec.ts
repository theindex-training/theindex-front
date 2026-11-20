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
import { ExerciseDetailComponent } from './exercise-detail.component';
import { ExerciseLibraryComponent } from './exercise-library.component';

/** The trainees' exercise library: the list of active exercises and an exercise's page. */

const texts = en.exerciseLibrary;

const exercise = (id: string, name: string, over: object = {}) => ({
  id,
  name,
  aliases: [] as string[],
  isActive: true,
  description: null as string | null,
  videoUrl: null as string | null,
  ...over,
});
const PULL_UP = exercise('e-pull', 'Pull-up', {
  aliases: ['Kipping pull-up', 'Chin-over-bar'],
  description: 'Hang from the bar.\nPull until the chin is over it.',
  videoUrl: 'https://www.youtube.com/watch?v=lzRo-4pq_AY',
});
const RUN = exercise('e-run', 'Run');
const EXERCISES = [PULL_UP, RUN];

describe('exercise library pages', () => {
  let http: HttpTestingController;
  let router: Router;
  let harness: RouterTestingHarness;
  let page: PageDriver;

  beforeEach(async () => {
    localStorage.clear();
    signInAs('TRAINEE', { traineeProfileId: 'trainee-1' });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'exercises/:id', component: ExerciseDetailComponent },
          { path: 'exercises', component: ExerciseLibraryComponent },
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
  });

  async function open(url: string): Promise<void> {
    await harness.navigateByUrl(url);
    page = driver(
      () => harness.routeNativeElement!,
      () => harness.fixture.whenStable(),
    );
    await page.settle();
  }

  describe('the list', () => {
    const names = () =>
      page.queryAll('tbody .cell-link').map((a) => a.textContent.trim());

    async function openList(answer: object[] = EXERCISES): Promise<void> {
      await open('/exercises');
      const req = http.expectOne((r) => r.url === '/api/exercises');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('active')).toBe('true');
      req.flush(answer);
      await page.settle();
    }

    it('asks for the active exercises and lists them without a status or a status filter', async () => {
      await openList();

      expect(names()).toEqual(['Pull-up', 'Run']);
      const headers = page
        .queryAll('thead th')
        .map((th) => th.textContent.trim());
      expect(headers).toEqual(['Name', 'Other names', 'Video', 'Open']);
      expect(page.query('app-status-dot')).toBeNull();
      expect(page.query('input[type="radio"]')).toBeNull();
      expect(page.query('[data-testid="list-count"]')?.textContent).toContain(
        '2 of 2 exercises',
      );

      const row = page.queryAll('tbody tr')[0];
      expect(row.textContent).toContain('Kipping pull-up, Chin-over-bar');
      const video = row.querySelector<HTMLAnchorElement>('a[target="_blank"]');
      expect(video?.href).toBe(PULL_UP.videoUrl);
      expect(video?.getAttribute('aria-label')).toBe(
        'Watch the video of Pull-up',
      );
    });

    it('links every row, in the table and the phone list, to the exercise in the library', async () => {
      await openList();

      expect(
        page
          .queryAll<HTMLAnchorElement>('tbody .cell-link')
          .map((a) => a.getAttribute('href')),
      ).toEqual(['/exercises/e-pull', '/exercises/e-run']);
      expect(
        page
          .queryAll<HTMLAnchorElement>('.list-card a')
          .map((a) => a.getAttribute('href')),
      ).toEqual(['/exercises/e-pull', '/exercises/e-run']);
      expect(page.query('.list-card app-chip')).toBeNull();
    });

    it('searches by name or other name, and clears the search', async () => {
      await openList();

      await page.type('input[type="search"]', 'CHIN');
      expect(names()).toEqual(['Pull-up']);
      expect(page.query('[data-testid="list-count"]')?.textContent).toContain(
        '1 of 2 exercises',
      );

      await page.type('input[type="search"]', 'burpee');
      expect(page.text()).toContain(texts.list.noMatchesMessage);
      page
        .queryAll<HTMLButtonElement>('button')
        .find((b) => b.textContent.trim() === en.common.clearSearch)!
        .click();
      await page.settle();
      expect(names()).toEqual(['Pull-up', 'Run']);
    });

    it('says when there are no exercises, with nothing to create', async () => {
      await openList([]);

      expect(page.text()).toContain(texts.list.emptyMessage);
      expect(page.query('a[href="/workouts/exercises/new"]')).toBeNull();
      expect(page.query('[data-testid="list-count"]')).toBeNull();
    });

    it("shows the API's error, and tries again", async () => {
      await open('/exercises');
      const failure = apiError('Database is down', 500);
      http
        .expectOne((r) => r.url === '/api/exercises')
        .flush(failure.body, failure.options);
      await page.settle();
      expect(page.text()).toContain('Database is down');

      page
        .queryAll<HTMLButtonElement>('button')
        .find((b) => b.textContent.trim() === en.common.tryAgain)!
        .click();
      await page.settle();
      http.expectOne((r) => r.url === '/api/exercises').flush(EXERCISES);
      await page.settle();
      expect(names()).toEqual(['Pull-up', 'Run']);
    });
  });

  describe("an exercise's page", () => {
    async function openDetail(id: string, answer: object): Promise<void> {
      await open(`/exercises/${id}`);
      const req = http.expectOne(`/api/exercises/${id}`);
      expect(req.request.method).toBe('GET');
      req.flush(answer);
      await page.settle();
    }

    it('shows the name, other names, the video and the description with its line breaks', async () => {
      await openDetail('e-pull', PULL_UP);

      expect(page.query('h1')?.textContent.trim()).toBe('Pull-up');
      expect(
        page.query('[data-testid="exercise-aliases"]')?.textContent.trim(),
      ).toBe('Kipping pull-up, Chin-over-bar');
      expect(
        page.query('[data-testid="exercise-description"]')?.textContent,
      ).toBe(PULL_UP.description);
      expect(page.text()).not.toContain(texts.detail.noDescription);

      // The video plays in the page.
      expect(page.query('iframe')).toBeNull();
      page
        .query<HTMLButtonElement>('[data-testid="exercise-video-play"]')!
        .click();
      await page.settle();
      expect(page.query('iframe')?.getAttribute('src')).toBe(
        'https://www.youtube-nocookie.com/embed/lzRo-4pq_AY?autoplay=1&rel=0',
      );

      const back = page.query<HTMLAnchorElement>('a[href="/exercises"]');
      expect(back?.textContent).toContain(texts.detail.back);
    });

    it('says when there is no description, and shows no video without one', async () => {
      await openDetail('e-run', RUN);

      expect(page.query('h1')?.textContent.trim()).toBe('Run');
      expect(
        page.query('[data-testid="exercise-aliases"]')?.textContent.trim(),
      ).toBe(en.common.dash);
      expect(page.query('[data-testid="exercise-description"]')).toBeNull();
      expect(page.text()).toContain(texts.detail.noDescription);
      expect(page.query('app-exercise-video')).toBeNull();
    });

    it("shows the API's 404 for an exercise that isn't in the library", async () => {
      await open('/exercises/e-old');
      const missing = apiError('Exercise not found', 404);
      http
        .expectOne('/api/exercises/e-old')
        .flush(missing.body, missing.options);
      await page.settle();

      expect(page.query('[role="alert"]')?.textContent).toContain(
        'Exercise not found',
      );
      expect(page.query('h1')?.textContent.trim()).toBe(texts.detail.title);
    });

    it('loads the other exercise when only the id changes', async () => {
      await openDetail('e-pull', PULL_UP);

      await router.navigateByUrl('/exercises/e-run');
      await page.settle();
      http.expectOne('/api/exercises/e-run').flush(RUN);
      await page.settle();
      expect(page.query('h1')?.textContent.trim()).toBe('Run');
    });
  });
});
