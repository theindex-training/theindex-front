import { Page } from '@playwright/test';
import { mockStaffHome } from '../support/data';
import { expect, test } from '../support/fixtures';
import { t } from '../support/i18n';

/**
 * J15: a trainer plans a workout of the day from a lesson-plan PDF. The API reads the PDF (mocked
 * here); the page shows the draft (summary and exercises), creates the exercise the catalogue
 * lacks, and saves the workout only when the form is submitted.
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
      });

      // The week shows the summary and the exercises, the video linked.
      const day = page.getByTestId('day-2026-11-09');
      await expect(day.getByTestId('workout-summary-text')).toHaveText(summary);
      await expect(
        day.getByRole('link', {
          name: t('workouts.exercises.list.watchVideo', { name: 'Pull-up' }),
        }),
      ).toHaveAttribute('href', pullUp.videoUrl);
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
