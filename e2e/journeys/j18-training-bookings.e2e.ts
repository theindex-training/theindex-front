import { gym, mockStaffHome, trainee, trainer } from '../support/data';
import { expect, test } from '../support/fixtures';
import { t } from '../support/i18n';

/**
 * J18: who booked a training. A trainer opens today's training from the Schedule tab, sees who
 * booked it (each a link to the trainee) with what they would have left after it, then opens
 * Register attendance from it: the training and the booked trainees are filled in, and nothing
 * is saved before the usual review.
 */
test.describe('J18 training bookings', () => {
  /** Friday 13 Nov 2026, 17:00 in Sofia: today's training starts at 18:00. */
  const NOW = '2026-11-13T17:00:00+02:00';
  const evening = { id: 'tt-18', startTime: '18:00:00', endTime: '19:00:00' };
  const velcho = trainer('tr-velcho', 'Velcho Sokolov');
  const slotTrainer = {
    id: velcho.id,
    name: velcho.name,
    nickname: null,
    isActive: true,
  };
  const slot = {
    id: 's-fri',
    date: '2026-11-13',
    weekday: 5,
    trainingTime: evening,
    trainer: slotTrainer,
    workout: { id: 'w-fran', title: 'Fran' },
    bookedCount: 3,
  };
  const booked = (
    traineeId: string,
    name: string,
    level: string,
    subscription: object | null,
  ) => ({
    traineeId,
    name,
    nickname: null,
    isActive: true,
    bookedAt: '2026-11-10T08:00:00Z',
    attendanceSaved: false,
    paymentStatus: subscription ? 'PAID' : 'UNPAID',
    level,
    subscription: subscription && {
      type: 'PUNCH',
      planTitle: '16 trainings',
      remainingCredits: null,
      endsAt: null,
      daysLeft: null,
      ...subscription,
    },
  });
  const training = {
    ...slot,
    // The whole workout, as trainees see it.
    workout: {
      id: 'w-fran',
      title: 'Fran',
      summary: '21-15-9\nThrusters\nPull-ups',
      exercises: [
        {
          id: 'ex-thruster',
          name: 'Thruster',
          description: 'Front squat into a push press.',
          videoUrl: 'https://www.youtube.com/watch?v=L219ltL15zk',
        },
      ],
    },
    gym: { id: 'gym-c', name: 'Center' },
    weekStart: '2026-11-09',
    startsAt: '2026-11-13T16:00:00Z',
    trainees: [
      booked('t-cveta', 'Cveta Ilieva', 'UNPAID', null),
      booked('t-dimo', 'Dimo Petrov', 'LAST', { remainingCredits: 0 }),
      booked('t-ana', 'Ana Koleva', 'OK', { remainingCredits: 7 }),
    ],
  };

  test(
    "a trainer sees who booked today's training and registers its attendance from it",
    { tag: ['@desktop', '@mobile'] },
    async ({ page, api, signInAs }) => {
      await page.clock.setFixedTime(NOW);
      await signInAs('TRAINER', { trainerProfileId: 'tr-other' });
      mockStaffHome(api);
      api.on('GET', '/api/gym-locations', {
        body: [gym('gym-c', 'Center'), gym('gym-s', 'South')],
      });
      api.on('GET', '/api/training-times', { body: [evening] });
      api.on('GET', '/api/trainers', {
        body: [trainer('tr-other', 'Maria'), velcho],
      });
      api.on('GET', '/api/schedules', {
        body: {
          gym: { id: 'gym-c', name: 'Center' },
          weekStart: '2026-11-09',
          weekEnd: '2026-11-15',
          editableFrom: '2026-11-14',
          week: { id: 'week-1', createdAt: '2026-11-08T10:00:00Z' },
          slots: [slot],
        },
      });
      api.on('GET', '/api/workouts', { body: [] });
      api.on('GET', '/api/schedules/slots/s-fri', { body: training });
      api.on('GET', '/api/trainees', {
        body: [
          trainee('t-ana', 'Ana Koleva'),
          trainee('t-boris', 'Boris Ivanov'),
          trainee('t-cveta', 'Cveta Ilieva'),
          trainee('t-dimo', 'Dimo Petrov'),
        ],
      });
      api.on('POST', '/api/attendance/batch/preview', {
        body: {
          trainerId: 'tr-velcho',
          locationId: 'gym-c',
          trainedAt: '2026-11-13T16:00:00.000Z',
          count: 0,
          trainees: [],
        },
      });

      // Today's training is read-only, but it still opens its page.
      await page.goto('/workouts/schedule?gym=gym-c&week=2026-11-09');
      await page
        .getByRole('link', {
          name: t('schedules.days.detailsFor', {
            slot: 'Friday, 13 November 18:00 – 19:00 Velcho Sokolov',
          }),
        })
        .click();
      await expect(page).toHaveURL(/\/workouts\/schedule\/s-fri$/);
      await expect(page.getByRole('heading', { name: 'Fran' })).toBeVisible();

      // Who booked, each a link to the trainee, with what they would have left after it.
      const booked = page.getByRole('list', {
        name: t('schedules.training.traineesLabel'),
      });
      await expect(booked.getByRole('listitem')).toHaveCount(3);
      await expect(
        booked.getByRole('link', { name: /Cveta Ilieva/ }),
      ).toHaveAttribute('href', '/trainees/t-cveta');
      await expect(
        booked.getByRole('link', { name: /Dimo Petrov/ }),
      ).toContainText(t('attendance.register.summary.lastTraining'));
      await expect(
        booked.getByRole('link', { name: /Ana Koleva/ }),
      ).toContainText(t('schedules.training.leftAfter', { count: 7 }));
      await expect(page.getByTestId('schedule-training-projection')).toHaveText(
        t('schedules.training.projectionNote'),
      );

      // The workout as trainees see it: the summary, then the exercises with their videos.
      await expect(page.getByTestId('training-workout-summary')).toHaveText(
        '21-15-9\nThrusters\nPull-ups',
      );
      await expect(
        page.getByTestId('training-exercise-ex-thruster').getByRole('button', {
          name: t('traineeTraining.playVideo', { name: 'Thruster' }),
        }),
      ).toBeVisible();

      await page.getByTestId('schedule-training-register').click();
      await expect(page).toHaveURL(/\/attendance\/new\?/);
      await expect(page.getByTestId('attendance-from-training')).toHaveText(
        t('attendance.register.fromTraining', { count: 3 }),
      );
      for (const name of ['Ana Koleva', 'Cveta Ilieva', 'Dimo Petrov']) {
        await expect(page.getByRole('checkbox', { name })).toBeChecked();
      }
      await expect(
        page.getByRole('checkbox', { name: 'Boris Ivanov' }),
      ).not.toBeChecked();
      // Dimo didn't come.
      await page.getByText('Dimo Petrov').click();

      await page
        .getByRole('button', { name: t('attendance.register.review') })
        .click();
      await expect
        .poll(() => api.last('POST', '/api/attendance/batch/preview')?.body)
        .toEqual({
          trainerId: 'tr-velcho',
          locationId: 'gym-c',
          traineeIds: ['t-ana', 't-cveta'],
          trainedDate: '2026-11-13',
          trainedTime: '18:00',
        });
      expect(api.calls('POST', '/api/attendance/batch')).toHaveLength(0);
    },
  );

  test(
    "a trainee can't open a training's bookings",
    { tag: '@desktop' },
    async ({ page, api, signInAs }) => {
      await signInAs('TRAINEE', { traineeProfileId: 'trainee-1' });
      api.on('GET', /\/api\//, { body: [] });

      await page.goto('/workouts/schedule/s-fri');

      await expect(page).not.toHaveURL(/\/workouts/);
      expect(api.calls('GET', '/api/schedules/slots/s-fri')).toHaveLength(0);
    },
  );
});
