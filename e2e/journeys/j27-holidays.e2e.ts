import { Page } from '@playwright/test';
import { ApiMock } from '../support/api-mock';
import { expect, test } from '../support/fixtures';
import { t } from '../support/i18n';

/**
 * J27: the holidays. From Dec 1 it snows (unless the person switches the effects off), everyone's
 * dashboard has an Advent calendar with a door a day, and a booking gets a small celebration.
 * What the holidays keep in the browser is deleted after Jan 10 without anyone doing anything, and
 * `?holidayDate=` previews a day without storing anything.
 */
test.describe('J27 holidays', () => {
  /** Saturday 5 Dec 2026, 10:00 in Sofia. */
  const DEC_5 = '2026-12-05T10:00:00+02:00';
  const TODAY = '2026-12-05';

  /** What a trainee's dashboard loads: no subscription, one training to book today. */
  function traineeHome(api: ApiMock): void {
    api.on('GET', '/api/attendance/trainees/trainee-1', { body: [] });
    api.on('GET', '/api/trainees/trainee-1/subscriptions', { body: [] });
    api.on('GET', '/api/plans', { body: [] });
    api.on('GET', '/api/bookings/gyms', {
      body: [{ id: 'gym-c', name: 'Center', preferred: true }],
    });
    const evening = {
      id: 's-evening',
      date: TODAY,
      weekday: 6,
      trainingTime: { startTime: '18:00:00', endTime: '19:00:00' },
      trainer: { name: 'Velcho Sokolov', nickname: null },
      workout: null,
      workoutReleasesAt: '2026-12-04T18:00:00.000Z',
      startsAt: '2026-12-05T16:00:00.000Z',
      bookedCount: 4,
      bookedByMe: false,
      bookingClosesAt: '2026-12-05T15:30:00.000Z',
      cancelUntil: '2026-12-05T15:00:00.000Z',
      canBook: true,
      canCancel: false,
      gym: { id: 'gym-c', name: 'Center' },
    };
    api.on('GET', '/api/bookings/trainings', (request) => ({
      body: {
        from: request.query['from'],
        to: request.query['to'],
        slots: [evening],
      },
    }));
    const booked = {
      ...evening,
      bookedCount: 5,
      bookedByMe: true,
      canBook: false,
      canCancel: true,
    };
    api.on('POST', '/api/bookings', { body: booked });
    api.on('GET', '/api/bookings/trainings/s-evening', {
      body: {
        ...booked,
        endsAt: '2026-12-05T17:00:00.000Z',
        calendarToken: null,
        gym: { id: 'gym-c', name: 'Center', address: null },
      },
    });
  }

  const advent = (page: Page) => page.getByTestId('advent-calendar');
  const door = (page: Page, day: number) =>
    advent(page).getByTestId(`advent-door-${day}`);
  const stored = (page: Page) =>
    page.evaluate(() => localStorage.getItem('holidays'));

  test(
    'a trainee opens today’s Advent door, and it stays open',
    { tag: ['@desktop', '@mobile'] },
    async ({ page, api, signInAs }) => {
      await page.clock.setFixedTime(DEC_5);
      await signInAs('TRAINEE');
      traineeHome(api);
      await page.goto('/home');

      await expect(page.getByTestId('holiday-snow')).toBeAttached();
      await expect(advent(page).getByTestId('advent-count')).toHaveText(
        t('holidays.advent.count', { opened: 0, available: 5 }),
      );
      await expect(door(page, 6)).toHaveAccessibleName(
        t('holidays.advent.locked', { day: '6 December' }),
      );

      const today = door(page, 5);
      await expect(today).toHaveAccessibleName(
        t('holidays.advent.doorToday', { day: '5 December' }),
      );
      await today.click();
      const dialog = page.getByRole('dialog', { name: /5 December/ });
      await expect(dialog.getByTestId('advent-door-text')).toHaveText(
        t('holidays.advent.doors.d5'),
      );
      await dialog.getByRole('button', { name: t('common.close') }).click();
      await expect(dialog).toBeHidden();

      await page.reload();
      await expect(door(page, 5)).toHaveAccessibleName(
        t('holidays.advent.doorOpened', { day: '5 December' }),
      );
      await expect(advent(page).getByTestId('advent-count')).toHaveText(
        t('holidays.advent.count', { opened: 1, available: 5 }),
      );
    },
  );

  test(
    'booking a training in December is celebrated',
    { tag: '@desktop' },
    async ({ page, api, signInAs }) => {
      await page.clock.setFixedTime(DEC_5);
      await signInAs('TRAINEE');
      traineeHome(api);
      await page.goto('/home');

      await page
        .getByRole('button', { name: /^Book / })
        .filter({ visible: true })
        .first()
        .click();
      await expect(page).toHaveURL(/\/schedule\/s-evening\/booked$/);
      await expect(page.getByTestId('holiday-celebration')).toHaveText(
        t('holidays.celebrate.bookDecember'),
      );
    },
  );

  test(
    'the holiday effects can be switched off, and stay off',
    { tag: '@desktop' },
    async ({ page, api, signInAs }) => {
      await page.clock.setFixedTime(DEC_5);
      await signInAs('TRAINEE');
      traineeHome(api);
      await page.goto('/home');

      const effects = page.getByRole('switch', {
        name: t('holidays.effects'),
      });
      await expect(effects).toBeChecked();
      await expect(page.getByTestId('holiday-snow')).toBeAttached();
      await effects.uncheck();
      await expect(page.getByTestId('holiday-snow')).toHaveCount(0);

      await page.reload();
      await expect(effects).not.toBeChecked();
      await expect(page.getByTestId('holiday-snow')).toHaveCount(0);
      // The Advent calendar isn't an effect: it stays.
      await expect(advent(page)).toBeVisible();
    },
  );

  test(
    'on a phone the switch is in the Account sheet',
    { tag: '@mobile' },
    async ({ page, api, signInAs }) => {
      await page.clock.setFixedTime(DEC_5);
      await signInAs('TRAINEE');
      traineeHome(api);
      await page.goto('/home');

      await page
        .getByRole('navigation', { name: t('nav.mainLabel') })
        .getByRole('button', { name: t('nav.account') })
        .click();
      const sheet = page.getByRole('dialog', { name: t('nav.account') });
      const effects = sheet.getByRole('switch', {
        name: t('holidays.effects'),
      });
      await effects.uncheck();
      await expect(page.getByTestId('holiday-snow')).toHaveCount(0);
    },
  );

  test(
    'staff get the Advent calendar too',
    { tag: '@desktop' },
    async ({ page, api, signInAs }) => {
      await page.clock.setFixedTime(DEC_5);
      await signInAs('TRAINER');
      await page.goto('/home');
      // Below the trainings, which work comes first for.
      await expect
        .poll(() => api.calls('GET', '/api/schedules/slots').length)
        .toBe(1);
      await expect(advent(page)).toBeVisible();
      await expect(door(page, 5)).toHaveAccessibleName(
        t('holidays.advent.doorToday', { day: '5 December' }),
      );
    },
  );

  test(
    'nothing shows in November, and the holidays’ storage is gone after Jan 10',
    { tag: '@desktop' },
    async ({ page, api, signInAs }) => {
      await page.clock.setFixedTime('2027-01-11T09:00:00+02:00');
      await page.addInitScript(() => {
        if (!sessionStorage.getItem('e2e-seeded-holidays')) {
          localStorage.setItem(
            'holidays',
            JSON.stringify({ season: 2026, effects: false, doors: [1, 2] }),
          );
          sessionStorage.setItem('e2e-seeded-holidays', '1');
        }
      });
      await signInAs('TRAINEE');
      traineeHome(api);
      await page.goto('/home');

      await expect(
        page.getByRole('heading', { name: t('traineeDashboard.title') }),
      ).toBeVisible();
      await expect(advent(page)).toHaveCount(0);
      await expect(page.getByTestId('holiday-snow')).toHaveCount(0);
      await expect(
        page.getByRole('switch', { name: t('holidays.effects') }),
      ).toHaveCount(0);
      await expect.poll(() => stored(page)).toBeNull();
    },
  );

  test(
    '?holidayDate= previews a day and stores nothing',
    { tag: '@desktop' },
    async ({ page, api, signInAs }) => {
      await page.clock.setFixedTime('2026-11-25T10:00:00+02:00');
      await signInAs('TRAINEE');
      traineeHome(api);
      await page.goto('/home?holidayDate=2026-12-24');

      await expect(advent(page).getByTestId('advent-count')).toHaveText(
        t('holidays.advent.count', { opened: 0, available: 24 }),
      );
      await door(page, 24).click();
      await expect(
        page
          .getByRole('dialog', { name: /24 December/ })
          .getByTestId('advent-door-text'),
      ).toHaveText(t('holidays.advent.doors.d24'));
      expect(await stored(page)).toBeNull();
    },
  );
});
