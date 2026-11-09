import { Page } from '@playwright/test';
import { mockStaffHome, renewalRow } from '../support/data';
import { expect, test } from '../support/fixtures';
import { t } from '../support/i18n';

const RENEWALS = {
  punch: {
    exhausted: [
      renewalRow('p1', 'Ivan Petrov', {
        unpaidTrainings: 3,
        lastTrainedAt: '2026-11-06T16:00:00.000Z',
      }),
    ],
    active: [
      renewalRow('p2', 'Ana Dimova', {
        activeSubscriptions: 1,
        remainingCredits: 1,
      }),
      renewalRow('p3', 'Boris Stoev', {
        activeSubscriptions: 2,
        remainingCredits: 32,
      }),
    ],
  },
  time: {
    exhausted: [
      renewalRow('t1', 'Georgi Ivanov', {
        planTitle: 'Month',
        endsAt: '2026-10-31T10:00:00.000Z',
        daysSinceEnd: 9,
        unpaidTrainings: 2,
      }),
    ],
    active: [
      renewalRow('t2', 'Elena Toneva', {
        planTitle: 'Month',
        activeSubscriptions: 1,
        endsAt: '2026-11-19T10:00:00.000Z',
        daysLeft: 10,
      }),
    ],
  },
};

/** TEST_PLAN.md J14: the renewals page, reached from the menu under Dashboard. */
test.describe('J14 renewals', () => {
  const mainNav = (page: Page) =>
    page.getByRole('navigation', { name: t('nav.mainLabel') });
  const table = (page: Page, titleKey: string) =>
    page.getByRole('region', {
      name: t('renewals.tableLabel', { title: t(titleKey) }),
    });
  const tab = (page: Page, key: string) =>
    page
      .getByRole('group', { name: t('renewals.typeLabel') })
      .getByText(t(key), { exact: true });

  test(
    'a trainer opens Renewals under Dashboard and reads both tabs',
    { tag: '@desktop' },
    async ({ page, api, signInAs }) => {
      await signInAs('TRAINER');
      mockStaffHome(api);
      api.on('GET', '/api/subscription-renewals', { body: RENEWALS });

      await page.goto('/home');
      const links = mainNav(page).getByRole('link');
      await expect(links.nth(1)).toHaveAccessibleName(t('nav.renewals'));
      await links.nth(1).click();
      await expect(page).toHaveURL(/\/renewals$/);
      await expect(
        page.getByRole('heading', { level: 1, name: t('nav.renewals') }),
      ).toBeVisible();

      // Punch first: used up, then active with the fewest trainings left on top.
      const usedUp = table(page, 'renewals.punch.exhaustedTitle');
      await expect(usedUp.getByRole('row').nth(1)).toContainText('Ivan Petrov');
      await expect(usedUp.getByRole('row').nth(1)).toContainText('3');
      const activePunch = table(page, 'renewals.punch.activeTitle');
      await expect(activePunch.getByRole('row')).toHaveCount(3);
      await expect(activePunch.getByRole('row').nth(1)).toContainText(
        'Ana Dimova',
      );
      await expect(activePunch.getByRole('row').nth(2)).toContainText(
        t('renewals.values.subscriptions', { count: 2 }),
      );

      await tab(page, 'enums.planType.TIME').click();
      await expect(
        page.getByRole('radio', { name: t('enums.planType.TIME') }),
      ).toBeChecked();
      const expired = table(page, 'renewals.time.exhaustedTitle');
      await expect(expired.getByRole('row').nth(1)).toContainText(
        t('renewals.values.daysAgo', { count: 9 }),
      );
      await expect(
        table(page, 'renewals.time.activeTitle').getByRole('row').nth(1),
      ).toContainText(t('renewals.values.daysLeft', { count: 10 }));
      // Switching tabs is local: the overview was loaded once.
      expect(api.calls('GET', '/api/subscription-renewals')).toHaveLength(1);

      // Each name opens the trainee's details page.
      await expect(
        expired.getByRole('link', { name: 'Georgi Ivanov' }),
      ).toHaveAttribute('href', '/trainees/t1');
    },
  );

  test(
    'on a phone, Renewals is the first page in the More sheet',
    { tag: '@mobile' },
    async ({ page, api, signInAs }) => {
      await signInAs('ADMIN');
      mockStaffHome(api);
      api.on('GET', '/api/subscription-renewals', { body: RENEWALS });

      await page.goto('/home');
      await mainNav(page)
        .getByRole('button', { name: t('nav.more') })
        .click();
      const sheetLinks = page
        .getByRole('dialog', { name: t('nav.more') })
        .getByRole('navigation', { name: t('nav.morePages') })
        .getByRole('link');
      await expect(sheetLinks.first()).toHaveAccessibleName(t('nav.renewals'));
      await sheetLinks.first().click();
      await expect(page).toHaveURL(/\/renewals$/);

      const usedUp = page.getByRole('list', {
        name: t('renewals.punch.exhaustedTitle'),
      });
      await expect(usedUp.getByRole('link')).toHaveAccessibleName(
        /Ivan Petrov/,
      );
      await expect(usedUp).toContainText(
        t('renewals.values.unpaidChip', { count: 3 }),
      );
    },
  );
});
