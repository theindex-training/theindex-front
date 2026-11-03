import { Page } from '@playwright/test';
import { apiError } from '../support/api-mock';
import { plan } from '../support/data';
import { expect, test } from '../support/fixtures';
import { t } from '../support/i18n';

/** TEST_PLAN.md J9: an admin manages the plan catalog. */
test.describe('J9 plan catalog', { tag: '@desktop' }, () => {
  const field = (page: Page, key: string) => page.getByLabel(t(key), { exact: true });

  async function filterBy(page: Page, option: string) {
    await page.getByRole('group', { name: t('common.status') }).getByText(option, { exact: true }).click();
  }

  test('filters, creates a punch card, switches it to time-based and deactivates it', async ({ page, api, signInAs }) => {
    await signInAs('ADMIN');
    let current = plan('p-new', '10 visits', { priceCents: 4550, credits: 10 });
    api.on('GET', '/api/plans', { body: [plan('p1', 'Drop-in', { priceCents: 1500, credits: 1 })] });
    api.on('POST', '/api/plans', { status: 201, body: current });
    api.on('GET', '/api/plans/p-new', () => ({ body: current }));
    api.on('PATCH', '/api/plans/p-new', request => {
      current = { ...current, ...(request.body as object) };
      return { body: current };
    });
    api.on('DELETE', '/api/plans/p-new', () => {
      current = { ...current, isActive: false };
      return { body: current };
    });

    // The status filter maps to ?active=.
    await page.goto('/plans');
    await expect(page.getByTestId('list-count')).toHaveText(t('plans.list.count', { count: 1 }));
    expect(api.last('GET', '/api/plans')?.query).toEqual({});
    await filterBy(page, t('common.active'));
    await expect.poll(() => api.last('GET', '/api/plans')?.query).toEqual({ active: 'true' });
    await filterBy(page, t('common.inactive'));
    await expect.poll(() => api.last('GET', '/api/plans')?.query).toEqual({ active: 'false' });

    // Create a punch card: credits are required.
    await page.getByRole('link', { name: t('plans.list.new') }).first().click();
    await field(page, 'plans.fields.title').fill('10 visits');
    await field(page, 'plans.fields.priceEur').fill('45.5');
    await page.getByRole('button', { name: t('plans.create.submit') }).click();
    await expect(page.getByText(t('plans.fields.wholeNumberError'))).toBeVisible();
    expect(api.calls('POST', '/api/plans')).toHaveLength(0);

    await field(page, 'plans.fields.credits').fill('10');
    await page.getByRole('button', { name: t('plans.create.submit') }).click();
    await expect(page).toHaveURL(/\/plans$/);
    expect(api.last('POST', '/api/plans')?.body).toEqual({
      type: 'PUNCH',
      title: '10 visits',
      priceCents: 4550,
      isActive: true,
      credits: 10
    });

    // Open it, switch it to 30 days.
    await page.goto('/plans/p-new');
    await page.getByRole('link', { name: t('plans.details.edit') }).click();
    await expect(page).toHaveURL(/\/plans\/p-new\/edit$/);
    await field(page, 'plans.fields.planType').selectOption('TIME');
    await expect(field(page, 'plans.fields.credits')).toHaveCount(0);
    await field(page, 'plans.fields.duration').fill('30');
    await page.getByRole('button', { name: t('common.saveChanges') }).click();

    await expect(page).toHaveURL(/\/plans$/);
    expect(api.last('PATCH', '/api/plans/p-new')?.body).toEqual({
      type: 'TIME',
      title: '10 visits',
      priceCents: 4550,
      isActive: true,
      credits: null,
      durationDays: 30
    });

    // Deactivate it.
    await page.goto('/plans/p-new');
    await page.getByRole('link', { name: t('plans.details.deactivate') }).click();
    await page.getByRole('button', { name: t('plans.delete.submit') }).click();
    await expect(page).toHaveURL(/\/plans$/);
    expect(api.calls('DELETE', '/api/plans/p-new')).toHaveLength(1);
  });

  test('shows a failed save and lets the user try again', async ({ page, api, signInAs }) => {
    await signInAs('ADMIN');
    api.on('POST', '/api/plans', apiError(400, 'A plan with this title already exists'));

    await page.goto('/plans/new');
    await field(page, 'plans.fields.title').fill('10 visits');
    await field(page, 'plans.fields.credits').fill('10');
    await field(page, 'plans.fields.priceEur').fill('45');
    await page.getByRole('button', { name: t('plans.create.submit') }).click();

    // The S1 fix (PR 3): the error renders and the button is usable again.
    await expect(page.getByRole('alert')).toHaveText('A plan with this title already exists');
    await expect(page.getByRole('button', { name: t('plans.create.submit') })).toBeEnabled();
    await expect(page).toHaveURL(/\/plans\/new$/);
  });
});
