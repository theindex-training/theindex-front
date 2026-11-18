import { Page } from '@playwright/test';
import { mockTraineeHome } from '../support/data';
import { expect, test } from '../support/fixtures';
import { t } from '../support/i18n';

/**
 * J21: a trainee opens Records from the tab bar, sees Fran with its Rx and scaled leaderboards,
 * opens it, reads what it is, logs a scaled time with a note and finds it on the scaled board
 * and in their own results. Heavy lifts are the other tab, with one list each.
 */
test.describe('J21 records', () => {
  /** Wednesday 18 Nov 2026, 19:00 in Sofia. */
  const NOW = '2026-11-18T19:00:00+02:00';

  const entry = (rank: number, name: string, over: object = {}) => ({
    rank,
    resultId: `r-${name}`,
    name,
    personType: 'TRAINEE',
    isMe: false,
    performedOn: '2026-11-10',
    timeSeconds: null,
    capped: false,
    rounds: null,
    reps: null,
    loadKg: null,
    note: null,
    ...over,
  });
  const franRx = [entry(1, 'Maria', { timeSeconds: 248 })];
  const franOverview = {
    id: 'fran',
    kind: 'BENCHMARK',
    name: 'Fran',
    scoreType: 'TIME',
    timeCapSeconds: null,
    exercises: [
      { id: 'e-thr', name: 'Thruster' },
      { id: 'e-pull', name: 'Kipping Pull-up' },
    ],
    rx: franRx,
    rxCount: 1,
    scaled: [],
    scaledCount: 0,
    myRx: null,
    myScaled: null,
  };
  const fran = {
    id: 'fran',
    kind: 'BENCHMARK',
    name: 'Fran',
    scoreType: 'TIME',
    timeCapSeconds: null,
    description: 'For time:\n21-15-9 reps of:\nThrusters (43/29 kg)\nPull-ups',
    exercises: [
      {
        id: 'e-thr',
        name: 'Thruster',
        description: 'A front squat straight into a push press.',
        videoUrl: 'https://www.youtube.com/watch?v=L219ltL15zk',
        isActive: true,
      },
      {
        id: 'e-pull',
        name: 'Kipping Pull-up',
        description: null,
        videoUrl: null,
        isActive: true,
      },
    ],
    isActive: true,
    resultCount: 1,
  };
  const mine = {
    id: 'mine-1',
    benchmark: {
      id: 'fran',
      kind: 'BENCHMARK',
      name: 'Fran',
      scoreType: 'TIME',
      timeCapSeconds: null,
      isActive: true,
    },
    performedOn: '2026-11-18',
    scaled: true,
    timeSeconds: 412,
    capped: false,
    rounds: null,
    reps: null,
    loadKg: null,
    note: '30 kg thrusters',
    personalBest: true,
    createdAt: '2026-11-18T17:00:00Z',
    updatedAt: '2026-11-18T17:00:00Z',
  };

  const tabs = (page: Page) =>
    page.getByRole('group', { name: t('records.tabs.label') });

  test(
    'logs a scaled Fran and finds it on the leaderboard',
    { tag: ['@desktop', '@mobile'] },
    async ({ page, api, signInAs }) => {
      await page.clock.setFixedTime(NOW);
      await signInAs('TRAINEE', { traineeProfileId: 'trainee-1' });
      mockTraineeHome(api);
      api.on('GET', '/api/leaderboards', (request) => ({
        body:
          request.query['kind'] === 'LIFT'
            ? [
                {
                  ...franOverview,
                  id: 'dl',
                  kind: 'LIFT',
                  name: 'Deadlift',
                  scoreType: 'LOAD',
                  exercises: [{ id: 'e-dl', name: 'Deadlift' }],
                  rx: [entry(1, 'Maria', { loadKg: 120.5 })],
                },
              ]
            : [franOverview],
      }));
      api.on('GET', '/api/benchmarks/fran', { body: fran });
      api.on('GET', '/api/benchmarks/fran/leaderboard', {
        body: { rx: franRx, scaled: [] },
      });
      api.on('GET', '/api/benchmark-results/mine', { body: [] });

      await page.goto('/my-profile');
      await page
        .getByRole('navigation', { name: t('nav.mainLabel') })
        .getByRole('link', { name: t('nav.records') })
        .click();
      await expect(page).toHaveURL(/\/records$/);

      const card = page.getByTestId('benchmark-card-fran');
      await expect(card).toContainText('Thruster · Kipping Pull-up');
      await expect(
        card.getByRole('list', {
          name: t('records.board.label', {
            list: t('records.rx'),
            name: 'Fran',
          }),
        }),
      ).toContainText('Maria');
      await card.getByRole('link', { name: 'Fran' }).click();

      // What Fran is, for beginners.
      await expect(page).toHaveURL(/\/records\/fran$/);
      await expect(
        page.getByRole('heading', { level: 1, name: 'Fran' }),
      ).toBeVisible();
      await expect(page.getByTestId('benchmark-description')).toHaveText(
        fran.description,
      );
      await expect(page.getByTestId('benchmark-exercise-e-thr')).toContainText(
        'A front squat straight into a push press.',
      );
      await expect(page.getByTestId('no-my-results')).toBeVisible();

      await page.getByTestId('log-result').click();
      await expect(page).toHaveURL(/\/records\/fran\/log$/);
      await page.getByLabel(t('records.form.minutes')).fill('6');
      await page.getByLabel(t('records.form.seconds')).fill('52');
      await page.getByLabel(t('records.form.scaled')).check();
      await expect(
        page.getByText(t('records.form.noteHintScaled', { max: 500 })),
      ).toBeVisible();
      await page.getByLabel(t('records.form.note')).fill('30 kg thrusters');

      // From now on the API answers with the result logged.
      api.on('POST', '/api/benchmark-results', { status: 201, body: mine });
      api.on('GET', '/api/benchmarks/fran/leaderboard', {
        body: {
          rx: franRx,
          scaled: [
            entry(1, 'Ivan Petrov', {
              isMe: true,
              timeSeconds: 412,
              performedOn: '2026-11-18',
              note: '30 kg thrusters',
            }),
          ],
        },
      });
      api.on('GET', '/api/benchmark-results/mine', { body: [mine] });
      await page
        .getByRole('button', { name: t('records.form.submit') })
        .click();
      await expect
        .poll(() => api.last('POST', '/api/benchmark-results')?.body)
        .toEqual({
          benchmarkId: 'fran',
          performedOn: '2026-11-18',
          scaled: true,
          timeSeconds: 412,
          capped: false,
          rounds: null,
          reps: null,
          loadKg: null,
          note: '30 kg thrusters',
        });

      await expect(page).toHaveURL(/\/records\/fran$/);
      const scaled = page.getByTestId('board-scaled');
      await expect(scaled).toContainText('Ivan Petrov');
      await expect(scaled).toContainText('6:52');
      await expect(scaled).toContainText('30 kg thrusters');
      await expect(page.getByTestId('my-result-mine-1')).toContainText(
        t('records.personalBest'),
      );

      // Heavy lifts: one list each, no scaled one.
      await page
        .getByRole('link', { name: t('records.backToRecords') })
        .click();
      await tabs(page).getByText(t('records.tabs.lifts')).click();
      await expect(
        tabs(page).getByRole('radio', { name: t('records.tabs.lifts') }),
      ).toBeChecked();
      await expect(page).toHaveURL(/\/records\?tab=lifts$/);
      const lift = page.getByTestId('benchmark-card-dl');
      await expect(lift).toContainText('120.5 kg');
      await expect(lift.getByRole('list')).toHaveCount(1);
    },
  );
});
