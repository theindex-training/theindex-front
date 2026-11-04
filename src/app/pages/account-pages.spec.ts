import { Type } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import en from '../../../public/i18n/en.json';
import { PageDriver, apiError, driver } from '../../testing/dom';
import { signInAs } from '../../testing/jwt';
import { TraineeAccountComponent } from './trainees/trainee-account.component';
import { TrainerAccountComponent } from './trainers/trainer-account.component';

/**
 * Trainee and trainer account pages (TEST_PLAN.md §5). The two components share their code and
 * differ in the profile they load and the role they create, so one table covers both.
 */
interface AccountCase {
  component: Type<unknown>;
  profileType: 'trainee' | 'trainer';
  role: 'TRAINEE' | 'TRAINER';
  profileUrl: string;
  detailsUrl: string;
  fieldPrefix: string;
  errors: { createError: string; updateError: string; deactivateError: string };
}

const CASES: [string, AccountCase][] = [
  [
    'trainee',
    {
      component: TraineeAccountComponent,
      profileType: 'trainee',
      role: 'TRAINEE',
      profileUrl: '/api/trainees/p1',
      detailsUrl: '/trainees/p1',
      fieldPrefix: '#trainee-account',
      errors: en.trainees.account,
    },
  ],
  [
    'trainer',
    {
      component: TrainerAccountComponent,
      profileType: 'trainer',
      role: 'TRAINER',
      profileUrl: '/api/trainers/p1',
      detailsUrl: '/trainers/p1',
      fieldPrefix: '#trainer-account',
      errors: en.trainers.account,
    },
  ],
];

const ACCOUNT = {
  id: 'acc1',
  email: 'old@gym.test',
  role: 'TRAINEE',
  status: 'ACTIVE',
};

