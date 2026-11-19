import { Page } from '@playwright/test';
import { apiError } from '../support/api-mock';
import { gym, mockStaffHome, trainee, trainer } from '../support/data';
import { expect, test } from '../support/fixtures';
import { t } from '../support/i18n';

/**
 * TEST_PLAN.md J6: the API creates a report per half month; staff review it and an admin
 * finalizes it after confirming. Nobody creates or deletes one.
 */
const settlement = (
  id: string,
  periodStart: string,
  periodEnd: string,
  status: 'DRAFT' | 'FINAL',
) => ({
  id,
  periodStart,
  periodEnd,
  generatedAt: '2026-12-01T02:00:00Z',
  status,
  finalizedAt: status === 'FINAL' ? '2026-12-02T09:00:00Z' : null,
  notes: null,
});

const LINES = [
  {
    trainerId: 'trainer-1',
    amountCents: 9000,
    attendanceCount: 12,
    punchCents: 5000,
    timeCents: 4000,
    earlierPeriodsCents: 3000,
    earlierPeriodsCount: 1,
    waitingCount: 1,
  },
];
const WAITING = [
  {
    attendanceId: 'a9',
    trainerId: 'trainer-1',
    traineeId: 't-ivan',
    locationId: 'gym-1',
    trainedAt: '2026-11-20T16:30:00Z',
    reason: 'UNPAID',
    subscriptionType: null,
    availableFrom: null,
  },
];
const ALLOCATION = {
  id: 'al1',
  settlementId: 's-new',
  attendanceId: 'a1',
  trainerId: 'trainer-1',
  subscriptionId: 'sub1',
  subscriptionType: 'TIME',
  valueCents: 3000,
  reason: 'TIME_PRORATA',
  fromEarlierPeriod: true,
  attendance: {
    id: 'a1',
    trainedAt: '2026-11-05T16:30:00Z',
    paymentStatus: 'PAID',
    trainerId: 'trainer-1',
    traineeId: 't-ivan',
    subscriptionId: 'sub1',
    locationId: 'gym-1',
  },
};

const finalizeButton = (page: Page) =>
  page.getByRole('button', { name: t('settlements.details.finalize') });
/** The text before the first placeholder of a translation. */
const prefixOf = (key: string, params: Record<string, string>) =>
  t(key, params).split('PLACEHOLDER')[0];

