import { Page } from '@playwright/test';
import { mockTraineeHome } from '../support/data';
import { expect, test } from '../support/fixtures';
import { t } from '../support/i18n';

/**
 * J21: a trainee opens Records from the tab bar, sees Fran with its Rx and scaled leaderboards,
 * opens it, reads what it is, logs a scaled time with a note and finds it on the scaled board
 * and in their own results. Heavy lifts are the other tab, with one list each. From the Mine
 * tab they edit a result (and land back on the tab) and delete another.
 */
test.describe('J21 records', () => {
  /** Wednesday 18 Nov 2026, 19:00 in Sofia. */
  const NOW = '2026-11-18T19:00:00+02:00';

  const entry = (rank: number, name: string, over: object = {}) => ({
    rank,
    resultId: `r-${name}`,
    name,
    photoUrl: null,
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

      await page.goto('/home');
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

  test(
    'edits and deletes my results from the Mine tab',
    { tag: ['@desktop', '@mobile'] },
    async ({ page, api, signInAs }) => {
      await page.clock.setFixedTime(NOW);
      await signInAs('TRAINEE', { traineeProfileId: 'trainee-1' });
      const deadlift = {
        ...mine,
        id: 'mine-2',
        benchmark: {
          ...mine.benchmark,
          id: 'dl',
          kind: 'LIFT',
          name: 'Deadlift',
          scoreType: 'LOAD',
        },
        scaled: false,
        timeSeconds: null,
        loadKg: 120,
        note: null,
        performedOn: '2026-11-12',
      };
      let results: object[] = [mine, deadlift];
      api.on('GET', '/api/benchmark-results/mine', () => ({ body: results }));
      api.on('GET', '/api/benchmarks/dl', {
        body: {
          ...fran,
          id: 'dl',
          kind: 'LIFT',
          name: 'Deadlift',
          scoreType: 'LOAD',
          description: '',
        },
      });
      api.on('GET', '/api/benchmark-results/mine-2', { body: deadlift });
      api.on('PATCH', '/api/benchmark-results/mine-2', (request) => {
        results = [mine, { ...deadlift, ...(request.body as object) }];
        return { body: results[1] };
      });
      api.on('DELETE', '/api/benchmark-results/mine-1', () => {
        results = results.filter((result) => result !== mine);
        return { body: { deleted: true } };
      });

      await page.goto('/records?tab=mine');
      const list = page.getByRole('list', { name: t('records.tabs.mine') });
      await expect(list.getByRole('listitem')).toHaveCount(2);

      // Edit the deadlift: the form goes back to the Mine tab.
      await list
        .getByRole('link', {
          name: t('records.mine.edit', {
            name: 'Deadlift',
            day: '12 Nov 2026',
          }),
        })
        .click();
      await expect(
        page.getByRole('link', { name: t('records.form.backToMine') }),
      ).toBeVisible();
      const load = page.getByLabel(t('records.form.load'));
      await expect(load).toHaveValue('120');
      await load.fill('125.5');
      await page.getByRole('button', { name: t('common.saveChanges') }).click();
      await expect
        .poll(() => api.last('PATCH', '/api/benchmark-results/mine-2')?.body)
        .toMatchObject({ loadKg: 125.5 });
      await expect(page).toHaveURL(/\/records\?tab=mine$/);
      await expect(page.getByTestId('my-result-mine-2')).toContainText(
        '125.5 kg',
      );

      // Delete Fran, after the question.
      let question = '';
      page.once('dialog', (dialog) => {
        question = dialog.message();
        void dialog.accept();
      });
      await list
        .getByRole('button', {
          name: t('records.mine.delete', { name: 'Fran', day: '18 Nov 2026' }),
        })
        .click();
      await expect
        .poll(() => api.calls('DELETE', '/api/benchmark-results/mine-1'))
        .toHaveLength(1);
      expect(question).toBe(
        t('records.mine.deleteConfirm', { name: 'Fran', day: '18 Nov 2026' }),
      );
      await expect(page.getByTestId('my-result-mine-1')).toHaveCount(0);
      await expect(list.getByRole('listitem')).toHaveCount(1);
    },
  );
});