describe.each(CASES)('%s account page', (_, testCase) => {
  let http: HttpTestingController;
  let router: Router;
  let harness: RouterTestingHarness;
  let page: PageDriver;

  const field = (name: 'email' | 'password' | 'confirm-password') =>
    `${testCase.fieldPrefix}-${name}`;
  const profile = (accountId: string | null) => ({
    id: 'p1',
    name: 'Ivan Petrov',
    nickname: null,
    phone: null,
    accountId,
    isActive: true,
  });

  beforeEach(async () => {
    localStorage.clear();
    signInAs('ADMIN');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          {
            path: `${testCase.profileType}s/:id/account`,
            component: testCase.component,
          },
          { path: '**', children: [] },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => http.verify());

  async function open(account: 'none' | 'linked' | 'load-error' | 'null') {
    await harness.navigateByUrl(`/${testCase.profileType}s/p1/account`);
    page = driver(
      () => harness.routeNativeElement!,
      () => harness.fixture.whenStable(),
    );
    http
      .expectOne(testCase.profileUrl)
      .flush(profile(account === 'none' ? null : 'acc1'));
    if (account !== 'none') {
      const req = http.expectOne('/api/accounts/acc1');
      if (account === 'load-error') {
        const error = apiError(undefined, 500);
        req.flush(error.body, error.options);
      } else {
        req.flush(account === 'null' ? null : ACCOUNT);
      }
    }
    await page.settle();
  }

  async function fill(
    email: string | null,
    password: string,
    confirm = password,
  ) {
    if (email !== null) await page.type(field('email'), email);
    await page.type(field('password'), password);
    await page.type(field('confirm-password'), confirm);
  }

  const help = (name: 'password' | 'confirm-password') =>
    page.query(`${field(name)}-help`)?.textContent?.trim();

  async function settleOn(url: string) {
    await page.settle();
    expect(router.url).toBe(url);
  }

  describe('without an account (create)', () => {
    beforeEach(() => open('none'));

    it('requires a password, at least 8 characters, typed twice', async () => {
      await page.type(field('email'), 'ivan@gym.test');
      await page.submit();
      http.expectNone(() => true);
      expect(help('password')).toBe(en.accounts.passwordRequired);
      expect(help('confirm-password')).toBe(en.accounts.repeatPassword);

      await fill(null, 'short');
      await page.submit();
      http.expectNone(() => true);
      expect(help('password')).toBe(en.accounts.passwordLength);

      await fill(null, 'long-enough', 'long-enougH');
      await page.submit();
      http.expectNone(() => true);
      expect(help('confirm-password')).toBe(en.accounts.passwordsMismatch);
    });

    it('requires a valid email', async () => {
      await fill('not-an-email', 'password1');
      await page.submit();

      http.expectNone(() => true);
      expect(page.query(field('email'))!.getAttribute('aria-invalid')).toBe(
        'true',
      );
    });

    it(`creates an active ${testCase.role} account and returns to the profile`, async () => {
      // The email input sanitizes away outer spaces itself; the component trims as well.
      await fill(' Ivan@Gym.test ', 'password1');
      await page.submit();

      const req = http.expectOne(`/api/accounts/${testCase.profileType}/p1`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        email: 'Ivan@Gym.test',
        role: testCase.role,
        status: 'ACTIVE',
        password: 'password1',
        confirmPassword: 'password1',
      });
      req.flush({ ...ACCOUNT, role: testCase.role });
      await settleOn(testCase.detailsUrl);
    });

    it('shows the API error, or the fallback', async () => {
      await fill('ivan@gym.test', 'password1');
      await page.submit();
      const error = apiError('Email already in use', 409);
      http
        .expectOne(`/api/accounts/${testCase.profileType}/p1`)
        .flush(error.body, error.options);
      await page.settle();
      expect(page.alert()).toBe('Email already in use');

      await page.submit();
      const fallback = apiError(undefined, 500);
      http
        .expectOne(`/api/accounts/${testCase.profileType}/p1`)
        .flush(fallback.body, fallback.options);
      await page.settle();
      expect(page.alert()).toBe(testCase.errors.createError);
    });

    it('has no deactivate button', () => {
      expect(
        page
          .queryAll('button')
          .some(
            (button) => button.textContent?.trim() === en.accounts.deactivate,
          ),
      ).toBe(false);
    });
  });

  describe('with a linked account (manage)', () => {
    beforeEach(() => open('linked'));

    it('fills in the email and lets the password stay blank', async () => {
      expect(page.query<HTMLInputElement>(field('email'))!.value).toBe(
        'old@gym.test',
      );

      await page.type(field('email'), 'new@gym.test');
      await page.submit();

      const req = http.expectOne('/api/accounts/acc1');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ email: 'new@gym.test' });
      req.flush(ACCOUNT);
      await settleOn(testCase.detailsUrl);
    });

    it('sends a new password only when one is typed, with the same rules', async () => {
      await fill(null, 'short');
      await page.submit();
      http.expectNone(() => true);
      expect(help('password')).toBe(en.accounts.passwordLength);

      await fill(null, 'new-password');
      await page.submit();
      expect(http.expectOne('/api/accounts/acc1').request.body).toEqual({
        email: 'old@gym.test',
        password: 'new-password',
        confirmPassword: 'new-password',
      });
    });

    it('deactivates the account without asking, and returns to the profile', async () => {
      const deactivate = page
        .queryAll('button')
        .find(
          (button) => button.textContent?.trim() === en.accounts.deactivate,
        )!;
      deactivate.click();
      deactivate.click();
      await page.settle();

      // Only one request, even after a double click. There is no confirm dialog (unlike other
      // destructive actions); see TEST_PLAN.md "Also note".
      const req = http.expectOne('/api/accounts/acc1');
      expect(req.request.method).toBe('DELETE');
      req.flush(ACCOUNT);
      await settleOn(testCase.detailsUrl);
    });

    it('shows a failed deactivation', async () => {
      page
        .queryAll('button')
        .find(
          (button) => button.textContent?.trim() === en.accounts.deactivate,
        )!
        .click();
      await page.settle();
      const error = apiError(undefined, 500);
      http.expectOne('/api/accounts/acc1').flush(error.body, error.options);
      await page.settle();

      expect(page.alert()).toBe(testCase.errors.deactivateError);
    });
  });

  it.each(['load-error', 'null'] as const)(
    'falls back to "create" when the linked account cannot be loaded (%s)',
    async (state) => {
      await open(state);

      // CHARACTERIZATION: possibly unintended — the profile has an account, but a failed (or empty)
      // account load leaves the page in create mode, so saving would provision a second account.
      // TEST_NOTES.md S8.
      expect(
        page
          .queryAll('button')
          .some((button) => button.textContent?.trim() === en.accounts.create),
      ).toBe(true);
      await fill('ivan@gym.test', 'password1');
      await page.submit();
      expect(
        http.expectOne(`/api/accounts/${testCase.profileType}/p1`).request
          .method,
      ).toBe('POST');
    },
  );

  it('shows the profile load error', async () => {
    await harness.navigateByUrl(`/${testCase.profileType}s/p1/account`);
    page = driver(
      () => harness.routeNativeElement!,
      () => harness.fixture.whenStable(),
    );
    const error = apiError('Profile not found', 404);
    http.expectOne(testCase.profileUrl).flush(error.body, error.options);
    await page.settle();

    expect(page.alert()).toBe('Profile not found');
  });
});
