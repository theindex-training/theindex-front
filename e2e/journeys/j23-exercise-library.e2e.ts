import { Page } from '@playwright/test';
import { mockTraineeHome } from '../support/data';
import { expect, test } from '../support/fixtures';
import { t } from '../support/i18n';

/**
 * J23: a trainee opens Exercises from the navigation (right after Schedule), finds a movement by
 * one of its other names and opens it: its other names, the video played in the page and the
 * description. On phones Exercises is a tab and Stats moves to the Account sheet.
 */
test.describe('J23 exercise library', () => {
  const exercise = (id: string, name: string, over: object = {}) => ({
    id,
    name,
    aliases: [] as string[],
    isActive: true,
    description: null as string | null,
    videoUrl: null as string | null,
    createdAt: '2026-11-10T10:00:00.000Z',
    updatedAt: '2026-11-10T10:00:00.000Z',
    ...over,
  });
  const DESCRIPTION = 'A front squat\nstraight into a push press.';
  const THRUSTER = exercise('e-thr', 'Thruster', {
    aliases: ['Squat to press'],
    description: DESCRIPTION,
    videoUrl: 'https://www.youtube.com/watch?v=L219ltL15zk',
  });
  const RUN = exercise('e-run', 'Run');

  const mainNav = (page: Page) =>
    page.getByRole('navigation', { name: t('nav.mainLabel') });

  test(
    'finds an exercise and watches its video',
    { tag: ['@desktop', '@mobile'] },
    async ({ page, api, signInAs }) => {
      await signInAs('TRAINEE', { traineeProfileId: 'trainee-1' });
      mockTraineeHome(api);
      api.on('GET', '/api/exercises', { body: [RUN, THRUSTER] });
      api.on('GET', '/api/exercises/e-thr', { body: THRUSTER });

      await page.goto('/my-profile');
      const links = mainNav(page).getByRole('link');
      await expect(links.nth(1)).toHaveAccessibleName(t('nav.schedule'));
      await expect(links.nth(2)).toHaveAccessibleName(t('nav.exercises'));
      await links.nth(2).click();

      await expect(page).toHaveURL(/\/exercises$/);
      await expect
        .poll(() => api.last('GET', '/api/exercises')?.query)
        .toEqual({ active: 'true' });
      await expect(
        page.getByRole('heading', {
          level: 1,
          name: t('exerciseLibrary.list.title'),
        }),
      ).toBeVisible();
      // No status filter for trainees.
      await expect(
        page.getByRole('group', { name: t('common.status') }),
      ).toHaveCount(0);

      await page
        .getByRole('searchbox', { name: t('exerciseLibrary.list.search') })
        .fill('squat to');
      await expect(
        page.getByRole('link', { name: 'Run', exact: true }),
      ).toHaveCount(0);
      // The phone row's name also has the other names; the video link starts with "Watch".
      await page.getByRole('link', { name: /^Thruster/ }).click();

      await expect(page).toHaveURL(/\/exercises\/e-thr$/);
      await expect(
        page.getByRole('heading', { level: 1, name: 'Thruster' }),
      ).toBeVisible();
      await expect(page.getByTestId('exercise-aliases')).toHaveText(
        'Squat to press',
      );
      await expect(page.getByTestId('exercise-description')).toHaveText(
        DESCRIPTION,
      );
      await page.getByTestId('exercise-video-play').click();
      await expect(
        page.getByTitle(t('traineeTraining.videoTitle', { name: 'Thruster' })),
      ).toHaveAttribute(
        'src',
        'https://www.youtube-nocookie.com/embed/L219ltL15zk?autoplay=1&rel=0',
      );

      await page
        .getByRole('link', { name: t('exerciseLibrary.detail.back') })
        .click();
      await expect(page).toHaveURL(/\/exercises$/);
    },
  );

  test(
    'on a phone, Exercises is a tab and Stats is in the Account sheet',
    { tag: '@mobile' },
    async ({ page, api, signInAs }) => {
      await signInAs('TRAINEE', { traineeProfileId: 'trainee-1' });
      mockTraineeHome(api);

      await page.goto('/my-profile');
      const tabs = mainNav(page).getByRole('link');
      await expect(tabs).toHaveCount(4);
      await expect(tabs.nth(2)).toHaveAccessibleName(t('nav.exercises'));
      await expect(
        mainNav(page).getByRole('link', { name: t('nav.stats') }),
      ).toHaveCount(0);

      await mainNav(page)
        .getByRole('button', { name: t('nav.account') })
        .click();
      await expect(
        page
          .getByRole('dialog', { name: t('nav.account') })
          .getByRole('navigation', { name: t('nav.morePages') })
          .getByRole('link'),
      ).toHaveAccessibleName(t('nav.stats'));
    },
  );
});
