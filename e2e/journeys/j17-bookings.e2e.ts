import { Page } from '@playwright/test';
import { mockTraineeHome } from '../support/data';
import { expect, test } from '../support/fixtures';
import { t } from '../support/i18n';

/**
 * J17: a trainee opens a training of this week's schedule from the Schedule tab, sees its workout
 * and books it there, lands on the booking confirmation with its "Add to Google Calendar" link,
 * then cancels another booking from the list, seeing only how many booked. Another training is
 * booked in one click from the list. The API decides what can be booked or cancelled.
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
  const friday = training('t-fri', '2026-11-13', '07:10:00', {
    bookedCount: 1,
  });
  const booked = <T extends { bookedCount: number }>(slot: T) => ({
    ...slot,
    bookedCount: slot.bookedCount + 1,
    bookedByMe: true,
    canBook: false,
    canCancel: true,
  });
  const wednesdayDetails = {
    ...wednesday,
    endsAt: '2026-11-11T19:00:00+02:00',
    calendarToken: null,
    gym: { ...gyms[0], address: 'ul. Ranni list 13, Plovdiv' },
    workout: {
      title: 'Helen',
      summary: '3 rounds for time:\n400 m run\n21 kettlebell swings',
      exercises: [
        {
          id: 'ex-run',
          name: 'Run',
          description: 'Out of the door and around the block.',
          videoUrl: null,
        },
        {
          id: 'ex-swing',
          name: 'Kettlebell Swing',
          description: null,
          videoUrl: 'https://www.youtube.com/watch?v=mKDIuUbH94Q',
        },
      ],
    },
  };
  const week = {
    gym: gyms[0],
    weekStart: '2026-11-09',
    weekEnd: '2026-11-15',
    week: { id: 'week-1' },
    slots: [wednesday, thursday, friday],
  };

  const mainNav = (page: Page) =>
    page.getByRole('navigation', { name: t('nav.mainLabel') });

  test(
    'books a training from its page, sees the confirmation and cancels another from the list',
    { tag: ['@desktop', '@mobile'] },
    async ({ page, api, signInAs }) => {
      await page.clock.setFixedTime(NOW);
      await signInAs('TRAINEE', { traineeProfileId: 'trainee-1' });
      mockTraineeHome(api);
      api.on('GET', '/api/bookings/gyms', { body: gyms });
      api.on('GET', '/api/bookings/schedule', { body: week });
      api.on('GET', '/api/bookings/trainings/t-wed', {
        body: wednesdayDetails,
      });
      api.on('POST', '/api/bookings', {
        status: 201,
        body: booked(wednesday),
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

      await page.goto('/home');
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
        .getByRole('link', {
          name: t('traineeSchedule.detailsFor', {
            training: 'Wednesday, 11 November 18:00 – 19:00',
          }),
        })
        .click();
      await expect(page).toHaveURL(/\/schedule\/t-wed$/);
      expect(api.calls('POST', '/api/bookings')).toHaveLength(0);

      // The training's page: the workout, then Book.
      await expect(
        page.getByRole('heading', { level: 1, name: 'Helen' }),
      ).toBeVisible();
      await expect(page.getByTestId('training-workout-summary')).toHaveText(
        '3 rounds for time:\n400 m run\n21 kettlebell swings',
      );
      await expect(page.getByTestId('training-exercise-ex-run')).toContainText(
        'Out of the door and around the block.',
      );
      await expect(
        page.getByTestId('training-exercise-ex-swing').getByRole('button', {
          name: t('traineeTraining.playVideo', { name: 'Kettlebell Swing' }),
        }),
      ).toBeVisible();
      // From now on the API answers with Wednesday booked.
      api.on('GET', '/api/bookings/trainings/t-wed', {
        body: { ...booked(wednesdayDetails), calendarToken: 'cal.token-wed' },
      });
      api.on('GET', '/api/bookings/schedule', {
        body: { ...week, slots: [booked(wednesday), thursday, friday] },
      });
      await page
        .getByRole('button', {
          name: t('traineeSchedule.bookFor', {
            training: 'Wednesday, 11 November 18:00 – 19:00',
          }),
        })
        .click();
      await expect
        .poll(() => api.last('POST', '/api/bookings')?.body)
        .toEqual({ slotId: 't-wed' });

      // The confirmation: when, where, with whom, and Google Calendar.
      await expect(page).toHaveURL(/\/schedule\/t-wed\/booked$/);
      await expect(
        page.getByRole('heading', {
          level: 1,
          name: t('traineeBooked.title'),
        }),
      ).toBeVisible();
      await expect(page.getByText(t('traineeBooked.message'))).toBeVisible();
      const panel = page.getByTestId('trainee-training-booking');
      await expect(panel).toContainText('ul. Ranni list 13, Plovdiv');
      await expect(panel).toContainText('Velcho Sokolov');
      await expect(panel).toContainText(
        t('schedules.days.booked', { count: 7 }),
      );
      // Cancel is right here; nothing leads to the training's page, which shows the same.
      await expect(
        panel.getByRole('button', {
          name: t('traineeSchedule.cancelFor', {
            training: 'Wednesday, 11 November 18:00 – 19:00',
          }),
        }),
      ).toBeVisible();
      expect(
        await page
          .getByRole('main')
          .getByRole('link')
          .evaluateAll((links) => links.map((a) => a.getAttribute('href'))),
      ).not.toContain('/schedule/t-wed');
      await expect(page.getByTestId('training-workout-summary')).toBeVisible();
      const calendar = page.getByRole('link', {
        name: t('googleCalendar.add'),
      });
      await expect(calendar).toHaveAttribute('target', '_blank');
      const event = new URL((await calendar.getAttribute('href'))!);
      expect(event.origin + event.pathname).toBe(
        'https://calendar.google.com/calendar/render',
      );
      expect(Object.fromEntries(event.searchParams)).toEqual({
        action: 'TEMPLATE',
        text: t('googleCalendar.event.title'),
        dates: '20261111T160000Z/20261111T170000Z',
        location: 'ul. Ranni list 13, Plovdiv',
        details: [
          t('googleCalendar.event.trainer', { name: 'Velcho Sokolov' }),
          t('googleCalendar.event.workout', { title: 'Helen' }),
          new URL('/schedule/t-wed', page.url()).href,
        ].join('\n'),
      });

      // Apple Calendar: the training's .ics file from the API, in the page's language.
      await expect(
        page.getByRole('link', { name: t('appleCalendar.add') }),
      ).toHaveAttribute(
        'href',
        '/api/bookings/calendar.ics?token=cal.token-wed&lang=en',
      );

      // Back to the week, which shows Wednesday booked now.
      await page.getByRole('link', { name: t('traineeTraining.back') }).click();
      await expect(page).toHaveURL(/\/schedule\?gym=gym-c&week=2026-11-09$/);
      await expect(
        wed.getByText(t('traineeSchedule.booked'), { exact: true }),
      ).toBeVisible();
      await expect(
        wed.getByRole('link', {
          name: t('traineeSchedule.detailsFor', {
            training: 'Wednesday, 11 November 18:00 – 19:00',
          }),
        }),
      ).toBeVisible();

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
        page.getByTestId('trainee-training-t-thu').getByRole('button', {
          name: t('traineeSchedule.bookFor', {
            training: 'Thursday, 12 November 07:10 – 08:10',
          }),
        }),
      ).toBeVisible();
    },
  );

  test(
    'books a training from the list in one click',
    { tag: ['@desktop', '@mobile'] },
    async ({ page, api, signInAs }) => {
      await page.clock.setFixedTime(NOW);
      await signInAs('TRAINEE', { traineeProfileId: 'trainee-1' });
      api.on('GET', '/api/bookings/gyms', { body: gyms });
      api.on('GET', '/api/bookings/schedule', { body: week });
      api.on('POST', '/api/bookings', { status: 201, body: booked(friday) });
      api.on('GET', '/api/bookings/trainings/t-fri', {
        body: {
          ...booked(friday),
          endsAt: '2026-11-13T08:10:00+02:00',
          calendarToken: 'cal.token-fri',
          gym: { ...gyms[0], address: null },
          workoutReleasesAt: '2026-11-12T20:00:00+02:00',
        },
      });

      await page.goto('/schedule');
      await page
        .getByTestId('trainee-training-t-fri')
        .getByRole('button', {
          name: t('traineeSchedule.bookFor', {
            training: 'Friday, 13 November 07:10 – 08:10',
          }),
        })
        .click();

      await expect(page).toHaveURL(/\/schedule\/t-fri\/booked$/);
      expect(api.last('POST', '/api/bookings')?.body).toEqual({
        slotId: 't-fri',
      });
      await expect(
        page.getByRole('heading', {
          level: 1,
          name: t('traineeBooked.title'),
        }),
      ).toBeVisible();
      // The workout isn't out yet; the gym has no address, so the event names it.
      await expect(
        page.getByText(t('traineeTraining.noWorkoutTitle')),
      ).toBeVisible();
      const href = await page
        .getByRole('link', { name: t('googleCalendar.add') })
        .getAttribute('href');
      expect(new URL(href!).searchParams.get('location')).toBe('Center');
      expect(new URL(href!).searchParams.get('dates')).toBe(
        '20261113T051000Z/20261113T061000Z',
      );
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
