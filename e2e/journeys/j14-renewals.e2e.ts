import { Page } from '@playwright/test';
import {
  mockAttendanceReports,
  mockStaffHome,
  renewalRow,
} from '../support/data';
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

/**
 * TEST_PLAN.md J14: the renewals page, reached from the menu's People group or the dashboard's
 * shortcut, with the attendance reports that moved there from the dashboard.
 */
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
    'a trainer opens Renewals from the People group and reads both tabs',
    { tag: '@desktop' },
    async ({ page, api, signInAs }) => {
      await signInAs('TRAINER');
      mockStaffHome(api);
      api.on('GET', '/api/subscription-renewals', { body: RENEWALS });

      await page.goto('/home');
      // The dashboard's shortcut counts who has run out (punch and time).
      await expect(page.getByTestId('dashboard-renewals-count')).toHaveText(
        t('dashboard.shortcuts.toRenew', { count: 2 }),
      );
      const people = mainNav(page).getByRole('list', {
        name: t('nav.groups.people'),
      });
      await expect(people.getByRole('link')).toHaveText([
        t('nav.trainees'),
        t('nav.renewals'),
      ]);
      await people.getByRole('link', { name: t('nav.renewals') }).click();
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
      // Switching tabs is local: the overview was loaded once by the page (and once before, by the
      // dashboard for its count).
      expect(api.calls('GET', '/api/subscription-renewals')).toHaveLength(2);

      // Each name opens the trainee's details page.
      await expect(
        expired.getByRole('link', { name: 'Georgi Ivanov' }),
      ).toHaveAttribute('href', '/trainees/t1');
    },
  );

  test(
    'on a phone, Renewals is in the More sheet, under People',
    { tag: '@mobile' },
    async ({ page, api, signInAs }) => {
      await signInAs('ADMIN');
      mockStaffHome(api);
      api.on('GET', '/api/subscription-renewals', { body: RENEWALS });

      await page.goto('/home');
      await mainNav(page)
        .getByRole('button', { name: t('nav.more') })
        .click();
      const people = page
        .getByRole('dialog', { name: t('nav.more') })
        .getByRole('navigation', { name: t('nav.morePages') })
        .getByRole('list', { name: t('nav.groups.people') });
      await expect(people.getByRole('link')).toHaveText([t('nav.renewals')]);
      await people.getByRole('link', { name: t('nav.renewals') }).click();
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

  test(
    'shows the attendance reports that moved from the dashboard',
    { tag: ['@desktop', '@mobile'] },
    async ({ page, api, signInAs }) => {
      await signInAs('TRAINER');
      api.on('GET', '/api/subscription-renewals', { body: RENEWALS });
      mockAttendanceReports(api);

      await page.goto('/renewals');
      const views = page.getByRole('navigation', {
        name: t('renewals.views.label'),
      });
      await views
        .getByRole('link', { name: t('renewals.views.inactive') })
        .click();
      await expect(page).toHaveURL(/\/renewals\?view=inactive$/);
      await expect(
        page.getByRole('heading', {
          level: 2,
          name: t('renewals.reports.inactiveTitle'),
        }),
      ).toBeVisible();
      await expect(
        page.getByRole('link', { name: 'Ivan Petrov (Vanko)' }),
      ).toBeVisible();
      await expect
        .poll(
          () =>
            api.last('GET', '/api/attendance/reports/inactive-trainees')?.query,
        )
        .toEqual({ skipDays: '7' });

      await page
        .getByLabel(t('renewals.reports.inactiveFor'))
        .selectOption({ label: t('renewals.reports.lastDays', { count: 30 }) });
      await expect
        .poll(
          () =>
            api.last('GET', '/api/attendance/reports/inactive-trainees')?.query,
        )
        .toEqual({ skipDays: '30' });

      await views
        .getByRole('link', { name: t('renewals.views.without') })
        .click();
      await expect(page).toHaveURL(/\/renewals\?view=without$/);
      await expect(
        page.getByText(t('renewals.reports.noWithout')),
      ).toBeVisible();
    },
  );
});
