import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import en from '../../../../public/i18n/en.json';
import { PageDriver, apiError, driver } from '../../../testing/dom';
import { makeToken, signInAs } from '../../../testing/jwt';
import { setupGuard } from '../../guards/setup.guard';
import { AccountSetup } from '../../services/account-setup.service';
import { AccountSetupComponent } from './account-setup.component';

const OPTIONS = {
  gyms: [
    { id: 'gym-1', name: 'Center' },
    { id: 'gym-2', name: 'Lozenets' },
  ],
  gymSubscriptions: [{ id: 'gs-1', name: 'MultiSport' }],
};

/** What an admin entered for a trainee, as `GET /api/account-setup` answers it. */
const TRAINEE_SETUP: AccountSetup = {
  profileType: 'trainee',
  setupRequired: true,
  passwordChangeRequired: true,
  email: 'Ivan@Example.com',
  name: 'Ivan Petrov',
  phone: '0888 111 222',
  gymSubscriptionId: 'gs-1',
  homeGymId: 'gym-2',
  instagram: '@ivan',
  facebook: null,
  tiktok: null,
};

describe('AccountSetupComponent', () => {
  let http: HttpTestingController;
  let router: Router;
  let harness: RouterTestingHarness;
  let page: PageDriver;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'account-setup', component: AccountSetupComponent },
          { path: '**', children: [] },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => http.verify());

  async function open(
    setup: AccountSetup | 'error' = TRAINEE_SETUP,
    role: 'TRAINEE' | 'TRAINER' = 'TRAINEE',
  ) {
    signInAs(role, { setupRequired: true });
    await harness.navigateByUrl('/account-setup', AccountSetupComponent);
    page = driver(
      () => harness.routeNativeElement!,
      () => harness.fixture.whenStable(),
    );
    http.expectOne('/api/auth/register/options').flush(OPTIONS);
    const req = http.expectOne('/api/account-setup');
    expect(req.request.method).toBe('GET');
    if (setup === 'error') {
      const error = apiError('Your account is not connected to a profile', 403);
      req.flush(error.body, error.options);
    } else {
      req.flush(setup);
    }
    await page.settle();
  }

  const value = (selector: string) =>
    page.query<HTMLInputElement | HTMLSelectElement>(selector)!.value;

  function expectPost() {
    const req = http.expectOne('/api/account-setup');
    expect(req.request.method).toBe('POST');
    return req;
  }

  it('fills the form with what the admin entered, and never shows a nickname', async () => {
    await open();

    expect(value('#account-setup-name')).toBe('Ivan Petrov');
    expect(value('#account-setup-email')).toBe('Ivan@Example.com');
    expect(value('#account-setup-phone')).toBe('0888 111 222');
    expect(value('#account-setup-gym-subscription')).toBe('gs-1');
    expect(value('#account-setup-home-gym')).toBe('gym-2');
    expect(value('#account-setup-instagram')).toBe('@ivan');
    expect(
      page.query<HTMLInputElement>('#account-setup-consent')!.checked,
    ).toBe(false);
    expect(page.query('#account-setup-password')).not.toBeNull();
    expect(page.query('[id*="nickname"]')).toBeNull();
    expect(page.text()).toContain(en.accountSetup.introPassword);
  });

  it('sends nothing without a new password or the consent, and says why', async () => {
    await open();
    await page.submit();

    http.expectNone('/api/account-setup');
    expect(page.text()).toContain(en.register.passwordRequired);
    expect(page.text()).toContain(en.register.confirmRequired);
    expect(page.text()).toContain(en.accountSetup.consentRequired);
  });

  it('sends nothing when the passwords differ', async () => {
    await open();
    await page.type('#account-setup-password', 'my-own-pass');
    await page.type('#account-setup-confirm', 'my-own-pasS');
    await page.check('#account-setup-consent', true);
    await page.submit();

    http.expectNone('/api/account-setup');
    expect(page.text()).toContain(en.register.mismatch);
  });

  it('sends the whole form, stores the new token and goes to the trainee profile', async () => {
    await open();
    await page.type('#account-setup-name', ' Ivan G. Petrov ');
    await page.type('#account-setup-email', ' ivan@example.com ');
    await page.type('#account-setup-password', 'my-own-pass');
    await page.type('#account-setup-confirm', 'my-own-pass');
    await page.type('#account-setup-phone', ' +359 88 999 000 ');
    await page.select('#account-setup-gym-subscription', '');
    await page.type('#account-setup-instagram', '  ');
    await page.check('#account-setup-consent', true);
    await page.submit();

    const req = expectPost();
    expect(req.request.body).toEqual({
      email: 'ivan@example.com',
      name: 'Ivan G. Petrov',
      password: 'my-own-pass',
      confirmPassword: 'my-own-pass',
      phone: '+359 88 999 000',
      gymSubscriptionId: null,
      homeGymId: 'gym-2',
      instagram: null,
      facebook: null,
      tiktok: null,
      acceptTerms: true,
    });
    const token = makeToken({
      sub: 'account-trainee',
      role: 'TRAINEE',
      setupRequired: false,
    });
    req.flush({ accessToken: token, account: {} });
    await page.settle();

    expect(localStorage.getItem('accessToken')).toBe(token);
    expect(router.url).toBe('/my-profile');
  });

  it('a trainer: no gym subscription, the primary gym, and the dashboard after saving', async () => {
    await open(
      {
        ...TRAINEE_SETUP,
        profileType: 'trainer',
        gymSubscriptionId: null,
        homeGymId: 'gym-1',
      },
      'TRAINER',
    );
    expect(page.query('#account-setup-gym-subscription')).toBeNull();
    expect(page.text()).toContain(en.contact.primaryGym);

    await page.type('#account-setup-password', 'my-own-pass');
    await page.type('#account-setup-confirm', 'my-own-pass');
    await page.check('#account-setup-consent', true);
    await page.submit();

    const req = expectPost();
    expect(req.request.body).not.toHaveProperty('gymSubscriptionId');
    expect(req.request.body).toMatchObject({ homeGymId: 'gym-1' });
    req.flush({
      accessToken: makeToken({ role: 'TRAINER', setupRequired: false }),
      account: {},
    });
    await page.settle();

    expect(router.url).toBe('/home');
  });

  it('without a password to change (consent and details only): no password fields, none sent', async () => {
    await open({ ...TRAINEE_SETUP, passwordChangeRequired: false });

    expect(page.query('#account-setup-password')).toBeNull();
    expect(page.query('#account-setup-confirm')).toBeNull();
    expect(page.text()).toContain(en.accountSetup.introDetails);

    await page.check('#account-setup-consent', true);
    await page.submit();

    const req = expectPost();
    expect(req.request.body).not.toHaveProperty('password');
    expect(req.request.body).not.toHaveProperty('confirmPassword');
    req.flush({
      accessToken: makeToken({ role: 'TRAINEE', setupRequired: false }),
      account: {},
    });
    await page.settle();
    expect(router.url).toBe('/my-profile');
  });

  it("shows the API's message and stays when the save fails", async () => {
    await open();
    await page.type('#account-setup-password', 'my-own-pass');
    await page.type('#account-setup-confirm', 'my-own-pass');
    await page.check('#account-setup-consent', true);
    await page.submit();

    const error = apiError('Email is already used by another account', 409);
    expectPost().flush(error.body, error.options);
    await page.settle();

    expect(page.alert()).toBe('Email is already used by another account');
    expect(router.url).toBe('/account-setup');
  });

  it('sends a person whose token is already set up on to their start page', async () => {
    signInAs('TRAINEE', { setupRequired: false });
    await harness.navigateByUrl('/account-setup', AccountSetupComponent);
    page = driver(
      () => harness.routeNativeElement!,
      () => harness.fixture.whenStable(),
    );
    http.expectOne('/api/auth/register/options').flush(OPTIONS);
    http
      .expectOne('/api/account-setup')
      .flush({ ...TRAINEE_SETUP, setupRequired: false });
    await page.settle();

    expect(router.url).toBe('/my-profile');
  });

  it('signs out to the login page when the setup was finished elsewhere but the stored token still requires it', async () => {
    // With the real setupGuard on the start page: going there with this token would bounce back.
    router.resetConfig([
      { path: 'account-setup', component: AccountSetupComponent },
      { path: 'login', children: [] },
      { path: 'my-profile', canActivate: [setupGuard], children: [] },
      { path: '**', children: [] },
    ]);
    await open({ ...TRAINEE_SETUP, setupRequired: false });

    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(router.url).toBe('/login');
  });

  it('shows the load error with Try again, which asks again', async () => {
    await open('error');

    expect(page.alert()).toBe('Your account is not connected to a profile');
    await page.click('.form-actions .btn');
    http.expectOne('/api/account-setup').flush(TRAINEE_SETUP);
    await page.settle();
    expect(value('#account-setup-name')).toBe('Ivan Petrov');
  });

  it('signs out to the login page', async () => {
    await open();
    await page.click('.login__footer button');

    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(router.url).toBe('/login');
  });
});
