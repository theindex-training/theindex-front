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
      body: {
        balanceCents,
        transactions: [transaction('t1', 'MANUAL_IN', 12_345, 12_345)],
      },
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
      body: { balanceCents: 0, transactions: [] },
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
      body: { balanceCents: -2050, transactions: [] },
    });

    await page.goto('/cash-register');

    await expect(page.getByTestId('cash-register-balance')).toHaveText(
      '-€20.50',
    );
  });
});
