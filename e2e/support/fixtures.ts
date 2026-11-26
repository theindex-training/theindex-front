import { expect, test as base } from '@playwright/test';
import {
  TestClaims,
  TestRole,
  claimsFor,
  makeToken,
} from '../../src/testing/jwt';
import { ApiMock } from './api-mock';
import { myProfile } from './data';

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
  /**
   * Let the сурвачка's New Year wish open by itself (Jan 1 – 6). Off by default: it is a modal
   * dialog, and journeys run on the real date in CI. J27 turns it on with `test.use`.
   */
  holidayGreeting: boolean;
}

/**
 * - Every /api request is answered by `api`; an unanswered one fails the test at the end.
 *   `GET /api/my-profile` (the navigation's avatar) is answered by default with `myProfile()`,
 *   `GET /api/auth/google/config` with no client id (the login page shows no Google button),
 *   and the dashboards' requests (`dashboardDefaults`, a trainee's year in review included) with
 *   nothing to show.
 * - The UI starts in English (localStorage `lang`), so `t()` selectors apply. Seeded values are
 *   written once per tab, so a reload or the app's own logout/language switch behaves as in real use.
 * - From Jan 1 to Jan 6 (the browser's date) the сурвачка's wish is stored as seen, so its modal
 *   dialog doesn't cover the page, unless the test sets `holidayGreeting`.
 */
export const test = base.extend<Fixtures>({
  holidayGreeting: [false, { option: true }],
  api: async ({ page }, use) => {
    const api = new ApiMock();
    // The navigation's avatar of trainees and trainers (a test's own rule wins).
    api.on('GET', '/api/my-profile', { body: myProfile() });
    // The login page's "Sign in with Google": off unless a test sets a client id.
    api.on('GET', '/api/auth/google/config', { body: { clientId: null } });
    dashboardDefaults(api);
    await api.install(page);
    await use(api);
    expect(api.unhandled, 'API requests no rule answered').toEqual([]);
  },
  page: async ({ page, holidayGreeting }, use) => {
    if (!holidayGreeting) {
      await page.addInitScript(() => {
        const now = new Date();
        if (
          now.getMonth() === 0 &&
          now.getDate() <= 6 &&
          !localStorage.getItem('holidays')
        ) {
          localStorage.setItem(
            'holidays',
            JSON.stringify({ season: now.getFullYear() - 1, survachka: true }),
          );
        }
      });
    }
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('e2e-seeded-lang')) {
        localStorage.setItem('lang', 'en');
        sessionStorage.setItem('e2e-seeded-lang', '1');
      }
    });
    await use(page);
  },
  seedToken: async ({ page }, use) => {
    await use(async (token) => {
      await page.addInitScript((value) => {
        if (!sessionStorage.getItem('e2e-seeded-token')) {
          localStorage.setItem('accessToken', value);
          sessionStorage.setItem('e2e-seeded-token', '1');
        }
      }, token);
    });
  },
  signInAs: async ({ seedToken }, use) => {
    await use((role, claims) => seedToken(tokenFor(role, claims)));
  },
});

/**
 * What the dashboards (`/home`) load besides their own data, answered empty so that a journey
 * passing through the start page needs no rules for it (a test's own rule wins): today's and
 * tomorrow's trainings (staff and trainee), the trainee's gyms, the renewals count, and an admin's
 * accounts waiting and reports.
 */
export function dashboardDefaults(api: ApiMock): void {
  const noTrainings = (request: { query: Record<string, string> }) => ({
    body: { from: request.query['from'], to: request.query['to'], slots: [] },
  });
  api.on('GET', '/api/schedules/slots', noTrainings);
  api.on('GET', '/api/bookings/trainings', noTrainings);
  api.on('GET', '/api/bookings/gyms', { body: [] });
  api.on('GET', '/api/subscription-renewals', {
    body: {
      punch: { exhausted: [], active: [] },
      time: { exhausted: [], active: [] },
    },
  });
  api.on('GET', '/api/accounts', { body: [] });
  api.on('GET', '/api/settlements', { body: [] });
  // A trainee's year in review (Dec 27 – Jan 10): a year without trainings, so no card shows.
  api.on('GET', '/api/trainees/me/year-in-review', (request) => ({
    body: {
      year: Number(request.query['year']),
      trainings: 0,
      firstTrainingOn: null,
      favouriteTime: null,
      longestStreakWeeks: 0,
      topTrainer: null,
      busiestMonth: null,
    },
  }));
}

/** The token the app currently holds, or null. */
export async function storedToken(
  page: import('@playwright/test').Page,
): Promise<string | null> {
  return page.evaluate(() => localStorage.getItem('accessToken'));
}
