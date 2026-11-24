import { expect, test } from '../support/fixtures';
import { t, tBg } from '../support/i18n';

/**
 * TEST_PLAN.md J26: the privacy policy is a public page of the app (`/privacy`), which Google
 * sign-in's consent screen and the consent checkboxes link to.
 */
test.describe('J26 privacy policy', { tag: ['@desktop', '@mobile'] }, () => {
  test('opens from the sign-in page without signing in, in either language', async ({
    page,
    api,
  }) => {
    await page.goto('/login');
    await page
      .getByRole('link', { name: t('auth.login.privacyPolicy') })
      .click();

    await expect(page).toHaveURL(/\/privacy$/);
    await expect(
      page.getByRole('heading', { level: 1, name: t('privacy.title') }),
    ).toBeVisible();
    await expect(page.getByTestId('privacy-controller')).toHaveText(
      t('privacy.controller.text'),
    );
    // A static page: besides the app's health check and the sign-in page's Google setting, it
    // asks the API for nothing.
    expect(
      api.requests
        .map((request) => request.path)
        .filter(
          (path) => !['/api/health', '/api/auth/google/config'].includes(path),
        ),
    ).toEqual([]);

    await page
      .getByRole('group', { name: t('common.language') })
      .getByText('БГ', { exact: true })
      .click();
    await expect(
      page.getByRole('heading', { level: 1, name: tBg('privacy.title') }),
    ).toBeVisible();

    await page.getByRole('link', { name: tBg('privacy.backToLogin') }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('opens from the Register consent in a new tab, keeping the form', async ({
    page,
    api,
  }) => {
    api.on('GET', '/api/auth/register/options', {
      body: { gyms: [], gymSubscriptions: [] },
    });
    await page.goto('/register');
    await page
      .getByLabel(t('register.name'), { exact: true })
      .fill('Ivan Petrov');

    const [policy] = await Promise.all([
      page.waitForEvent('popup'),
      page
        .getByRole('link', { name: new RegExp(t('register.privacyPolicy')) })
        .click(),
    ]);

    await expect(policy).toHaveURL(/\/privacy$/);
    await expect(
      policy.getByRole('heading', { level: 1, name: t('privacy.title') }),
    ).toBeVisible();
    await expect(
      page.getByLabel(t('register.name'), { exact: true }),
    ).toHaveValue('Ivan Petrov');
  });
});
