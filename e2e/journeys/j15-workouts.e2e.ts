import { readFile } from 'fs/promises';
import { Download, Page } from '@playwright/test';
import { mockStaffHome } from '../support/data';
import { expect, test } from '../support/fixtures';
import { t } from '../support/i18n';

/**
 * J15: a trainer plans a workout of the day from a lesson-plan PDF. The API reads the PDF (mocked
 * here) and keeps it; the page shows the draft (summary and exercises), creates the exercise the
 * catalogue lacks, and saves the workout, with its source PDF, only when the form is submitted.
 * Editing the workout later, the trainer opens that PDF again.
 */
test.describe('J15 workouts', () => {
  const mainNav = (page: Page) =>
    page.getByRole('navigation', { name: t('nav.mainLabel') });

  const run = {
    id: 'e-run',
    name: 'Run',
    aliases: [],
    isActive: true,
    description: null,
    videoUrl: null,
  };
  const pullUp = {
    ...run,
    id: 'e-pull',
    name: 'Pull-up',
    videoUrl: 'https://www.youtube.com/watch?v=lzRo-4pq_AY',
  };
  const summary = '3 rounds for time:\n400-m run\n12 pull-ups';
  const sourcePdf = {
    id: 'pdf-1',
    originalFilename: '261109.pdf',
    sizeBytes: 300_000,
    uploadedAt: '2026-11-08T18:00:00.000Z',
  };

  test(
    'opens a day, fills the form from a PDF, creates the missing exercise and saves',
    { tag: ['@desktop', '@mobile'] },
    async ({ page, api, signInAs }) => {
      await signInAs('TRAINER');
      mockStaffHome(api);

      const draft = {
        sourceCode: '261109',
        date: '2026-11-09',
        title: 'Helen',
        summary,
        exercises: [
          { name: 'Run', exerciseId: 'e-run', exerciseName: 'Run' },
          { name: 'Pull-up', exerciseId: null, exerciseName: null },
        ],
        sourcePdf,
        warnings: [],
      };
      const saved = {
        id: 'w-1',
        date: '2026-11-09',
        title: 'Helen',
        summary,
        exercises: [
          { id: 'e-run', name: 'Run', videoUrl: null, isActive: true },
          {
            id: 'e-pull',
            name: 'Pull-up',
            videoUrl: pullUp.videoUrl,
            isActive: true,
          },
        ],
        sourcePdf,
      };

      api.on('GET', '/api/workouts', () => ({
        body: api.calls('POST', '/api/workouts').length ? [saved] : [],
      }));
      api.on('GET', '/api/exercises', { body: [run] });
      api.on('POST', '/api/workouts/import-pdf', { body: draft });
      api.on('POST', '/api/exercises', { status: 201, body: pullUp });
      api.on('POST', '/api/workouts', { status: 201, body: saved });

      // The week of the plan; an empty day offers to add its workout.
      await page.goto('/workouts?week=2026-11-09');
      const monday = page.getByTestId('day-2026-11-09');
      await expect(monday).toBeVisible();
      await monday.getByRole('link').click();
      await expect(page).toHaveURL(/\/workouts\/new\?date=2026-11-09$/);

      await page.getByTestId('workout-pdf').setInputFiles({
        name: '261109.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 lesson plan'),
      });
      await expect(
        page.getByText(t('workouts.import.done', { file: '261109.pdf' })),
      ).toBeVisible();
      await expect(
        page.getByLabel(t('workouts.form.title'), { exact: false }).first(),
      ).toHaveValue('Helen');
      await expect(
        page.getByLabel(t('workouts.form.summary'), { exact: true }),
      ).toHaveValue(summary);
      // The API kept the PDF; it goes with the workout.
      const source = page.getByTestId('workout-source-pdf');
      await expect(source).toContainText('261109.pdf');
      await expect(source).toContainText(t('workouts.import.sourceUnsaved'));

      // The PDF named a movement the catalogue lacks: it is created from here.
      const exercises = page.getByTestId('workout-exercises');
      await exercises
        .getByRole('button', {
          name: t('workouts.form.exercises.create', { name: 'Pull-up' }),
        })
        .click();
      await expect(
        exercises.getByRole('link', {
          name: t('workouts.exercises.list.watchVideo', { name: 'Pull-up' }),
        }),
      ).toBeVisible();
      expect(api.last('POST', '/api/exercises')?.body).toEqual({
        name: 'Pull-up',
      });
      // Nothing was saved by reading the PDF.
      expect(api.calls('POST', '/api/workouts')).toHaveLength(0);

      await page
        .getByRole('button', { name: t('workouts.form.create') })
        .click();
      await expect(page).toHaveURL(/\/workouts\?week=2026-11-09$/);
      await expect
        .poll(() => api.calls('POST', '/api/workouts').length)
        .toBe(1);
      expect(api.last('POST', '/api/workouts')?.body).toEqual({
        date: '2026-11-09',
        title: 'Helen',
        summary,
        exerciseIds: ['e-run', 'e-pull'],
        sourcePdfId: 'pdf-1',
      });

      // The week shows the summary and the exercises, the video linked.
      const day = page.getByTestId('day-2026-11-09');
      await expect(day.getByTestId('workout-summary-text')).toHaveText(summary);
      await expect(
        day.getByRole('link', {
          name: t('workouts.exercises.list.watchVideo', { name: 'Pull-up' }),
        }),
      ).toHaveAttribute('href', pullUp.videoUrl);
      // The day can take another workout, and the Workouts tab stays current with `?week=`.
      await expect(
        day.getByRole('link', {
          name: t('workouts.list.addAnotherFor', {
            day: 'Monday, 9 November',
          }),
        }),
      ).toHaveAttribute('href', '/workouts/new?date=2026-11-09');
      await expect(
        page
          .getByRole('navigation', { name: t('workouts.nav.label') })
          .getByRole('link', { name: t('workouts.nav.workouts') }),
      ).toHaveAttribute('aria-current', 'page');
    },
  );

  test(
    'editing a workout, the trainer opens the PDF it came from in a new tab',
    { tag: '@desktop' },
    async ({ page, api, signInAs }) => {
      await signInAs('TRAINER');
      api.on('GET', '/api/exercises', { body: [run] });
      api.on('GET', '/api/workouts/w-1', {
        body: {
          id: 'w-1',
          date: '2026-11-09',
          title: 'Helen',
          summary,
          exercises: [],
          sourcePdf,
        },
      });
      // The file is a PDF, not JSON: answered here, at the same network boundary.
      const pdfBytes = Buffer.from('%PDF-1.4\n%%EOF\n');
      const pdfRequests: (string | undefined)[] = [];
      await page.route('**/api/workouts/source-pdfs/pdf-1', (route) => {
        pdfRequests.push(route.request().headers()['authorization']);
        return route.fulfill({
          status: 200,
          contentType: 'application/pdf',
          body: pdfBytes,
        });
      });

      await page.goto('/workouts/w-1/edit');
      const source = page.getByTestId('workout-source-pdf');
      await expect(source).toContainText('261109.pdf');
      await expect(source).toContainText(t('workouts.import.sourceSaved'));

      // The PDF is shown in a new tab. Headless Chromium has no PDF viewer and saves it as a
      // download instead, so the test reads what the tab received.
      const received = new Promise<Download>((resolve) =>
        page.context().on('page', (tab) => tab.on('download', resolve)),
      );
      await source
        .getByRole('button', { name: t('workouts.import.open') })
        .click();
      const download = await received;

      expect(await readFile(await download.path())).toEqual(pdfBytes);
      // Fetched with the trainer's token: the file is not public.
      expect(pdfRequests).toEqual([expect.stringMatching(/^Bearer /)]);
      await expect(page.getByRole('alert')).toHaveCount(0);
    },
  );

  test(
    'the sidebar leads to Workouts and its tab to the exercises',
    { tag: '@desktop' },
    async ({ page, api, signInAs }) => {
      await signInAs('TRAINER');
      mockStaffHome(api);
      api.on('GET', '/api/workouts', { body: [] });
      api.on('GET', '/api/exercises', { body: [run, pullUp] });
      const sections = page.getByRole('navigation', {
        name: t('workouts.nav.label'),
      });

      await page.goto('/home');
      await mainNav(page)
        .getByRole('link', { name: t('nav.workouts') })
        .click();
      await expect(page).toHaveURL(/\/workouts$/);
      await expect(sections.getByRole('link')).toHaveCount(2);

      await sections
        .getByRole('link', { name: t('workouts.nav.exercises') })
        .click();
      await expect(page).toHaveURL(/\/workouts\/exercises$/);
      await expect(
        page.getByRole('link', { name: 'Pull-up', exact: true }),
      ).toBeVisible();
    },
  );

  test(
    'a trainee has no way into Workouts',
    { tag: '@desktop' },
    async ({ page, api, signInAs }) => {
      await signInAs('TRAINEE', { traineeProfileId: 'trainee-1' });
      api.on('GET', /\/api\//, { body: [] });

      await page.goto('/workouts');

      await expect(page).not.toHaveURL(/\/workouts/);
      expect(api.calls('GET', '/api/workouts')).toHaveLength(0);
    },
  );
});
