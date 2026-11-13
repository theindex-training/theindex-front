import { gym, mockStaffHome, plan, trainee } from '../support/data';
import { expect, test } from '../support/fixtures';
import { t } from '../support/i18n';

/** TEST_PLAN.md J5: a new trainee gets a profile, a subscription and an app account. */
test(
  'J5 new trainee: profile, subscription, app account',
  { tag: '@desktop' },
  async ({ page, api, signInAs }) => {
    await page.clock.setFixedTime(new Date('2026-11-02T10:00:00+02:00'));
    await signInAs('ADMIN');
    mockStaffHome(api);

    // State the fake API keeps across the flow.
    const existing = [
      trainee('t-georgi', 'Georgi Ivanov', 'Gosho'),
      trainee('t-maria', 'Maria Koleva'),
    ];
    let created: ReturnType<typeof trainee> | null = null;
    let subscriptions: object[] = [];
    api.on('GET', '/api/gym-subscriptions', {
      body: [{ id: 'gs1', name: 'Multisport', isActive: true }],
    });
    api.on('GET', '/api/gym-locations', {
      body: [gym('g1', 'Center'), gym('g2', 'North')],
    });
    api.on('GET', '/api/trainees', () => ({
      body: created ? [...existing, created] : existing,
    }));
    api.on('POST', '/api/trainees', (request) => {
      created = trainee('t-new', 'Ivan Petrov', null, {
        gymSubscriptionId: 'gs1',
      });
      return { status: 201, body: { ...created, ...(request.body as object) } };
    });
    api.on('GET', '/api/trainees/t-new', () => ({ body: created }));
    api.on('GET', '/api/trainees/t-new/subscriptions', () => ({
      body: subscriptions,
    }));
    api.on('GET', '/api/attendance/trainees/t-new', { body: [] });
    api.on('GET', '/api/plans', {
      body: [
        plan('p1', '10 visits'),
        plan('p2', 'Monthly', {
          type: 'TIME',
          priceCents: 6000,
          credits: null,
          durationDays: 30,
        }),
      ],
    });
    api.on('POST', '/api/trainees/t-new/subscriptions', (request) => {
      subscriptions = [
        {
          id: 's-new',
          traineeId: 't-new',
          planId: 'p2',
          type: 'TIME',
          status: 'ACTIVE',
          paidCents: (request.body as { paidCents: number }).paidCents,
          startsAt: '2026-11-02',
          endsAt: '2026-12-02',
          initialCredits: null,
          remainingCredits: null,
        },
      ];
      return { status: 201, body: subscriptions[0] };
    });
    api.on('DELETE', '/api/subscriptions/s-new', () => {
      subscriptions = [];
      return { body: { deleted: true } };
    });
    api.on('POST', '/api/accounts/trainee/t-new', (request) => {
      created = { ...created!, accountId: 'acc-new' };
      return {
        status: 201,
        body: { id: 'acc-new', ...(request.body as object) },
      };
    });
    api.on('GET', '/api/accounts/acc-new', {
      body: {
        id: 'acc-new',
        email: 'ivan@gym.test',
        role: 'TRAINEE',
        status: 'ACTIVE',
      },
    });

    // 1. The list, then a new trainee.
    await page.goto('/trainees');
    await expect(page.getByTestId('list-count')).toHaveText(
      t('trainees.list.count', { shown: 2, total: 2 }),
    );
    expect(api.last('GET', '/api/trainees')?.query).toEqual({});
    expect(
      api
        .calls('GET', '/api/gym-subscriptions')
        .map((request) => request.query),
    ).toContainEqual({ includeInactive: 'true' });

    await page.getByRole('link', { name: t('trainees.list.new') }).click();
    await expect(page).toHaveURL(/\/trainees\/new$/);
    await page
      .getByRole('button', { name: t('trainees.create.submit') })
      .click();
    await expect(page.getByText(t('trainees.fields.nameError'))).toBeVisible();
    expect(api.calls('POST', '/api/trainees')).toHaveLength(0);

    await page
      .getByRole('textbox', { name: t('trainees.fields.name'), exact: true })
      .fill('  Ivan Petrov ');
    await page
      .getByLabel(t('trainees.fields.gymSubscription'))
      .selectOption({ label: 'Multisport' });
    await page
      .getByLabel(t('trainees.fields.preferredGym'))
      .selectOption({ label: 'North' });
    await page
      .getByRole('button', { name: t('trainees.create.submit') })
      .click();

    await expect(page).toHaveURL(/\/trainees$/);
    expect(api.last('POST', '/api/trainees')?.body).toEqual({
      name: 'Ivan Petrov',
      nickname: null,
      phone: null,
      gymSubscriptionId: 'gs1',
      isActive: true,
      preferredGymId: 'g2',
    });

    // 2. Find them and open the profile.
    await page
      .getByRole('searchbox', { name: t('trainees.list.searchLabel') })
      .fill('petrov');
    await expect(page.getByTestId('list-count')).toHaveText(
      t('trainees.list.count', { shown: 1, total: 3 }),
    );
    await page.getByRole('link', { name: 'Ivan Petrov' }).click();
    await expect(page).toHaveURL(/\/trainees\/t-new$/);
    await expect
      .poll(() => api.last('GET', '/api/plans')?.query)
      .toEqual({ active: 'true' });

    // 3. Sell a subscription: the price follows the plan until it is changed.
    const planSelect = page.getByLabel(t('trainees.details.plan'), {
      exact: true,
    });
    const paid = page.getByLabel(t('trainees.details.paid'));
    await expect(planSelect).toHaveValue('p1');
    await expect(paid).toHaveValue('45.5');
    await planSelect.selectOption('p2');
    await expect(paid).toHaveValue('60');
    await expect(page.getByLabel(t('trainees.details.startsAt'))).toHaveValue(
      '2026-11-02',
    );
    await paid.fill('40.5');
    await page
      .getByRole('button', { name: t('trainees.details.buySubmit') })
      .click();

    await expect(
      page.getByRole('button', {
        name: t('subscriptions.deleteLabel', { plan: 'Monthly' }),
      }),
    ).toBeVisible();
    expect(api.last('POST', '/api/trainees/t-new/subscriptions')?.body).toEqual(
      {
        planId: 'p2',
        startsAt: '2026-11-02',
        paidCents: 4050,
      },
    );
    expect(api.calls('GET', '/api/trainees/t-new/subscriptions')).toHaveLength(
      2,
    );

    // 4. Delete it again.
    page.once('dialog', (dialog) => {
      expect(dialog.message()).toContain('Monthly');
      void dialog.accept();
    });
    await page
      .getByRole('button', {
        name: t('subscriptions.deleteLabel', { plan: 'Monthly' }),
      })
      .click();
    await expect(
      page.getByText(t('trainees.details.noActiveSubscriptions')),
    ).toBeVisible();
    expect(api.calls('DELETE', '/api/subscriptions/s-new')).toHaveLength(1);

    // 5. Give them an app account.
    await page
      .getByRole('link', { name: t('trainees.details.createAccount') })
      .click();
    await expect(page).toHaveURL(/\/trainees\/t-new\/account$/);
    const email = page.getByLabel(t('accounts.email'), { exact: true });
    const password = page.getByLabel(t('accounts.password'), { exact: true });
    const confirm = page.getByLabel(t('accounts.confirmPassword'), {
      exact: true,
    });

    await email.fill('ivan@gym.test');
    await password.fill('short');
    await confirm.fill('short');
    await page.getByRole('button', { name: t('accounts.create') }).click();
    await expect(page.getByText(t('accounts.passwordLength'))).toBeVisible();

    await password.fill('long-enough-1');
    await confirm.fill('long-enough-2');
    await page.getByRole('button', { name: t('accounts.create') }).click();
    await expect(page.getByText(t('accounts.passwordsMismatch'))).toBeVisible();
    expect(api.calls('POST', '/api/accounts/trainee/t-new')).toHaveLength(0);

    await confirm.fill('long-enough-1');
    await page.getByRole('button', { name: t('accounts.create') }).click();

    await expect(page).toHaveURL(/\/trainees\/t-new$/);
    expect(api.last('POST', '/api/accounts/trainee/t-new')?.body).toEqual({
      email: 'ivan@gym.test',
      role: 'TRAINEE',
      status: 'ACTIVE',
      password: 'long-enough-1',
      confirmPassword: 'long-enough-1',
    });
    await expect(page.getByText('ivan@gym.test')).toBeVisible();
    await expect(
      page.getByRole('link', { name: t('trainees.details.manageAccount') }),
    ).toBeVisible();
  },
);
