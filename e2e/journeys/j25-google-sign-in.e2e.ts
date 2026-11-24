import type { Page } from '@playwright/test';
import { mockTraineeHome } from '../support/data';
import { expect, storedToken, test, tokenFor } from '../support/fixtures';
import { t } from '../support/i18n';

const GOOGLE_SCRIPT = 'https://accounts.google.com/gsi/client';

/**
 * Stands in for Google Identity Services (a third-party script): its button signs in at once, as
 * Google's popup would, handing the page `google-id-token`. It records the button's options.
 */
const FAKE_GOOGLE_SCRIPT = `
  window.google = { accounts: { id: {
    initialize(config) { window.__gsi = { config, buttons: [] }; },
    renderButton(parent, options) {
      window.__gsi.buttons.push(options);
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Sign in with Google';
      button.onclick = () => window.__gsi.config.callback({ credential: 'google-id-token' });
      parent.appendChild(button);
    },
  } } };
`;

async function fakeGoogle(page: Page): Promise<void> {
  await page.route(GOOGLE_SCRIPT, (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: FAKE_GOOGLE_SCRIPT,
    }),
  );
}

const googleButton = (page: Page) =>
  page.getByTestId('google-sign-in').getByRole('button');

/** TEST_PLAN.md J25: "Sign in with Google" as a shortcut into an existing account. */
test.describe('J25 Google sign-in', { tag: ['@desktop', '@mobile'] }, () => {
  test('shows no Google button, and loads nothing from Google, while the API has no client id', async ({
    page,
  }) => {
    const googleRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().startsWith('https://accounts.google.com/')) {
        googleRequests.push(request.url());
      }
    });

    await page.goto('/login');
    await expect(
      page.getByRole('button', { name: t('auth.login.submit') }),
    ).toBeVisible();

    await expect(page.getByText(t('auth.login.google.hint'))).toHaveCount(0);
    await expect(googleButton(page)).toHaveCount(0);
    expect(googleRequests).toEqual([]);
  });

  test("signs a trainee in with Google's credential and opens the dashboard", async ({
    page,
    api,
  }) => {
    await fakeGoogle(page);
    api.on('GET', '/api/auth/google/config', {
      body: { clientId: 'client-1.apps.googleusercontent.com' },
    });
    api.on('POST', '/api/auth/google', {
      status: 201,
      body: { accessToken: tokenFor('TRAINEE'), account: {} },
    });
    mockTraineeHome(api);

    await page.goto('/login');
    await expect(page.getByText(t('auth.login.google.hint'))).toBeVisible();
    await googleButton(page).click();

    await expect(page).toHaveURL(/\/home$/);
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: t('traineeDashboard.title'),
      }),
    ).toBeVisible();
    expect(api.last('POST', '/api/auth/google')?.body).toEqual({
      credential: 'google-id-token',
    });
    expect(await storedToken(page)).toBe(tokenFor('TRAINEE'));
    // No password login was involved.
    expect(api.calls('POST', '/api/auth/login')).toHaveLength(0);
  });

  test('explains a Google address no account has, and stays signed out', async ({
    page,
    api,
  }) => {
    await fakeGoogle(page);
    api.on('GET', '/api/auth/google/config', {
      body: { clientId: 'client-1' },
    });
    api.on('POST', '/api/auth/google', {
      status: 401,
      body: {
        statusCode: 401,
        message: 'No account uses this Google address',
        error: 'GOOGLE_NO_ACCOUNT',
      },
    });

    await page.goto('/login');
    await googleButton(page).click();

    await expect(page.getByRole('alert')).toHaveText(
      t('auth.login.google.noAccount'),
    );
    await expect(page).toHaveURL(/\/login$/);
    expect(await storedToken(page)).toBeNull();
  });
});
