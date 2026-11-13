import { Page } from '@playwright/test';
import { gym, mockStaffHome, trainer } from '../support/data';
import { expect, test } from '../support/fixtures';
import { t } from '../support/i18n';

/**
 * J16: weekly schedules. An admin sets up a gym's usual week from the gym's page; a trainer
 * creates this week's schedule from it with one button and adds a training to a later day, with
 * a new training time and the day's workout. Today and earlier days stay read-only.
 */
test.describe('J16 schedules', () => {
  /** Tuesday 10 Nov 2026, 10:00 in Sofia: the week is 9-15 Nov, Wednesday the first editable day. */
  const NOW = '2026-11-10T10:00:00+02:00';
  const morning = {
    id: 'tt-morning',
    startTime: '07:10:00',
    endTime: '08:10:00',
  };
  const lunch = { id: 'tt-lunch', startTime: '12:30:00', endTime: '13:30:00' };
  const velcho = trainer('tr-velcho', 'Velcho Sokolov');
  const vasko = trainer('tr-vasko', 'Vasko');
  const center = gym('gym-c', 'Center');
  const slotTrainer = (t: typeof velcho) => ({
    id: t.id,
    name: t.name,
    nickname: null,
    isActive: true,
  });
  const templateSlot = (weekday: number) => ({
    id: `ts-${weekday}`,
    weekday,
    trainingTime: morning,
    trainer: slotTrainer(velcho),
  });
  const helen = {
    id: 'w-thu',
    date: '2026-11-12',
    title: 'Helen',
    summary: 'Run',
    exercises: [],
    sourcePdf: null,
  };

  const sections = (page: Page) =>
    page.getByRole('navigation', { name: t('workouts.nav.label') });

  test(
    "an admin sets up a gym's weekly template from the gym's page",
    { tag: ['@desktop', '@mobile'] },
    async ({ page, api, signInAs }) => {
      await signInAs('ADMIN');
      const template = {
        gym: { id: 'gym-c', name: 'Center' },
        slots: [templateSlot(1)],
      };
      api.on('GET', '/api/gym-locations/gym-c', { body: center });
      api.on('GET', '/api/schedule-templates/gym-c', () => ({
        body: api.calls('POST', '/api/schedule-templates/gym-c/slots').length
          ? {
              ...template,
              slots: [
                ...template.slots,
                {
                  ...templateSlot(3),
                  trainingTime: lunch,
                  trainer: slotTrainer(vasko),
                },
              ],
            }
          : template,
      }));
      api.on('GET', '/api/training-times', { body: [morning] });
      api.on('GET', '/api/trainers', { body: [velcho, vasko] });
      api.on('POST', '/api/schedule-templates/gym-c/slots', {
        status: 201,
        body: { ...templateSlot(3), trainingTime: lunch },
      });

      await page.goto('/gyms/gym-c');
      await page
        .getByRole('link', { name: t('schedules.template.open') })
        .click();
      await expect(page).toHaveURL(/\/gyms\/gym-c\/schedule$/);
      await expect(
        page.getByRole('heading', {
          name: t('schedules.template.titleFor', { gym: 'Center' }),
        }),
      ).toBeVisible();

      await page
        .getByRole('button', {
          name: t('schedules.days.addFor', { day: 'Wednesday' }),
        })
        .click();
      const form = page.getByRole('form', {
        name: t('schedules.days.addFor', { day: 'Wednesday' }),
      });
      await form
        .getByLabel(t('schedules.slot.trainingTime'))
        .selectOption({ label: t('schedules.slot.newTime') });
      await form.getByLabel(t('schedules.slot.startTime')).fill('12:30');
      await form.getByLabel(t('schedules.slot.endTime')).fill('13:30');
      await form
        .getByLabel(t('schedules.slot.trainer'))
        .selectOption({ label: 'Vasko' });
      // Saving adds the new training time; the form says so first.
      await expect(form.getByRole('status')).toHaveText(
        t('schedules.slot.newTimeNotice', { range: '12:30 – 13:30' }),
      );
      await form
        .getByRole('button', { name: t('schedules.slot.save') })
        .click();

      await expect
        .poll(
          () => api.last('POST', '/api/schedule-templates/gym-c/slots')?.body,
        )
        .toEqual({
          trainingTime: { startTime: '12:30', endTime: '13:30' },
          weekday: 3,
          trainerId: 'tr-vasko',
        });
      await expect(page.getByTestId('schedule-template-count')).toHaveText(
        t('schedules.template.count', { count: 2 }),
      );
      await expect(
        page.getByTestId('schedule-day-3').getByText('12:30 – 13:30'),
      ).toBeVisible();
    },
  );

  test(
    "a trainer creates this week's schedule as a draft from the template, adds a training and publishes it",
    { tag: ['@desktop', '@mobile'] },
    async ({ page, api, signInAs }) => {
      await page.clock.setFixedTime(NOW);
      await signInAs('TRAINER');
      mockStaffHome(api);
      const created = () => api.calls('POST', '/api/schedules').length > 0;
      const added = () =>
        api.calls('POST', '/api/schedules/week-1/slots').length > 0;
      const published = () =>
        api.calls('POST', '/api/schedules/week-1/publish').length > 0;
      const weekSlot = (id: string, date: string, extra: object = {}) => ({
        id,
        date,
        weekday: 0,
        trainingTime: morning,
        trainer: slotTrainer(velcho),
        workout: null,
        ...extra,
      });
      const week = () => ({
        gym: { id: 'gym-c', name: 'Center' },
        weekStart: '2026-11-09',
        weekEnd: '2026-11-15',
        editableFrom: '2026-11-11',
        week: created()
          ? {
              id: 'week-1',
              createdAt: NOW,
              status: published() ? 'PUBLISHED' : 'DRAFT',
              publishedAt: published() ? NOW : null,
            }
          : null,
        slots: created()
          ? [
              weekSlot('s-mon', '2026-11-09'),
              weekSlot('s-wed', '2026-11-11'),
              ...(added()
                ? [
                    weekSlot('s-new', '2026-11-12', {
                      trainingTime: lunch,
                      trainer: slotTrainer(vasko),
                      workout: { id: 'w-thu', title: 'Helen' },
                    }),
                  ]
                : []),
            ]
          : [],
      });
      api.on('GET', '/api/gym-locations', { body: [center] });
      api.on('GET', '/api/training-times', () => ({
        body: added() ? [morning, lunch] : [morning],
      }));
      api.on('GET', '/api/trainers', { body: [velcho, vasko] });
      api.on('GET', '/api/schedules', () => ({ body: week() }));
      api.on('GET', '/api/schedule-templates/gym-c', {
        body: {
          gym: { id: 'gym-c', name: 'Center' },
          slots: [templateSlot(1), templateSlot(3)],
        },
      });
      api.on('POST', '/api/schedules', () => ({ status: 201, body: week() }));
      api.on('GET', '/api/workouts', { body: [helen] });
      api.on('POST', '/api/schedules/week-1/slots', {
        status: 201,
        body: weekSlot('s-new', '2026-11-12'),
      });
      api.on('POST', '/api/schedules/week-1/publish', () => ({
        body: week(),
      }));

      // Schedule is the first tab of the workouts area.
      await page.goto('/workouts');
      await expect(sections(page).getByRole('link').first()).toHaveText(
        t('workouts.nav.schedule'),
      );
      await sections(page)
        .getByRole('link', { name: t('workouts.nav.schedule') })
        .click();
      await expect(page).toHaveURL(/\/workouts\/schedule/);

      await page
        .getByRole('button', { name: t('schedules.week.create') })
        .click();
      await expect
        .poll(() => api.last('POST', '/api/schedules')?.body)
        .toEqual({ gymId: 'gym-c', week: '2026-11-09' });
      // A draft: trainees don't see it until it is published.
      await expect(page.getByTestId('schedule-draft')).toContainText(
        t('schedules.week.draftTitle'),
      );

      // Monday and Tuesday (today) are read-only; Wednesday can change.
      const monday = page.getByTestId('schedule-day-2026-11-09');
      await expect(monday.getByText('07:10 – 08:10')).toBeVisible();
      await expect(monday.getByRole('button')).toHaveCount(0);
      await expect(
        page.getByTestId('schedule-day-2026-11-10').getByRole('button'),
      ).toHaveCount(0);
      await expect(
        page.getByTestId('schedule-day-2026-11-11').getByRole('button', {
          name: t('schedules.days.removeFor', {
            slot: 'Wednesday, 11 November 07:10 – 08:10 Velcho Sokolov',
          }),
        }),
      ).toBeVisible();

      const thursday = t('schedules.days.addFor', {
        day: 'Thursday, 12 November',
      });
      await page.getByRole('button', { name: thursday }).click();
      const form = page.getByRole('form', { name: thursday });
      await form
        .getByLabel(t('schedules.slot.trainingTime'))
        .selectOption({ label: t('schedules.slot.newTime') });
      await form.getByLabel(t('schedules.slot.startTime')).fill('12:30');
      await form.getByLabel(t('schedules.slot.endTime')).fill('13:30');
      await form
        .getByLabel(t('schedules.slot.trainer'))
        .selectOption({ label: 'Vasko' });
      await form
        .getByLabel(t('schedules.slot.workout'), { exact: false })
        .selectOption({ label: 'Helen' });
      await form
        .getByRole('button', { name: t('schedules.slot.save') })
        .click();

      await expect
        .poll(() => api.last('POST', '/api/schedules/week-1/slots')?.body)
        .toEqual({
          trainingTime: { startTime: '12:30', endTime: '13:30' },
          date: '2026-11-12',
          trainerId: 'tr-vasko',
          workoutId: 'w-thu',
        });
      const thursdayDay = page.getByTestId('schedule-day-2026-11-12');
      await expect(thursdayDay.getByText('12:30 – 13:30')).toBeVisible();
      await expect(thursdayDay.getByText('Helen')).toBeVisible();

      // Reviewed: publish it for trainees.
      page.once('dialog', (dialog) => void dialog.accept());
      await page
        .getByRole('button', { name: t('schedules.week.publish') })
        .click();
      await expect
        .poll(() => api.calls('POST', '/api/schedules/week-1/publish').length)
        .toBe(1);
      await expect(page.getByTestId('schedule-published')).toHaveText(
        t('schedules.week.publishedHint'),
      );
      await expect(page.getByTestId('schedule-draft')).toHaveCount(0);
      await expect(
        page.getByRole('button', { name: t('schedules.week.publish') }),
      ).toHaveCount(0);
    },
  );

  test(
    'a trainee has no way into the schedules',
    { tag: '@desktop' },
    async ({ page, api, signInAs }) => {
      await signInAs('TRAINEE', { traineeProfileId: 'trainee-1' });
      api.on('GET', /\/api\//, { body: [] });

      await page.goto('/workouts/schedule');

      await expect(page).not.toHaveURL(/\/workouts/);
      expect(api.calls('GET', '/api/schedules')).toHaveLength(0);
    },
  );
});