test.describe('J6 settlements', { tag: '@desktop' }, () => {
  test.beforeEach(async ({ page, api }) => {
    await page.clock.setFixedTime(new Date('2026-12-02T10:00:00+02:00'));
    mockStaffHome(api);
    api.on('GET', '/api/trainers', {
      body: [
        trainer('trainer-1', 'Petar Petrov', 'Pepi'),
        trainer('trainer-2', 'Maria Koleva'),
      ],
    });
    api.on('GET', '/api/trainees', {
      body: [trainee('t-ivan', 'Ivan Petrov', 'Vanko')],
    });
    api.on('GET', '/api/gym-locations', { body: [gym('gym-1', 'Center')] });
    api.on('GET', '/api/settlements/s-new/allocations', {
      body: { total: 1, limit: 500, offset: 0, rows: [ALLOCATION] },
    });
  });

  test('an admin opens the automatic draft, reviews what it pays and what waits, and finalizes it', async ({
    page,
    api,
    signInAs,
  }) => {
    await signInAs('ADMIN');
    let draft = settlement('s-new', '2026-11-16', '2026-11-30', 'DRAFT');
    const old = settlement('s-old', '2026-11-01', '2026-11-15', 'FINAL');
    api.on('GET', '/api/settlements', () => ({ body: [draft, old] }));
    api.on('GET', '/api/settlements/s-new', () => ({
      body: {
        settlement: draft,
        lines: LINES,
        waiting: draft.status === 'DRAFT' ? WAITING : [],
      },
    }));
    api.on('POST', '/api/settlements/s-new/finalize', () => {
      draft = settlement('s-new', '2026-11-16', '2026-11-30', 'FINAL');
      return { status: 201, body: draft };
    });

    await page.goto('/settlements');
    const reports = page.getByRole('region', {
      name: t('settlements.list.tableLabel'),
    });
    await expect(reports.getByRole('link')).toHaveCount(2);
    // Nothing to create or delete: the page has no action of its own.
    await expect(page.getByRole('main').getByRole('button')).toHaveCount(0);
    await reports.getByRole('link').first().click();

    await expect(page).toHaveURL(/\/settlements\/s-new$/);
    await expect
      .poll(() => api.last('GET', '/api/settlements/s-new/allocations')?.query)
      .toEqual({ offset: '0', limit: '500' });
    await expect(page.getByTestId('settlement-status')).toHaveText(
      t('enums.settlementStatus.DRAFT'),
    );
    await expect(
      page.getByText(
        prefixOf('settlements.details.draftNoticeAdmin', {
          end: 'PLACEHOLDER',
        }),
      ),
    ).toBeVisible();

    // What it pays: a training carried over from the first half (its TIME pass ended).
    const paid = page.getByRole('region', {
      name: t('settlements.details.allocationsTable'),
    });
    await expect(paid.getByText('Ivan Petrov (Vanko)')).toBeVisible();
    await expect(
      paid.getByText(t('settlements.details.earlierPeriod')),
    ).toBeVisible();
    // What waits for a later report.
    const waiting = page.getByRole('region', {
      name: t('settlements.details.waitingTable'),
    });
    await expect(
      waiting.getByText(t('settlements.details.waitingUnpaid')),
    ).toBeVisible();

    await page
      .getByRole('combobox', { name: t('settlements.details.trainer') })
      .selectOption('trainer-2');
    await expect
      .poll(() => api.last('GET', '/api/settlements/s-new/allocations')?.query)
      .toEqual({ trainerId: 'trainer-2', offset: '0', limit: '500' });
    await expect(
      page.getByText(t('settlements.details.noWaiting')),
    ).toBeVisible();

    let question = '';
    page.once('dialog', (dialog) => {
      question = dialog.message();
      void dialog.accept();
    });
    await finalizeButton(page).click();

    await expect(page.getByTestId('settlement-status')).toHaveText(
      t('enums.settlementStatus.FINAL'),
    );
    expect(question).toContain(
      prefixOf('settlements.details.confirmFinalize', { start: 'PLACEHOLDER' }),
    );
    expect(api.last('POST', '/api/settlements/s-new/finalize')?.body).toEqual(
      {},
    );
    await expect(finalizeButton(page)).toHaveCount(0);
    await expect(
      page.getByText(t('settlements.details.finalizedAt'), { exact: true }),
    ).toBeVisible();
    expect(api.calls('GET', '/api/settlements/s-new')).toHaveLength(2);
  });

  test('cancelling the confirmation finalizes nothing; a refused finalize shows why', async ({
    page,
    api,
    signInAs,
  }) => {
    await signInAs('ADMIN');
    const draft = settlement('s-new', '2026-11-16', '2026-11-30', 'DRAFT');
    api.on('GET', '/api/settlements/s-new', {
      body: { settlement: draft, lines: LINES, waiting: [] },
    });
    api.on(
      'POST',
      '/api/settlements/s-new/finalize',
      apiError(409, 'Finalize the report for 2026-11-01 to 2026-11-15 first'),
    );

    await page.goto('/settlements/s-new');
    page.once('dialog', (dialog) => void dialog.dismiss());
    await finalizeButton(page).click();
    expect(api.calls('POST', '/api/settlements/s-new/finalize')).toHaveLength(
      0,
    );

    page.once('dialog', (dialog) => void dialog.accept());
    await finalizeButton(page).click();

    await expect(page.getByRole('alert')).toHaveText(
      'Finalize the report for 2026-11-01 to 2026-11-15 first',
    );
    await expect(page.getByTestId('settlement-status')).toHaveText(
      t('enums.settlementStatus.DRAFT'),
    );
    await expect(finalizeButton(page)).toBeVisible();
  });

  test('a trainer can read reports, drafts included, but not filter or finalize', async ({
    page,
    api,
    signInAs,
  }) => {
    await signInAs('TRAINER');
    const draft = settlement('s-new', '2026-11-16', '2026-11-30', 'DRAFT');
    api.on('GET', '/api/settlements', { body: [draft] });
    api.on('GET', '/api/settlements/s-new', {
      body: { settlement: draft, lines: LINES, waiting: WAITING },
    });

    await page.goto('/settlements');
    await page
      .getByRole('region', { name: t('settlements.list.tableLabel') })
      .getByRole('link')
      .first()
      .click();

    await expect(page.getByTestId('settlement-status')).toHaveText(
      t('enums.settlementStatus.DRAFT'),
    );
    await expect(
      page.getByText(t('settlements.details.draftNoticeTrainer')),
    ).toBeVisible();
    await expect(finalizeButton(page)).toHaveCount(0);
    await expect(
      page.getByRole('combobox', { name: t('settlements.details.trainer') }),
    ).toHaveCount(0);
  });
});
