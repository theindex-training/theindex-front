import { apiError } from '../support/api-mock';
import { mockTraineeHome } from '../support/data';
import { expect, storedToken, test, tokenFor } from '../support/fixtures';
import { t } from '../support/i18n';

const OPTIONS = {
  gyms: [
    { id: 'gym-1', name: 'Center' },
    { id: 'gym-2', name: 'Lozenets' },
  ],
  gymSubscriptions: [{ id: 'gs-1', name: 'MultiSport' }],
};

/** What an admin entered when they created the account (`GET /api/account-setup`). */
const SETUP = {
  profileType: 'trainee',
  setupRequired: true,
  passwordChangeRequired: true,
  email: 'ivan@example.com',
  name: 'Ivan Petrov',
  phone: '0888 111 222',
  gymSubscriptionId: null,
  homeGymId: 'gym-2',
  instagram: null,
  facebook: null,
  tiktok: null,
};

/**
 * TEST_PLAN.md J20: an account an admin created goes through the Register form, filled in with
 * what the admin entered, on its first sign-in, and can't reach any other page before saving it.
 */
test.describe(
  'J20 first-login account setup',
  { tag: ['@desktop', '@mobile'] },
  () => {
    test('a trainee signs in with the admin password, is kept on the setup form, saves it and lands on their profile', async ({
      page,
      api,
    }) => {
      api.on('POST', '/api/auth/login', {
        status: 201,
        body: {
          accessToken: tokenFor('TRAINEE', { setupRequired: true }),
          account: {},
        },
      });
      api.on('GET', '/api/auth/register/options', { body: OPTIONS });
      api.on('GET', '/api/account-setup', { body: SETUP });
      const finished = tokenFor('TRAINEE', { setupRequired: false });
      api.on(
        'POST',
        '/api/account-setup',
        apiError(409, 'Email is already used by another account'),
      );
      mockTraineeHome(api);

      await page.goto('/login');
      await page
        .getByLabel(t('auth.login.email'), { exact: true })
        .fill('ivan@example.com');
      await page
        .getByLabel(t('auth.login.password'), { exact: true })
        .fill('admin-given');
      await page.getByRole('button', { name: t('auth.login.submit') }).click();

      await expect(page).toHaveURL(/\/account-setup$/);
      await expect(
        page.getByRole('heading', { name: t('accountSetup.title') }),
      ).toBeVisible();
      // Prefilled with what the admin entered.
      await expect(
        page.getByLabel(t('register.name'), { exact: true }),
      ).toHaveValue('Ivan Petrov');
      await expect(
        page.getByLabel(t('contact.phone'), { exact: true }),
      ).toHaveValue('0888 111 222');

      // Any other page sends the person back.
      await page.goto('/home');
      await expect(page).toHaveURL(/\/account-setup$/);

      await page
        .getByLabel(t('accountSetup.password'), { exact: true })
        .fill('my-own-password');
      await page
        .getByLabel(t('accountSetup.confirmPassword'), { exact: true })
        .fill('my-own-password');
      await page.getByLabel(t('register.consent')).check();
      await page
        .getByRole('button', { name: t('accountSetup.submit') })
        .click();

      // A failed save shows the API's message and stays.
      await expect(page.getByRole('alert')).toHaveText(
        'Email is already used by another account',
      );
      await expect(page).toHaveURL(/\/account-setup$/);

      api.on('POST', '/api/account-setup', {
        body: { accessToken: finished, account: {} },
      });
      await page
        .getByRole('button', { name: t('accountSetup.submit') })
        .click();

      await expect(page).toHaveURL(/\/home$/);
      await expect(
        page.getByRole('heading', {
          level: 1,
          name: t('traineeDashboard.title'),
        }),
      ).toBeVisible();
      expect(await storedToken(page)).toBe(finished);
      expect(api.last('POST', '/api/account-setup')?.body).toEqual({
        email: 'ivan@example.com',
        name: 'Ivan Petrov',
        password: 'my-own-password',
        confirmPassword: 'my-own-password',
        phone: '0888 111 222',
        gymSubscriptionId: null,
        homeGymId: 'gym-2',
        instagram: null,
        facebook: null,
        tiktok: null,
        acceptTerms: true,
      });
    });

    test('a request the API refuses until the setup is done sends the person to the form', async ({
      page,
      api,
      signInAs,
    }) => {
      // A token issued before the setup existed: it doesn't say the setup is required.
      await signInAs('TRAINEE');
      api.on('GET', '/api/attendance/trainees/trainee-1', {
        status: 403,
        body: {
          statusCode: 403,
          error: 'ACCOUNT_SETUP_REQUIRED',
          message: 'Finish setting up your account first.',
        },
      });
      api.on('GET', '/api/trainees/trainee-1/subscriptions', { body: [] });
      api.on('GET', '/api/plans', { body: [] });
      api.on('GET', '/api/auth/register/options', { body: OPTIONS });
      api.on('GET', '/api/account-setup', {
        body: { ...SETUP, passwordChangeRequired: false },
      });

      await page.goto('/home');

      await expect(page).toHaveURL(/\/account-setup$/);
      await expect(
        page.getByLabel(t('accountSetup.password'), { exact: true }),
      ).toHaveCount(0);
    });
  },
);
