import { Page } from '@playwright/test';
import { expect, test } from '../support/fixtures';
import { t } from '../support/i18n';

/** TEST_PLAN.md J7: an admin records a manual cash movement. Role access is checked in J2. */
const transaction = (
  id: string,
  type: string,
  amountCents: number,
  balanceAfterCents: number,
) => ({
  id,
  type,
  amountCents,
  balanceAfterCents,
  sourceType: 'MANUAL',
  sourceId: null,
  notes: null,
  createdAt: '2026-11-01T10:00:00Z',
  sourceDetails: null,
});

/** A `GET /api/cash-register` answer: the balance and the first page of transactions. */
const register = (
  balanceCents: number,
  transactions: ReturnType<typeof transaction>[],
) => ({
  balanceCents,
  total: transactions.length,
  limit: 50,
  offset: 0,
  transactions,
});

test.describe('J7 cash register', { tag: ['@desktop', '@mobile'] }, () => {
  const amount = (page: Page) => page.getByLabel(t('cashRegister.amount'));
  const notes = (page: Page) => page.getByLabel(t('cashRegister.notes'));
  const direction = (page: Page) =>
    page.getByLabel(t('cashRegister.direction'));
  const add = (page: Page) =>
    page.getByRole('button', { name: t('cashRegister.add') });

  test('shows the balance, validates the amount and records a payout', async ({
    page,
    api,
    signInAs,
  }) => {
    await signInAs('ADMIN');
    let balanceCents = 12_345;
    api.on('GET', '/api/cash-register', () => ({
      body: register(balanceCents, [
        transaction('t1', 'MANUAL_IN', 12_345, 12_345),
      ]),
    }));
    api.on('POST', '/api/cash-register/transactions/manual', (request) => {
      const { amountCents } = request.body as { amountCents: number };
      balanceCents -= amountCents;
      return {
        status: 201,
        body: transaction('t2', 'MANUAL_OUT', amountCents, balanceCents),
      };
    });

    await page.goto('/cash-register');
    await expect(page.getByTestId('cash-register-balance')).toHaveText(
      '€123.45',
    );
    expect(api.last('GET', '/api/cash-register')?.query).toEqual({
      offset: '0',
      limit: '50',
    });

    for (const invalid of ['0', '12.345']) {
      await amount(page).fill(invalid);
      await add(page).click();
      await expect(page.getByText(t('cashRegister.amountError'))).toBeVisible();
    }
    expect(
      api.calls('POST', '/api/cash-register/transactions/manual'),
    ).toHaveLength(0);

    await direction(page).selectOption('OUT');
    // 19.99 × 100 is 1998.9999999999998 in floating point: only proper rounding gives 1999.
    await amount(page).fill('19.99');
    await notes(page).fill('  float top-up  ');
    await add(page).click();

    await expect(
      page.getByRole('status').filter({ hasText: t('cashRegister.created') }),
    ).toBeVisible();
    expect(
      api.last('POST', '/api/cash-register/transactions/manual')?.body,
    ).toEqual({
      direction: 'OUT',
      amountCents: 1999,
      notes: 'float top-up',
    });
    await expect(page.getByTestId('cash-register-balance')).toHaveText(
      '€103.46',
    );
    expect(api.calls('GET', '/api/cash-register')).toHaveLength(2);
    await expect(direction(page)).toHaveValue('IN');
    await expect(amount(page)).toHaveValue('0');
    await expect(notes(page)).toHaveValue('');
  });

  test('sends no notes key when the notes are blank', async ({
    page,
    api,
    signInAs,
  }) => {
    await signInAs('ADMIN');
    api.on('GET', '/api/cash-register', {
      body: register(0, []),
    });
    api.on('POST', '/api/cash-register/transactions/manual', {
      status: 201,
      body: transaction('t1', 'MANUAL_IN', 2000, 2000),
    });

    await page.goto('/cash-register');
    await amount(page).fill('20');
    await notes(page).fill('   ');
    await add(page).click();

    await expect
      .poll(
        () => api.last('POST', '/api/cash-register/transactions/manual')?.body,
      )
      .toEqual({
        direction: 'IN',
        amountCents: 2000,
      });
  });

  test('shows a negative balance', async ({ page, api, signInAs }) => {
    await signInAs('ADMIN');
    api.on('GET', '/api/cash-register', {
      body: register(-2050, []),
    });

    await page.goto('/cash-register');

    await expect(page.getByTestId('cash-register-balance')).toHaveText(
      '-€20.50',
    );
  });

  test('a long history is paged: the API sends each page, and the page stays in the address', async ({
    page,
    api,
    signInAs,
  }) => {
    await signInAs('ADMIN');
    const total = 4812;
    api.on('GET', '/api/cash-register', (request) => {
      const offset = Number(request.query['offset']);
      const limit = Number(request.query['limit']);
      return {
        body: {
          balanceCents: 500_000,
          total,
          limit,
          offset,
          transactions: Array.from(
            { length: Math.min(limit, total - offset) },
            (_, i) =>
              transaction(`t${offset + i}`, 'MANUAL_IN', 100, 500_000 - i),
          ),
        },
      };
    });
    api.on('POST', '/api/cash-register/transactions/manual', {
      status: 201,
      body: transaction('t-new', 'MANUAL_IN', 2000, 502_000),
    });

    await page.goto('/cash-register');
    const pages = page.getByRole('navigation', {
      name: t('cashRegister.transactionsPages'),
    });
    await expect(page.getByTestId('list-count')).toHaveText(
      '1–50 of 4,812 transactions',
    );

    await pages
      .getByRole('button', { name: t('common.pagination.next') })
      .click();
    await expect(page).toHaveURL(/\/cash-register\?page=2$/);
    await expect(page.getByTestId('list-count')).toHaveText(
      '51–100 of 4,812 transactions',
    );
    expect(api.last('GET', '/api/cash-register')?.query).toEqual({
      offset: '50',
      limit: '50',
    });

    await pages.getByLabel(t('common.pagination.perPage')).selectOption('100');
    await expect(page).toHaveURL(/\/cash-register\?size=100$/);
    // Phones show "2 / 49" instead of the numbered pages: step with Next.
    const next = pages.getByRole('button', {
      name: t('common.pagination.next'),
    });
    await next.click();
    await expect(page).toHaveURL(/\?page=2&size=100$/);
    await next.click();
    await expect(page).toHaveURL(/\?page=3&size=100$/);

    // A reload (or going back from a trainee) shows the same page.
    await page.reload();
    await expect(page.getByTestId('list-count')).toHaveText(
      '201–300 of 4,812 transactions',
    );

    // A new transaction is the newest: the page goes back to the first page.
    await amount(page).fill('20');
    await add(page).click();
    await expect(page).toHaveURL(/\/cash-register\?size=100$/);
    await expect(page.getByTestId('list-count')).toHaveText(
      '1–100 of 4,812 transactions',
    );
    expect(api.last('GET', '/api/cash-register')?.query).toEqual({
      offset: '0',
      limit: '100',
    });
  });
});
