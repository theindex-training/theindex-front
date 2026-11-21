import { Page } from '@playwright/test';
import { makeToken } from '../../src/testing/jwt';
import { apiError } from '../support/api-mock';
import { mockStaffHome, mockTraineeHome } from '../support/data';
import { expect, storedToken, test, tokenFor } from '../support/fixtures';
import { t } from '../support/i18n';

/** TEST_PLAN.md J2: who can open what, and what ends a session. Role checks live here only. */
test.describe(
  'J2 access control and session expiry',
  { tag: '@desktop' },
  () => {
    const mainNav = (page: Page) =>
      page.getByRole('navigation', { name: t('nav.mainLabel') });
    const unauthorizedHeading = (page: Page) =>
      page.getByRole('heading', {
        level: 1,
        name: t('system.unauthorized.title'),
      });

    const signIn = async (page: Page) => {
      await page
        .getByLabel(t('auth.login.email'), { exact: true })
        .fill('coach@theindex.test');
      await page
        .getByLabel(t('auth.login.password'), { exact: true })
        .fill('secret-pass');
      await page.getByRole('button', { name: t('auth.login.submit') }).click();
    };

    test('a signed-out deep link goes to the login page without loading data, then back to it once signed in', async ({
      page,
      api,
    }) => {
      await page.goto('/trainees?status=inactive');

      await expect(page).toHaveURL(
        /\/login\?returnUrl=%2Ftrainees%3Fstatus%3Dinactive$/,
      );
      expect(api.calls('GET', '/api/trainees')).toHaveLength(0);

      // Creating an account doesn't come back here: only a sign-in does.
      await expect(
        page.getByRole('link', { name: t('auth.login.createAccount') }),
      ).toHaveAttribute('href', '/register');

      api.on('POST', '/api/auth/login', {
        body: { accessToken: tokenFor('TRAINER'), account: {} },
      });
      api.on('GET', '/api/gym-subscriptions', { body: [] });
      api.on('GET', '/api/trainees', { body: [] });
      await signIn(page);

      await expect(page).toHaveURL(/\/trainees\?status=inactive$/);
      await expect
        .poll(() => api.calls('GET', '/api/trainees').length)
        .toBeGreaterThan(0);
    });

    test('a trainer sees no admin pages in the menu and is turned away from them', async ({
      page,
      api,
      signInAs,
    }) => {
      await signInAs('TRAINER');
      mockStaffHome(api);
      api.on('GET', '/api/settlements', { body: [] });

      await page.goto('/home');
      await expect(
        mainNav(page).getByRole('link', { name: t('nav.trainees') }),
      ).toBeVisible();
      await expect(
        mainNav(page).getByRole('link', { name: t('nav.trainers') }),
      ).toHaveCount(0);
      await expect(
        mainNav(page).getByRole('link', { name: t('nav.cashRegister') }),
      ).toHaveCount(0);
      await expect(
        mainNav(page).getByRole('link', { name: t('nav.content') }),
      ).toHaveCount(0);

      for (const url of [
        '/trainers',
        '/cash-register',
        '/content/categories',
      ]) {
        await page.goto(url);
        await expect(page).toHaveURL(/\/unauthorized$/);
        await expect(unauthorizedHeading(page)).toBeVisible();
      }

      // Reports are created by the API: the old Generate address lands on the list.
      await page.goto('/settlements/new');
      await expect(page).toHaveURL(/\/settlements$/);
      await expect(
        page.getByText(t('settlements.list.emptyMessage')),
      ).toBeVisible();
    });

    test('a trainee is sent to their dashboard from staff pages and the old profile address', async ({
      page,
      api,
      signInAs,
    }) => {
      await signInAs('TRAINEE');
      mockTraineeHome(api);

      for (const url of ['/my-profile', '/trainees', '/settlements']) {
        await page.goto(url);
        await expect(page).toHaveURL(/\/home$/);
        await expect(
          page.getByRole('heading', {
            level: 1,
            name: t('traineeDashboard.title'),
          }),
        ).toBeVisible();
      }
      expect(api.calls('GET', '/api/trainees')).toHaveLength(0);
    });

    test('a signed-in user who opens the login page lands on their home', async ({
      page,
      api,
      signInAs,
    }) => {
      await signInAs('ADMIN');
      mockStaffHome(api);

      await page.goto('/login');

      await expect(page).toHaveURL(/\/home$/);
    });

    test('a 401 from the API ends the session', async ({
      page,
      api,
      signInAs,
    }) => {
      await signInAs('ADMIN');
      api.on('GET', '/api/gym-subscriptions', { body: [] });
      api.on('GET', '/api/trainees', apiError(401, 'Unauthorized'));

      await page.goto('/trainees');

      await expect(page).toHaveURL(/\/login\?returnUrl=%2Ftrainees$/);
      expect(await storedToken(page)).toBeNull();
      await page.reload();
      await expect(page).toHaveURL(/\/login\?returnUrl=%2Ftrainees$/);

      // Signing in again goes back to the page the session ended on.
      api.on('POST', '/api/auth/login', {
        body: { accessToken: tokenFor('ADMIN'), account: {} },
      });
      api.on('GET', '/api/accounts/account-admin/password-status', {
        body: { accountId: 'account-admin', hasUpdatedInitialPassword: true },
      });
      api.on('GET', '/api/trainees', { body: [] });
      await signIn(page);

      await expect(page).toHaveURL(/\/trainees$/);
    });

    test('logging out ends the session, and Back does not reopen the app', async ({
      page,
      api,
      signInAs,
    }) => {
      await signInAs('ADMIN');
      mockStaffHome(api);

      await page.goto('/home');
      await page.getByRole('button', { name: t('common.logOut') }).click();

      await expect(page).toHaveURL(/\/login$/);
      expect(await storedToken(page)).toBeNull();
      // Back to the dashboard is a signed-out visit like any other: the login page, remembering it.
      await page.goBack();
      await expect(page).toHaveURL(/\/login\?returnUrl=%2Fhome$/);
    });

    test('an expired token gets in until the first API call is refused', async ({
      page,
      api,
      seedToken,
    }) => {
      await seedToken(
        makeToken({ sub: 'account-admin', role: 'ADMIN', exp: 1_000_000_000 }),
      );
      api.on('GET', '/api/schedules/slots', apiError(401, 'Token expired'));

      await page.goto('/home');

      // CHARACTERIZATION: possibly unintended — the guards never check `exp`, so the dashboard starts
      // loading; the first 401 then logs the user out. TEST_NOTES.md S6.
      await expect(page).toHaveURL(/\/login\?returnUrl=%2Fhome$/);
      expect(api.calls('GET', '/api/schedules/slots').length).toBeGreaterThan(
        0,
      );
      expect(await storedToken(page)).toBeNull();
    });
  },
);
