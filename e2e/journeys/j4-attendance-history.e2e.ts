import { Page } from '@playwright/test';
import { mockStaffHome, sessionsResponse, trainer } from '../support/data';
import { expect, test } from '../support/fixtures';
import { t } from '../support/i18n';

/** TEST_PLAN.md J4: review and correct attendance history. */
const attendee = (
  id: string,
  traineeId: string,
  paymentStatus: 'PAID' | 'UNPAID',
  priceCents: number,
  isFinal: boolean,
) => ({
  id,
  trainedAt: '2026-11-01T16:30:00Z',
  paymentStatus,
  traineeId,
  subscriptionId: null,
  price: {
    priceCents,
    calculation: 'punch',
    subscriptionType: 'PUNCH',
    isFinal,
  },
});

const session = (
  key: string,
  trainerId: string,
  start: string,
  end: string,
  attendance: ReturnType<typeof attendee>[],
) => ({
  sessionKey: key,
  date: start.slice(0, 10),
  start,
  end,
  trainerId,
  locationId: 'gym-1',
  attendance,
  totals: {
    count: attendance.length,
    paid: attendance.filter((item) => item.paymentStatus === 'PAID').length,
    unpaid: attendance.filter((item) => item.paymentStatus === 'UNPAID').length,
  },
});

const SESSIONS = sessionsResponse(
  [
    session(
      'mine',
      'trainer-1',
      '2026-11-01T16:30:00Z',
      '2026-11-01T17:30:00Z',
      [
        attendee('a1', 'ivan', 'PAID', 450, true),
        attendee('a2', 'georgi', 'UNPAID', 999, false),
      ],
    ),
    session(
      'other',
      'trainer-other',
      '2026-10-30T06:00:00Z',
      '2026-10-30T07:00:00Z',
      [attendee('a3', 'ivan', 'PAID', 600, true)],
    ),
  ],
  {
    trainees: [
      { id: 'ivan', name: 'Ivan Petrov', nickname: 'Vanko' },
      { id: 'georgi', name: 'Georgi Dimitrov', nickname: null },
    ],
    trainers: [
      { id: 'trainer-1', name: 'Petar', nickname: 'Pepi' },
      { id: 'trainer-other', name: 'Maria', nickname: null },
    ],
  },
);

const summary = async (page: Page) =>
  Promise.all(
    ['sessions', 'attendance', 'paid', 'unpaid', 'total'].map((name) =>
      page.getByTestId(`attendance-summary-${name}`).innerText(),
    ),
  );
const deleteButtons = (page: Page, name: string) =>
  page.getByRole('button', {
    name: t('attendance.sessions.deleteLabel', { name }),
  });

test.describe('J4 attendance history', () => {
  test.beforeEach(async ({ page, api }) => {
    await page.clock.setFixedTime(new Date('2026-11-02T10:00:00+02:00'));
    mockStaffHome(api);
    api.on('GET', '/api/attendance/sessions', { body: SESSIONS });
    api.on('GET', '/api/trainers', {
      body: [
        trainer('trainer-1', 'Petar', 'Pepi'),
        trainer('trainer-other', 'Maria'),
      ],
    });
    api.on('DELETE', /^\/api\/attendance\/a\d$/, { body: null });
  });

  test(
    'an admin reviews every session, filters and deletes an attendee',
    { tag: '@desktop' },
    async ({ page, api, signInAs }) => {
      await signInAs('ADMIN');
      await page.goto('/attendance');

      await expect
        .poll(() => api.last('GET', '/api/trainers')?.query)
        .toEqual({ active: 'true' });
      await expect
        .poll(() => api.last('GET', '/api/attendance/sessions')?.query)
        .toEqual({
          startDate: '2026-10-26',
          endDate: '2026-11-02',
        });
      await expect(page.getByRole('button', { pressed: true })).toHaveCount(2);
      await expect
        .poll(() => summary(page))
        .toEqual(['2', '3', '2', '1', '€10.50']);

      // Only the final prices count: the unpaid, not-final attendee adds nothing.
      await page.getByRole('button', { pressed: true }).last().click();
      await expect
        .poll(() => summary(page))
        .toEqual(['1', '2', '1', '1', '€4.50']);

      await page.getByRole('button', { pressed: true }).click();
      await expect(
        page.getByText(t('attendance.sessions.selectHint')),
      ).toBeVisible();
      await page
        .getByRole('button', { name: t('attendance.sessions.apply') })
        .click();
      await expect(page.getByRole('button', { pressed: true })).toHaveCount(2);

      await page
        .getByLabel(t('attendance.register.trainer'))
        .selectOption('trainer-1');
      await page
        .getByRole('button', { name: t('attendance.sessions.apply') })
        .click();
      await expect
        .poll(() => api.last('GET', '/api/attendance/sessions')?.query)
        .toEqual({
          startDate: '2026-10-26',
          endDate: '2026-11-02',
          trainerId: 'trainer-1',
        });

      page.once('dialog', (dialog) => {
        expect(dialog.message()).toContain('Georgi Dimitrov');
        void dialog.dismiss();
      });
      await deleteButtons(page, 'Georgi Dimitrov').click();
      expect(api.calls('DELETE', /^\/api\/attendance\//)).toHaveLength(0);

      page.once('dialog', (dialog) => void dialog.accept());
      await deleteButtons(page, 'Georgi Dimitrov').click();
      await expect(deleteButtons(page, 'Georgi Dimitrov')).toHaveCount(0);
      expect(api.calls('DELETE', '/api/attendance/a2')).toHaveLength(1);
      await expect
        .poll(() => summary(page))
        .toEqual(['2', '2', '2', '0', '€10.50']);
    },
  );

  test(
    'a trainer sees only their own sessions and can delete only there',
    { tag: '@desktop' },
    async ({ page, api, signInAs }) => {
      await signInAs('TRAINER', { trainerProfileId: 'trainer-1' });
      await page.goto('/attendance');

      await expect
        .poll(() => api.last('GET', '/api/attendance/sessions')?.query)
        .toEqual({
          startDate: '2026-10-26',
          endDate: '2026-11-02',
          trainerId: 'trainer-1',
        });
      expect(api.calls('GET', '/api/trainers')).toHaveLength(0);
      await expect(
        page.getByLabel(t('attendance.register.trainer')),
      ).toHaveCount(0);
      // The fixture still contains another trainer's session; only "mine" offers delete buttons.
      await expect(deleteButtons(page, 'Ivan Petrov')).toHaveCount(1);
      await expect(deleteButtons(page, 'Georgi Dimitrov')).toHaveCount(1);
    },
  );

  test(
    'on a phone, attendees are listed with their own delete buttons',
    { tag: '@mobile' },
    async ({ page, api, signInAs }) => {
      await signInAs('ADMIN');
      await page.goto('/attendance');

      await expect(deleteButtons(page, 'Ivan Petrov')).toHaveCount(2);
      page.once('dialog', (dialog) => void dialog.accept());
      await deleteButtons(page, 'Ivan Petrov').first().click();
      await expect(deleteButtons(page, 'Ivan Petrov')).toHaveCount(1);
      expect(api.calls('DELETE', /^\/api\/attendance\//)).toHaveLength(1);
    },
  );
});
