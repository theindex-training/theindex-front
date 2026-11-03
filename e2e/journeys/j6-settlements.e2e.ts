import { Page } from '@playwright/test';
import { apiError } from '../support/api-mock';
import { gym, mockStaffHome, trainee, trainer } from '../support/data';
import { expect, test } from '../support/fixtures';
import { t } from '../support/i18n';

/** TEST_PLAN.md J6: generate, review, finalize and delete a settlement. */
const settlement = (id: string, periodStart: string, periodEnd: string, status: 'DRAFT' | 'FINAL') => ({
  id,
  periodStart,
  periodEnd,
  generatedAt: '2026-11-02T08:00:00Z',
  status,
  notes: null
});

const LINES = [
  { id: 'l1', settlementId: 's-new', trainerId: 'trainer-1', amountCents: 9000, attendanceCount: 12, unpaidAttendanceCount: 1, details: { punchCents: 5000, timeCents: 4000 } }
];
const ALLOCATION = {
  id: 'al1',
  settlementId: 's-new',
  attendanceId: 'a1',
  trainerId: 'trainer-1',
  subscriptionId: 'sub1',
  subscriptionType: 'PUNCH',
  valueCents: 450,
  reason: 'PUNCH_CREDIT',
  attendance: { id: 'a1', trainedAt: '2026-10-05T16:30:00Z', paymentStatus: 'PAID', trainerId: 'trainer-1', traineeId: 't-ivan', subscriptionId: 'sub1', locationId: 'gym-1' }
};

/** "Delete settlement …" buttons, whatever the period. */
const deleteButtons = (page: Page) => {
  const prefix = t('settlements.list.deleteLabel', { start: 'START', end: 'END' }).split('START')[0];
  return page.getByRole('button', { name: new RegExp(`^${prefix}`) });
};

test.describe('J6 settlements', { tag: '@desktop' }, () => {
  test.beforeEach(async ({ page, api }) => {
    await page.clock.setFixedTime(new Date('2026-11-02T10:00:00+02:00'));
    mockStaffHome(api);
    api.on('GET', '/api/trainers', { body: [trainer('trainer-1', 'Petar Petrov', 'Pepi'), trainer('trainer-2', 'Maria Koleva')] });
    api.on('GET', '/api/trainees', { body: [trainee('t-ivan', 'Ivan Petrov', 'Vanko')] });
    api.on('GET', '/api/gym-locations', { body: [gym('gym-1', 'Center')] });
    api.on('GET', '/api/settlements/s-new/allocations', { body: { total: 1, limit: 500, offset: 0, rows: [ALLOCATION] } });
  });

  test('an admin generates a report, reviews it, finalizes it, and deletes an old one', async ({ page, api, signInAs }) => {
    await signInAs('ADMIN');
    let generated: ReturnType<typeof settlement> | null = null;
    let deleted = false;
    const old = settlement('s-old', '2026-09-01', '2026-09-30', 'FINAL');
    api.on('GET', '/api/settlements', () => ({ body: [...(generated ? [generated] : []), ...(deleted ? [] : [old])] }));
    api.on('POST', '/api/settlements', request => {
      const { periodStart, periodEnd } = request.body as { periodStart: string; periodEnd: string };
      generated = settlement('s-new', periodStart, periodEnd, 'DRAFT');
      return { status: 201, body: { settlement: generated, lines: LINES } };
    });
    api.on('GET', '/api/settlements/s-new', () => ({ body: { settlement: generated, lines: LINES } }));
    api.on('POST', '/api/settlements/s-new/finalize', () => {
      generated = { ...generated!, status: 'FINAL' };
      return { status: 201, body: generated };
    });
    api.on('DELETE', '/api/settlements/s-old', () => {
      deleted = true;
      return { body: null };
    });

    await page.goto('/settlements');
    await page.getByRole('link', { name: t('settlements.list.generate') }).first().click();
    await expect(page).toHaveURL(/\/settlements\/new$/);

    const start = page.getByLabel(t('settlements.generate.periodStart'));
    const end = page.getByLabel(t('settlements.generate.periodEnd'));
    await expect(start).toHaveValue('2026-11-02');
    await expect(end).toHaveValue('2026-11-02');
    await start.fill('2026-10-01');
    await end.fill('2026-10-31');
    await page.getByRole('button', { name: t('settlements.generate.submit') }).click();

    await expect(page).toHaveURL(/\/settlements\/s-new$/);
    expect(api.last('POST', '/api/settlements')?.body).toEqual({ periodStart: '2026-10-01', periodEnd: '2026-10-31' });
    await expect.poll(() => api.last('GET', '/api/settlements/s-new/allocations')?.query).toEqual({ offset: '0', limit: '500' });
    expect(api.last('GET', '/api/gym-locations')?.query).toEqual({ includeInactive: 'true' });
    await expect(page.getByTestId('settlement-status')).toHaveText(t('enums.settlementStatus.DRAFT'));
    await expect(page.getByText('Ivan Petrov (Vanko)').first()).toBeVisible();

    await page.getByRole('combobox', { name: t('settlements.details.trainer') }).selectOption('trainer-2');
    await expect.poll(() => api.last('GET', '/api/settlements/s-new/allocations')?.query).toEqual({
      trainerId: 'trainer-2',
      offset: '0',
      limit: '500'
    });

    await page.getByRole('button', { name: t('settlements.details.finalize') }).click();
    await expect(page.getByTestId('settlement-status')).toHaveText(t('enums.settlementStatus.FINAL'));
    await expect(page.getByRole('button', { name: t('settlements.details.finalize') })).toHaveCount(0);
    expect(api.last('POST', '/api/settlements/s-new/finalize')?.body).toEqual({});

    await page.goto('/settlements');
    await expect(deleteButtons(page)).toHaveCount(2);
    page.once('dialog', dialog => void dialog.accept());
    await deleteButtons(page).last().click();
    await expect(deleteButtons(page)).toHaveCount(1);
    expect(api.calls('DELETE', '/api/settlements/s-old')).toHaveLength(1);
  });

  test('a failed delete keeps the list and explains why', async ({ page, api, signInAs }) => {
    await signInAs('ADMIN');
    api.on('GET', '/api/settlements', { body: [settlement('s-old', '2026-09-01', '2026-09-30', 'FINAL')] });
    api.on('DELETE', '/api/settlements/s-old', apiError(409, 'A final settlement cannot be deleted'));

    await page.goto('/settlements');
    page.once('dialog', dialog => void dialog.accept());
    await deleteButtons(page).click();

    await expect(page.getByRole('alert')).toHaveText('A final settlement cannot be deleted');
    await expect(deleteButtons(page)).toHaveCount(1);
  });

  test('a trainer can read reports but not generate, filter, finalize or delete', async ({ page, api, signInAs }) => {
    await signInAs('TRAINER');
    const draft = settlement('s-new', '2026-10-01', '2026-10-31', 'DRAFT');
    api.on('GET', '/api/settlements', { body: [draft] });
    api.on('GET', '/api/settlements/s-new', { body: { settlement: draft, lines: LINES } });

    await page.goto('/settlements');
    await expect(deleteButtons(page)).toHaveCount(0);
    await expect(page.getByRole('link', { name: t('settlements.list.generate') })).toHaveCount(0);

    await page.goto('/settlements/s-new');
    await expect(page.getByTestId('settlement-status')).toHaveText(t('enums.settlementStatus.DRAFT'));
    await expect(page.getByRole('button', { name: t('settlements.details.finalize') })).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: t('settlements.details.trainer') })).toHaveCount(0);
  });
});
