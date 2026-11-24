import { Page } from '@playwright/test';
import { gym, mockStaffHome, trainee, trainer } from '../support/data';
import { expect, test } from '../support/fixtures';
import { t } from '../support/i18n';

/**
 * J24: everyone's start page, `/home`, shows their role's dashboard.
 * - A trainer sees today's and tomorrow's trainings (their own by default, every gym's with
 *   All), which of today's still need attendance, and registers one in a few taps: Register
 *   attendance opens with the training and its booked trainees filled in.
 * - An admin also sees what waits for them: accounts to connect, a report to finalize.
 * - A trainee sees how much is left of their subscription and books today's training from there.
 */
test.describe('J24 dashboards', () => {
  /** Friday 13 Nov 2026, 19:05 in Sofia: the 18:00 training is over, the 20:00 one to come. */
  const NOW = '2026-11-13T19:05:00+02:00';
  const TODAY = '2026-11-13';
  const TOMORROW = '2026-11-14';
  const evening = { id: 'tt-18', startTime: '18:00:00', endTime: '19:00:00' };
  const late = { id: 'tt-20', startTime: '20:00:00', endTime: '21:00:00' };
  const velcho = trainer('tr-velcho', 'Velcho Sokolov');
  const maria = trainer('tr-maria', 'Maria Ilieva');
  const slotTrainer = (person: ReturnType<typeof trainer>) => ({
    id: person.id,
    name: person.name,
    nickname: null,
    isActive: true,
  });
  const slot = (over: object) => ({
    id: 'slot',
    date: TODAY,
    weekday: 5,
    trainingTime: evening,
    trainer: slotTrainer(velcho),
    workout: null,
    bookedCount: 0,
    gym: { id: 'gym-c', name: 'Center' },
    weekStart: '2026-11-09',
    weekStatus: 'PUBLISHED',
    startsAt: '2026-11-13T16:00:00.000Z',
    endsAt: '2026-11-13T17:00:00.000Z',
    attendanceCount: 0,
    unregisteredTraineeIds: [],
    ...over,
  });
  const done = slot({
    id: 's-evening',
    workout: { id: 'w-fran', title: 'Fran' },
    bookedCount: 2,
    unregisteredTraineeIds: ['t-ana', 't-cveta'],
  });
  const marias = slot({
    id: 's-maria',
    trainingTime: late,
    trainer: slotTrainer(maria),
    gym: { id: 'gym-s', name: 'South' },
    startsAt: '2026-11-13T18:00:00.000Z',
    endsAt: '2026-11-13T19:00:00.000Z',
  });
  const saturday = slot({
    id: 's-sat',
    date: TOMORROW,
    weekday: 6,
    trainingTime: { id: 'tt-9', startTime: '09:00:00', endTime: '10:00:00' },
    startsAt: '2026-11-14T07:00:00.000Z',
    endsAt: '2026-11-14T08:00:00.000Z',
  });

  const day = (page: Page, date: string) =>
    page.getByTestId(`dashboard-day-${date}`);
  const trainingRow = (page: Page, id: string) =>
    page.getByTestId(`dashboard-training-${id}`);

  test(
    'a trainer registers attendance for a training that just ended, from the dashboard',
    { tag: ['@desktop', '@mobile'] },
    async ({ page, api, signInAs }) => {
      await page.clock.setFixedTime(NOW);
      await signInAs('TRAINER', { trainerProfileId: velcho.id });
      mockStaffHome(api, [done, marias, saturday]);
      // Register attendance, opened from the training.
      api.on('GET', '/api/gym-locations', {
        body: [gym('gym-c', 'Center'), gym('gym-s', 'South')],
      });
      api.on('GET', '/api/training-times', { body: [evening, late] });
      api.on('GET', '/api/trainers', { body: [velcho, maria] });
      api.on('GET', '/api/trainees', {
        body: [
          trainee('t-ana', 'Ana Koleva'),
          trainee('t-boris', 'Boris Ivanov'),
          trainee('t-cveta', 'Cveta Ilieva'),
        ],
      });

      await page.goto('/');
      await expect(page).toHaveURL(/\/home$/);
      await expect
        .poll(() => api.last('GET', '/api/schedules/slots')?.query)
        .toEqual({ from: TODAY, to: TOMORROW });

      // The whole week is one link away, on the staff's Schedule.
      await expect(
        page.getByRole('link', {
          name: t('dashboard.trainings.fullSchedule'),
        }),
      ).toHaveAttribute('href', '/workouts/schedule');

      // His own trainings: today's 18:00, which still needs attendance, and tomorrow's.
      await expect(day(page, TODAY).getByRole('listitem')).toHaveCount(1);
      await expect(trainingRow(page, 's-evening')).toContainText('Fran');
      await expect(
        trainingRow(page, 's-evening').getByTestId('dashboard-training-status'),
      ).toHaveText(t('dashboard.trainings.unregistered'));
      await expect(day(page, TOMORROW).getByRole('listitem')).toHaveCount(1);
      // Tomorrow's can't be registered yet.
      await expect(
        trainingRow(page, 's-sat').getByRole('link', {
          name: /Register attendance/,
        }),
      ).toHaveCount(0);

      // Everyone's: Maria's 20:00 at South too, still to come.
      await page
        .getByRole('group', { name: t('dashboard.trainings.scope') })
        .getByText(t('dashboard.trainings.all'), { exact: true })
        .click();
      await expect(
        page.getByRole('radio', { name: t('dashboard.trainings.all') }),
      ).toBeChecked();
      await expect(day(page, TODAY).getByRole('listitem')).toHaveCount(2);
      await expect(
        trainingRow(page, 's-maria').getByTestId('dashboard-training-status'),
      ).toHaveText(t('dashboard.trainings.upcoming'));

      await trainingRow(page, 's-evening')
        .getByRole('link', {
          name: t('dashboard.trainings.registerFor', {
            training: 'Friday, 13 November 18:00 – 19:00, Center',
          }),
        })
        .click();
      await expect(page).toHaveURL(/\/attendance\/new\?/);
      await expect(page.getByTestId('attendance-from-training')).toHaveText(
        t('attendance.register.fromTraining', { count: 2 }),
      );
      for (const name of ['Ana Koleva', 'Cveta Ilieva']) {
        await expect(page.getByRole('checkbox', { name })).toBeChecked();
      }
      await expect(
        page.getByRole('checkbox', { name: 'Boris Ivanov' }),
      ).not.toBeChecked();
    },
  );

  test(
    'on a phone, the tab bar has Schedule, and Settlements moved to More',
    { tag: '@mobile' },
    async ({ page, api, signInAs }) => {
      await signInAs('TRAINER', { trainerProfileId: velcho.id });
      mockStaffHome(api);

      await page.goto('/home');
      const tabs = page
        .getByRole('navigation', { name: t('nav.mainLabel') })
        .getByRole('link');
      await expect(tabs).toHaveText([
        t('nav.home'),
        t('nav.schedule'),
        t('nav.register'),
        t('nav.trainees'),
      ]);
      await page
        .getByRole('navigation', { name: t('nav.mainLabel') })
        .getByRole('button', { name: t('nav.more') })
        .click();
      const money = page
        .getByRole('dialog', { name: t('nav.more') })
        .getByRole('list', { name: t('nav.groups.money') });
      await expect(money.getByRole('link')).toHaveText([t('nav.settlements')]);
    },
  );

  test(
    'an admin sees the accounts waiting to be connected and the report to finalize',
    { tag: '@desktop' },
    async ({ page, api, signInAs }) => {
      await page.clock.setFixedTime(NOW);
      await signInAs('ADMIN');
      mockStaffHome(api, [done]);
      api.on('GET', '/api/accounts', {
        body: [{ id: 'acc-1' }, { id: 'acc-2' }, { id: 'acc-3' }],
      });
      api.on('GET', '/api/settlements', {
        body: [
          {
            id: 'set-nov-1',
            periodStart: '2026-11-01',
            periodEnd: '2026-11-15',
            generatedAt: '2026-11-16T02:00:00Z',
            status: 'DRAFT',
            finalizedAt: null,
            notes: null,
          },
          {
            id: 'set-oct-2',
            periodStart: '2026-10-16',
            periodEnd: '2026-10-31',
            generatedAt: '2026-11-01T02:00:00Z',
            status: 'DRAFT',
            finalizedAt: null,
            notes: null,
          },
        ],
      });

      await page.goto('/home');

      await expect(page.getByTestId('dashboard-accounts')).toContainText(
        t('dashboard.attention.accounts', { count: 3 }),
      );
      await expect
        .poll(() => api.last('GET', '/api/accounts')?.query)
        .toEqual({ link: 'unlinked' });
      // The oldest draft whose period is over.
      const report = page.getByTestId('dashboard-settlement');
      await expect(report).toContainText(
        t('dashboard.attention.settlement', { period: '16 Oct – 31 Oct 2026' }),
      );
      await expect(
        report.getByRole('link', {
          name: t('dashboard.attention.settlementAction'),
        }),
      ).toHaveAttribute('href', '/settlements/set-oct-2');
      // Not linked to a trainer profile: every trainer's trainings, no switch.
      await expect(
        page.getByRole('group', { name: t('dashboard.trainings.scope') }),
      ).toHaveCount(0);
      await expect(trainingRow(page, 's-evening')).toBeVisible();
    },
  );

  test(
    "a trainee sees what is left of their subscription and books today's training",
    { tag: ['@desktop', '@mobile'] },
    async ({ page, api, signInAs }) => {
      // 10:00 on Friday 13 Nov in Sofia.
      await page.clock.setFixedTime('2026-11-13T10:00:00+02:00');
      await signInAs('TRAINEE');
      api.on('GET', '/api/attendance/trainees/trainee-1', { body: [] });
      api.on('GET', '/api/trainees/trainee-1/subscriptions', {
        body: [
          {
            id: 'sub-1',
            traineeId: 'trainee-1',
            planId: 'p-8',
            type: 'PUNCH',
            status: 'ACTIVE',
            paidCents: 8000,
            startsAt: '2026-11-01',
            endsAt: null,
            initialCredits: 8,
            remainingCredits: 2,
          },
        ],
      });
      api.on('GET', '/api/plans', {
        body: [
          {
            id: 'p-8',
            type: 'PUNCH',
            title: 'Eight pack',
            priceCents: 8000,
            credits: 8,
            durationDays: null,
            durationMonths: null,
            isActive: true,
          },
        ],
      });
      api.on('GET', '/api/bookings/gyms', {
        body: [{ id: 'gym-c', name: 'Center', preferred: true }],
      });
      const evening18 = {
        id: 's-evening',
        date: TODAY,
        weekday: 5,
        trainingTime: { startTime: '18:00:00', endTime: '19:00:00' },
        trainer: { name: 'Velcho Sokolov', nickname: null },
        workout: null,
        workoutReleasesAt: '2026-11-12T18:00:00.000Z',
        startsAt: '2026-11-13T16:00:00.000Z',
        bookedCount: 4,
        bookedByMe: false,
        bookingClosesAt: '2026-11-13T15:30:00.000Z',
        cancelUntil: '2026-11-13T15:00:00.000Z',
        canBook: true,
        canCancel: false,
        gym: { id: 'gym-c', name: 'Center' },
      };
      api.on('GET', '/api/bookings/trainings', (request) => ({
        body: {
          from: request.query['from'],
          to: request.query['to'],
          slots: [evening18],
        },
      }));
      // The API answers a booking without the training's gym.
      const bookedAnswer: Partial<typeof evening18> = {
        ...evening18,
        bookedCount: 5,
        bookedByMe: true,
        canBook: false,
        canCancel: true,
      };
      delete bookedAnswer.gym;
      api.on('POST', '/api/bookings', { body: bookedAnswer });
      api.on('GET', '/api/bookings/trainings/s-evening', {
        body: {
          ...bookedAnswer,
          endsAt: '2026-11-13T17:00:00.000Z',
          calendarToken: null,
          gym: { id: 'gym-c', name: 'Center', address: null },
          workout: null,
        },
      });

      await page.goto('/home');

      const summary = page.getByTestId('subscription-summary');
      await expect(summary.getByTestId('subscription-credits')).toHaveText(
        t('traineeDashboard.summary.creditsLeft', { count: 2 }),
      );
      await expect(summary).toContainText(
        t('traineeDashboard.summary.advice.LOW'),
      );
      await expect
        .poll(() => api.last('GET', '/api/bookings/trainings')?.query)
        .toEqual({ from: TODAY, to: TOMORROW });
      const today = page.getByTestId(`upcoming-day-${TODAY}`);
      await expect(today).toContainText('Velcho Sokolov');
      // The whole week is one link away, on the trainees' Schedule.
      await expect(
        page.getByRole('link', {
          name: t('traineeDashboard.upcoming.fullSchedule'),
        }),
      ).toHaveAttribute('href', '/schedule');
      await expect(page.getByTestId(`upcoming-day-${TOMORROW}`)).toContainText(
        t('traineeDashboard.upcoming.none'),
      );

      await today
        .getByRole('button', {
          name: t('traineeSchedule.bookFor', {
            training: 'Friday, 13 November 18:00 – 19:00',
          }),
        })
        .click();
      await expect(page).toHaveURL(/\/schedule\/s-evening\/booked$/);
      expect(api.last('POST', '/api/bookings')?.body).toEqual({
        slotId: 's-evening',
      });
    },
  );
});
