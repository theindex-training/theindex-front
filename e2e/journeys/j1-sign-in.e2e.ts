import { apiError } from '../support/api-mock';
import { mockStaffHome, mockTraineeHome } from '../support/data';
import { expect, storedToken, test, tokenFor } from '../support/fixtures';
import { t } from '../support/i18n';

/** TEST_PLAN.md J1: staff sign-in, including the forced change of the initial password. */
test.describe('J1 sign-in', { tag: ['@desktop', '@mobile'] }, () => {
  const email = (page: import('@playwright/test').Page) =>
    page.getByLabel(t('auth.login.email'), { exact: true });
  const password = (page: import('@playwright/test').Page) =>
    page.getByLabel(t('auth.login.password'), { exact: true });
  const signIn = (page: import('@playwright/test').Page) =>
    page.getByRole('button', { name: t('auth.login.submit') });

  test('rejects an empty form and wrong credentials without signing in', async ({
    page,
    api,
  }) => {
    api.on('POST', '/api/auth/login', apiError(401, 'Invalid credentials'));

    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);

    await signIn(page).click();
    await expect(page.getByText(t('auth.login.emailRequired'))).toBeVisible();
    await expect(
      page.getByText(t('auth.login.passwordRequired')),
    ).toBeVisible();
    expect(api.calls('POST', '/api/auth/login')).toHaveLength(0);

    await email(page).fill('admin@theindex.test');
    await password(page).fill('wrong-password');
    await signIn(page).click();

    await expect(page.getByRole('alert')).toHaveText('Invalid credentials');
    await expect(page).toHaveURL(/\/login$/);
    expect(await storedToken(page)).toBeNull();
  });

  test('forces a first password change with a phone number, then opens the dashboard', async ({
    page,
    api,
  }) => {
    const token = tokenFor('ADMIN');
    api.on('POST', '/api/auth/login', {
      body: { accessToken: token, account: { id: 'account-admin' } },
    });
    api.on('GET', '/api/accounts/account-admin/password-status', {
      body: { accountId: 'account-admin', hasUpdatedInitialPassword: false },
    });
    api.on('POST', '/api/accounts/account-admin/change-password', {
      body: { accountId: 'account-admin', hasUpdatedInitialPassword: true },
    });
    mockStaffHome(api);

    await page.goto('/login');
    await email(page).fill('admin@theindex.test');
    await password(page).fill('initial-password');
    await signIn(page).click();

    await expect(page).toHaveURL(/\/change-password$/);
    expect(api.last('POST', '/api/auth/login')?.body).toEqual({
      email: 'admin@theindex.test',
      password: 'initial-password',
    });
    expect(await storedToken(page)).toBe(token);
    await expect(page.getByLabel(t('auth.changePassword.phone'))).toBeVisible();
    // Once from the login redirect, once from the page itself.
    expect(
      api.calls('GET', '/api/accounts/account-admin/password-status'),
    ).toHaveLength(2);

    await page
      .getByLabel(t('auth.changePassword.current'), { exact: true })
      .fill('initial-password');
    await page
      .getByLabel(t('auth.changePassword.new'), { exact: true })
      .fill('brand-new-password');
    await page
      .getByLabel(t('auth.changePassword.confirm'), { exact: true })
      .fill('brand-new-passw0rd');
    await page
      .getByRole('button', { name: t('auth.changePassword.save') })
      .click();

    await expect(
      page.getByText(t('auth.changePassword.mismatch')),
    ).toBeVisible();
    expect(
      api.calls('POST', '/api/accounts/account-admin/change-password'),
    ).toHaveLength(0);

    await page
      .getByLabel(t('auth.changePassword.confirm'), { exact: true })
      .fill('brand-new-password');
    await page
      .getByLabel(t('auth.changePassword.phone'))
      .fill(' +359 888 123 456 ');
    await page
      .getByRole('button', { name: t('auth.changePassword.save') })
      .click();

    await expect(page).toHaveURL(/\/home$/);
    expect(
      api.last('POST', '/api/accounts/account-admin/change-password')?.body,
    ).toEqual({
      currentPassword: 'initial-password',
      newPassword: 'brand-new-password',
      confirmPassword: 'brand-new-password',
      phone: '+359 888 123 456',
    });
    await expect(
      page.getByRole('link', { name: 'Ivan Petrov (Vanko)' }),
    ).toBeVisible();
    expect(
      api.last('GET', '/api/attendance/reports/inactive-trainees')?.query,
    ).toEqual({ skipDays: '7' });
    expect(
      api.calls('GET', '/api/attendance/reports/without-active-subscription'),
    ).toHaveLength(1);
  });

  test('goes straight to the dashboard once the password was changed', async ({
    page,
    api,
  }) => {
    api.on('POST', '/api/auth/login', {
      body: { accessToken: tokenFor('TRAINER'), account: {} },
    });
    api.on('GET', '/api/accounts/account-trainer/password-status', {
      body: { accountId: 'account-trainer', hasUpdatedInitialPassword: true },
    });
    mockStaffHome(api);

    await page.goto('/login');
    await email(page).fill('trainer@theindex.test');
    await password(page).fill('a-password');
    await signIn(page).click();

    await expect(page).toHaveURL(/\/home$/);
    await expect(
      page.getByRole('heading', { level: 1, name: t('nav.dashboard') }),
    ).toBeVisible();
  });

  test('takes a trainee to their own profile', async ({ page, api }) => {
    api.on('POST', '/api/auth/login', {
      body: { accessToken: tokenFor('TRAINEE'), account: {} },
    });
    api.on('GET', '/api/accounts/account-trainee/password-status', {
      body: { accountId: 'account-trainee', hasUpdatedInitialPassword: true },
    });
    mockTraineeHome(api);

    await page.goto('/login');
    await email(page).fill('trainee@theindex.test');
    await password(page).fill('a-password');
    await signIn(page).click();

    await expect(page).toHaveURL(/\/my-profile$/);
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: t('traineeDashboard.title'),
      }),
    ).toBeVisible();
  });
});
