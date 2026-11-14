import { apiError } from '../support/api-mock';
import { expect, test } from '../support/fixtures';
import { t } from '../support/i18n';

const OPTIONS = {
  gyms: [
    { id: 'gym-1', name: 'Center' },
    { id: 'gym-2', name: 'Lozenets' },
  ],
  gymSubscriptions: [{ id: 'gs-1', name: 'MultiSport' }],
};

const WAITING = {
  id: 'acc-1',
  email: 'ivan@example.com',
  role: 'TRAINEE',
  status: 'ACTIVE',
  createdAt: '2026-11-10T08:00:00.000Z',
  consentAt: '2026-11-10T08:00:00.000Z',
  registration: {
    name: 'Ivan Petrov',
    phone: '+359 88 123 4567',
    gymSubscription: null,
    preferredGym: { id: 'gym-2', name: 'Lozenets' },
    instagram: '@ivan',
    facebook: null,
    tiktok: null,
  },
  profile: null,
};

/** TEST_PLAN.md J19: people register themselves; an admin connects the account to a profile. */
test.describe('J19 self-registration', () => {
  test(
    'a visitor registers from the sign-in page, and a sign-in before the connection is explained',
    { tag: ['@desktop', '@mobile'] },
    async ({ page, api }) => {
      api.on('GET', '/api/auth/register/options', { body: OPTIONS });
      api.on('POST', '/api/auth/register', {
        status: 201,
        body: { id: 'acc-1', email: 'ivan@example.com', role: 'TRAINEE' },
      });
      api.on(
        'POST',
        '/api/auth/login',
        apiError(403, 'Your account is not connected to a profile yet.'),
      );

      await page.goto('/login');
      await page
        .getByRole('link', { name: t('auth.login.createAccount') })
        .click();
      await expect(page).toHaveURL(/\/register$/);

      await page
        .getByLabel(t('register.name'), { exact: true })
        .fill('Ivan Petrov');
      await page
        .getByLabel(t('register.email'), { exact: true })
        .fill('ivan@example.com');
      await page
        .getByLabel(t('register.password'), { exact: true })
        .fill('my-pass-123');
      await page
        .getByLabel(t('register.confirmPassword'), { exact: true })
        .fill('my-pass-123');
      await page
        .getByLabel(t('contact.phone'), { exact: true })
        .fill('+359 88 123 4567');
      await page
        .getByLabel(t('contact.preferredGym'))
        .selectOption({ label: 'Lozenets' });
      await page
        .getByLabel(t('contact.networks.instagram'), { exact: true })
        .fill('@ivan');

      // Without the consent nothing is sent.
      const create = page.getByRole('button', { name: t('register.submit') });
      await create.click();
      await expect(page.getByText(t('register.consentRequired'))).toBeVisible();
      expect(api.calls('POST', '/api/auth/register')).toHaveLength(0);

      await page.getByLabel(t('register.consent'), { exact: true }).check();
      await create.click();

      await expect(page.getByTestId('register-done')).toContainText(
        t('register.doneMessage', { email: 'ivan@example.com' }),
      );
      expect(api.last('POST', '/api/auth/register')?.body).toEqual({
        email: 'ivan@example.com',
        password: 'my-pass-123',
        confirmPassword: 'my-pass-123',
        name: 'Ivan Petrov',
        phone: '+359 88 123 4567',
        gymSubscriptionId: null,
        preferredGymId: 'gym-2',
        instagram: '@ivan',
        facebook: null,
        tiktok: null,
        acceptTerms: true,
      });

      await page.getByRole('link', { name: t('register.toSignIn') }).click();
      await page
        .getByLabel(t('auth.login.email'), { exact: true })
        .fill('ivan@example.com');
      await page
        .getByLabel(t('auth.login.password'), { exact: true })
        .fill('my-pass-123');
      await page.getByRole('button', { name: t('auth.login.submit') }).click();
      await expect(page.getByRole('alert')).toHaveText(
        t('auth.login.notLinked'),
      );
      await expect(page).toHaveURL(/\/login$/);
    },
  );

  test(
    'an admin connects the waiting account to the trainee who already exists, seeing what differs',
    { tag: ['@desktop', '@mobile'] },
    async ({ page, api, signInAs }) => {
      api.on('GET', '/api/accounts', { body: [WAITING] });
      api.on('GET', '/api/accounts/acc-1/details', { body: WAITING });
      api.on('GET', '/api/auth/register/options', { body: OPTIONS });
      api.on('GET', '/api/trainees', {
        body: [
          {
            id: 'trainee-9',
            name: 'Иван Петров',
            nickname: 'Vanko',
            phone: '0899 000 111',
            accountId: null,
            gymSubscriptionId: null,
            preferredGymId: 'gym-2',
            isActive: true,
          },
          {
            id: 'trainee-3',
            name: 'Maria',
            nickname: null,
            phone: null,
            accountId: null,
            gymSubscriptionId: null,
            isActive: true,
          },
        ],
      });
      api.on('POST', '/api/accounts/acc-1/link', (request) => ({
        body: {
          ...WAITING,
          profile: {
            type: 'trainee',
            id: 'trainee-9',
            name: (request.body as { name: string }).name,
            nickname: 'Vanko',
            isActive: true,
          },
        },
      }));
      await signInAs('ADMIN');

      await page.goto('/accounts');
      await expect
        .poll(() => api.last('GET', '/api/accounts')?.query)
        .toEqual({ link: 'unlinked' });
      await page.getByRole('link', { name: 'Ivan Petrov' }).first().click();
      await expect(page).toHaveURL(/\/accounts\/acc-1$/);

      // Existing profile is the default; the list is loaded with the page.
      const form = page.getByTestId('account-connect');
      await expect(
        form.getByRole('radio', {
          name: t('accountsAdmin.connect.existingProfile'),
        }),
      ).toBeChecked();
      // Only the list until a profile is picked.
      await expect(
        form.getByLabel(t('accountsAdmin.fields.name'), { exact: true }),
      ).toHaveCount(0);
      await expect(
        form.getByRole('button', { name: t('accountsAdmin.connect.submit') }),
      ).toHaveCount(0);
      await form
        .getByRole('combobox', {
          name: t('accountsAdmin.connect.pickTrainee'),
          exact: true,
        })
        .selectOption('trainee-9');

      // The form shows what they registered; the profile's other values are under the fields.
      const name = form.getByLabel(t('accountsAdmin.fields.name'), {
        exact: true,
      });
      await expect(name).toHaveValue('Ivan Petrov');
      await expect(
        form.getByLabel(t('accountsAdmin.fields.nickname')),
      ).toHaveValue('Vanko');
      await expect(form.getByTestId('account-link-differences')).toContainText(
        t('accountsAdmin.connect.differences', { count: 2 }).slice(0, 10),
      );
      await expect(form.getByTestId('field-difference')).toHaveCount(2);
      await expect(
        form.getByText(
          t('contact.difference.inProfile', { value: '0899 000 111' }),
        ),
      ).toBeVisible();

      // Keep the registered name, take the profile's phone.
      await form
        .getByRole('button', {
          name: t('contact.difference.useLabel', { value: '0899 000 111' }),
        })
        .click();
      await expect(form.getByLabel(t('contact.phone'))).toHaveValue(
        '0899 000 111',
      );
      await form
        .getByRole('button', { name: t('accountsAdmin.connect.submit') })
        .click();

      await expect(page.getByTestId('account-profile')).toBeVisible();
      expect(api.last('POST', '/api/accounts/acc-1/link')?.body).toEqual({
        profileType: 'trainee',
        profileId: 'trainee-9',
        name: 'Ivan Petrov',
        nickname: 'Vanko',
        phone: '0899 000 111',
        gymSubscriptionId: null,
        homeGymId: 'gym-2',
        instagram: '@ivan',
        facebook: null,
        tiktok: null,
      });
      await expect(
        page
          .getByTestId('account-profile')
          .getByRole('link', { name: t('accountsAdmin.details.openProfile') }),
      ).toHaveAttribute('href', '/trainees/trainee-9');
    },
  );
});
