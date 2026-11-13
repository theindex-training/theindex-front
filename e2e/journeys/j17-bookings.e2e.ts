import { Page } from '@playwright/test';
import { mockTraineeHome } from '../support/data';
import { expect, test } from '../support/fixtures';
import { t } from '../support/i18n';

/**
 * J17: a trainee books a training of this week's schedule from the Schedule tab and cancels
 * another, seeing only how many booked. The API decides what can be booked or cancelled.
 */
test.describe('J17 bookings', () => {
  /** Tuesday 10 Nov 2026, 10:00 in Sofia. */
  const NOW = '2026-11-10T10:00:00+02:00';
  const gyms = [
    { id: 'gym-c', name: 'Center' },
    { id: 'gym-n', name: 'North' },
  ];
  const training = (
    id: string,
    date: string,
    startTime: string,
    over: object = {},
  ) => ({
    id,
    date,
    weekday: 0,
    trainingTime: {
      startTime,
      endTime: `${String(Number(startTime.slice(0, 2)) + 1).padStart(2, '0')}${startTime.slice(2)}`,
    },
    trainer: { name: 'Velcho Sokolov', nickname: null },
    workout: null,
    startsAt: `${date}T${startTime}+02:00`,
    bookedCount: 0,
    bookedByMe: false,
    bookingClosesAt: '',
    cancelUntil: '',
    canBook: true,
    canCancel: false,
    ...over,
  });
  const wednesday = training('t-wed', '2026-11-11', '18:00:00', {
    bookedCount: 6,
    workout: { title: 'Helen' },
  });
  const thursday = training('t-thu', '2026-11-12', '07:10:00', {
    bookedCount: 2,
    bookedByMe: true,
    canBook: false,
    canCancel: true,
  });
  const week = {
    gym: gyms[0],
    weekStart: '2026-11-09',
    weekEnd: '2026-11-15',
    week: { id: 'week-1' },
    slots: [wednesday, thursday],
  };

  const mainNav = (page: Page) =>
    page.getByRole('navigation', { name: t('nav.mainLabel') });

  test(
    'books a training and cancels another',
    { tag: ['@desktop', '@mobile'] },
    async ({ page, api, signInAs }) => {
      await page.clock.setFixedTime(NOW);
      await signInAs('TRAINEE', { traineeProfileId: 'trainee-1' });
      mockTraineeHome(api);
      api.on('GET', '/api/bookings/gyms', { body: gyms });
      api.on('GET', '/api/bookings/schedule', { body: week });
      api.on('POST', '/api/bookings', {
        status: 201,
        body: {
          ...wednesday,
          bookedCount: 7,
          bookedByMe: true,
          canBook: false,
          canCancel: true,
        },
      });
      api.on('DELETE', '/api/bookings/t-thu', {
        body: {
          ...thursday,
          bookedCount: 1,
          bookedByMe: false,
          canBook: true,
          canCancel: false,
        },
      });

      await page.goto('/my-profile');
      await mainNav(page)
        .getByRole('link', { name: t('nav.schedule') })
        .click();
      await expect(page).toHaveURL(/\/schedule$/);
      await expect
        .poll(() => api.last('GET', '/api/bookings/schedule')?.query)
        .toEqual({ gymId: 'gym-c', week: '2026-11-09' });

      const wed = page.getByTestId('trainee-training-t-wed');
      await expect(wed.getByTestId('trainee-training-count')).toHaveText(
        t('schedules.days.booked', { count: 6 }),
      );
      await wed
        .getByRole('button', {
          name: t('traineeSchedule.bookFor', {
            training: 'Wednesday, 11 November 18:00 – 19:00',
          }),
        })
        .click();
      await expect
        .poll(() => api.last('POST', '/api/bookings')?.body)
        .toEqual({ slotId: 't-wed' });
      await expect(
        wed.getByText(t('traineeSchedule.booked'), { exact: true }),
      ).toBeVisible();
      await expect(wed.getByTestId('trainee-training-count')).toHaveText(
        t('schedules.days.booked', { count: 7 }),
      );

      page.once('dialog', (dialog) => void dialog.accept());
      await page
        .getByTestId('trainee-training-t-thu')
        .getByRole('button', {
          name: t('traineeSchedule.cancelFor', {
            training: 'Thursday, 12 November 07:10 – 08:10',
          }),
        })
        .click();
      await expect
        .poll(() => api.calls('DELETE', '/api/bookings/t-thu').length)
        .toBe(1);
      await expect(
        page
          .getByTestId('trainee-training-t-thu')
          .getByRole('button', { name: /^Book/ }),
      ).toBeVisible();
    },
  );

  test(
    "a week the trainers haven't published says so",
    { tag: '@desktop' },
    async ({ page, api, signInAs }) => {
      await page.clock.setFixedTime(NOW);
      await signInAs('TRAINEE', { traineeProfileId: 'trainee-1' });
      api.on('GET', '/api/bookings/gyms', { body: gyms });
      api.on('GET', '/api/bookings/schedule', {
        body: {
          ...week,
          weekStart: '2026-11-16',
          weekEnd: '2026-11-22',
          week: null,
          slots: [],
        },
      });

      await page.goto('/schedule?week=2026-11-16');

      await expect(
        page.getByText(t('traineeSchedule.notOutTitle')),
      ).toBeVisible();
    },
  );

  test(
    'staff have no way into the trainee schedule',
    { tag: '@desktop' },
    async ({ page, api, signInAs }) => {
      await signInAs('TRAINER');
      api.on('GET', /\/api\//, { body: [] });

      await page.goto('/schedule');

      await expect(page).not.toHaveURL(/\/schedule/);
      expect(api.calls('GET', '/api/bookings/schedule')).toHaveLength(0);
    },
  );
});
