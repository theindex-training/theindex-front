import { expect, test as base } from '@playwright/test';
import { TestClaims, TestRole, claimsFor, makeToken } from '../../src/testing/jwt';
import { ApiMock } from './api-mock';

export { expect };

/** The token a signed-in test user of this role holds (same defaults as the unit tests). */
export function tokenFor(role: TestRole, claims: TestClaims = {}): string {
  return makeToken(claimsFor(role, claims));
}

interface Fixtures {
  api: ApiMock;
  /** Starts the browser signed in. Call before the first page.goto(). */
  signInAs: (role: TestRole, claims?: TestClaims) => Promise<void>;
  /** Starts the browser with this token stored (e.g. an expired or malformed one). */
  seedToken: (token: string) => Promise<void>;
}

/**
 * - Every /api request is answered by `api`; an unanswered one fails the test at the end.
 * - The UI starts in English (localStorage `lang`), so `t()` selectors apply. Seeded values are
 *   written once per tab, so a reload or the app's own logout/language switch behaves as in real use.
 */
export const test = base.extend<Fixtures>({
  api: async ({ page }, use) => {
    const api = new ApiMock();
    await api.install(page);
    await use(api);
    expect(api.unhandled, 'API requests no rule answered').toEqual([]);
  },
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('e2e-seeded-lang')) {
        localStorage.setItem('lang', 'en');
        sessionStorage.setItem('e2e-seeded-lang', '1');
      }
    });
    await use(page);
  },
  seedToken: async ({ page }, use) => {
    await use(async token => {
      await page.addInitScript(value => {
        if (!sessionStorage.getItem('e2e-seeded-token')) {
          localStorage.setItem('accessToken', value);
          sessionStorage.setItem('e2e-seeded-token', '1');
        }
      }, token);
    });
  },
  signInAs: async ({ seedToken }, use) => {
    await use((role, claims) => seedToken(tokenFor(role, claims)));
  }
});

/** The token the app currently holds, or null. */
export async function storedToken(page: import('@playwright/test').Page): Promise<string | null> {
  return page.evaluate(() => localStorage.getItem('accessToken'));
}
