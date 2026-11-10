import { Page } from '@playwright/test';
import { mockStaffHome } from '../support/data';
import { expect, test } from '../support/fixtures';
import { t } from '../support/i18n';

/**
 * J15: a trainer plans the workout of a day from a lesson-plan PDF. The API reads the PDF (mocked
 * here); the page shows the draft, creates the exercise the catalogue lacks, and saves the
 * workout only when the form is submitted.
 */
test.describe('J15 workouts', () => {
  const mainNav = (page: Page) =>
    page.getByRole('navigation', { name: t('nav.mainLabel') });

  const noItem = {
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
  const noStructure = {
    rounds: null,
    repScheme: null,
    durationSeconds: null,
    timeCapSeconds: null,
    intervalSeconds: null,
    workSeconds: null,
    restSeconds: null,
    notes: null,
  };
  const run = {
    id: 'e-run',
    name: 'Run',
    aliases: [],
    modality: 'MONOSTRUCTURAL',
    defaultMeasure: 'DISTANCE',
    isActive: true,
    description: null,
    videoUrl: null,
  };
  const pullUp = {
    ...run,
    id: 'e-pull',
    name: 'Pull-up',
    modality: 'GYMNASTICS',
  };
  const forTime = {
    id: 't-time',
    name: 'For time',
    description: null,
    code: 'FOR_TIME',
    scoreType: 'TIME',
  };

  test(
    'opens Workouts, fills the form from a PDF, creates the missing exercise and saves',
    { tag: ['@desktop', '@mobile'] },
    async ({ page, api, signInAs }) => {
      await signInAs('TRAINER');
      mockStaffHome(api);

      const draft = {
        sourceCode: '261109',
        date: '2026-11-09',
        title: 'Helen',
        summary: {
          blocks: [
            { type: 'paragraph', data: { text: '<b>3 rounds for time:</b>' } },
            { type: 'paragraph', data: { text: '400-m run' } },
            { type: 'paragraph', data: { text: '12 pull-ups' } },
          ],
        },
        unknownExercises: ['Pull-up'],
        warnings: [],
        parts: [
          {
            title: null,
            typeCode: 'FOR_TIME',
            workoutTypeId: 't-time',
            scoreType: 'TIME',
            variants: [
              {
                ...noStructure,
                level: 'RX',
                rounds: 3,
                items: [
                  {
                    ...noItem,
                    exerciseId: 'e-run',
                    exerciseName: 'Run',
                    measure: 'DISTANCE',
                    quantity: 400,
                  },
                  {
                    ...noItem,
                    exerciseId: null,
                    exerciseName: 'Pull-up',
                    measure: 'REPS',
                    quantity: 12,
                  },
                ],
              },
            ],
          },
        ],
      };
      const saved = {
        id: 'w-1',
        date: '2026-11-09',
        title: 'Helen',
        notes: null,
        summary: {
          blocks: [
            { type: 'paragraph', data: { text: '<b>3 rounds for time:</b>' } },
            { type: 'paragraph', data: { text: '400-m run' } },
            { type: 'paragraph', data: { text: '12 pull-ups' } },
          ],
        },
        summaryText: '3 rounds for time:\n400-m run\n12 pull-ups',
        parts: [
          {
            id: 'p-1',
            title: null,
            workoutTypeId: 't-time',
            workoutType: { id: 't-time', name: 'For time', code: 'FOR_TIME' },
            scoreType: 'TIME',
            variants: [
              {
                ...noStructure,
                level: 'RX',
                rounds: 3,
                items: [
                  {
                    ...noItem,
                    exerciseId: 'e-run',
                    exercise: { id: 'e-run', name: 'Run' },
                    measure: 'DISTANCE',
                    quantity: 400,
                  },
                  {
                    ...noItem,
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

      api.on('GET', '/api/workouts', () => ({
        body: api.calls('POST', '/api/workouts').length ? [saved] : [],
      }));
      api.on('GET', '/api/exercises', { body: [run] });
      api.on('GET', '/api/workout-types', { body: [forTime] });
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
        page.getByLabel(t('workouts.form.structure.rounds'), { exact: true }),
      ).toHaveValue('3');

      // The RX column as printed is the summary, in its editor.
      await expect(page.getByTestId('workout-summary')).toContainText(
        '3 rounds for time:',
      );
      await expect(page.getByTestId('workout-summary')).toContainText(
        '12 pull-ups',
      );

      // The PDF named a movement the catalogue lacks: it is created from here.
      const pending = page.getByTestId('pending-exercises');
      await expect(pending).toContainText('Pull-up');
      await pending
        .getByRole('button', {
          name: t('workouts.import.createExercise', { name: 'Pull-up' }),
        })
        .click();
      await expect(pending).toBeHidden();
      expect(api.last('POST', '/api/exercises')?.body).toEqual({
        name: 'Pull-up',
        modality: 'GYMNASTICS',
        defaultMeasure: 'REPS',
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
      expect(api.last('POST', '/api/workouts')?.body).toMatchObject({
        date: '2026-11-09',
        title: 'Helen',
        summary: {
          blocks: [
            { data: { text: '<b>3 rounds for time:</b>' } },
            { data: { text: '400-m run' } },
            { data: { text: '12 pull-ups' } },
          ],
        },
        parts: [
          {
            workoutTypeId: 't-time',
            scoreType: 'TIME',
            variants: [
              {
                level: 'RX',
                rounds: 3,
                items: [
                  { exerciseId: 'e-run', measure: 'DISTANCE', quantity: 400 },
                  { exerciseId: 'e-pull', measure: 'REPS', quantity: 12 },
                ],
              },
            ],
          },
        ],
      });
      await expect(page.getByTestId('day-2026-11-09')).toContainText(
        '12 pull-ups',
      );
    },
  );

  test(
    'the sidebar leads to Workouts and its tabs to exercises and types',
    { tag: '@desktop' },
    async ({ page, api, signInAs }) => {
      await signInAs('TRAINER');
      mockStaffHome(api);
      api.on('GET', '/api/workouts', { body: [] });
      api.on('GET', '/api/exercises', { body: [run, pullUp] });
      api.on('GET', '/api/workout-types', { body: [forTime] });
      const sections = page.getByRole('navigation', {
        name: t('workouts.nav.label'),
      });

      await page.goto('/home');
      await mainNav(page)
        .getByRole('link', { name: t('nav.workouts') })
        .click();
      await expect(page).toHaveURL(/\/workouts$/);

      await sections
        .getByRole('link', { name: t('workouts.nav.exercises') })
        .click();
      await expect(page).toHaveURL(/\/workouts\/exercises$/);
      await expect(
        page.getByRole('link', { name: 'Pull-up', exact: true }),
      ).toBeVisible();

      await sections
        .getByRole('link', { name: t('workouts.nav.types') })
        .click();
      await expect(page).toHaveURL(/\/workouts\/types$/);
      await expect(
        page.getByRole('link', { name: 'For time', exact: true }),
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
