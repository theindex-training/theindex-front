import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import en from '../../../../public/i18n/en.json';
import { makeToken } from '../../../testing/jwt';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let http: HttpTestingController;
  let router: Router;
  let el: HTMLElement;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: '**', children: [] }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(LoginComponent);
    el = fixture.nativeElement;
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  async function type(id: string, value: string) {
    const input = el.querySelector<HTMLInputElement>(`#${id}`)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
  }

  async function submit() {
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  async function settle() {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }

  async function logInWith(claims: Record<string, unknown>) {
    await type('email', 'coach@gym.test');
    await type('password', 'secret-pass');
    await submit();
    http
      .expectOne('/api/auth/login')
      .flush({ accessToken: makeToken(claims), account: {} });
    await settle();
  }

  const text = () => el.textContent ?? '';

  it('sends nothing and shows both field errors when submitted empty', async () => {
    await submit();

    http.expectNone('/api/auth/login');
    expect(text()).toContain(en.auth.login.emailRequired);
    expect(text()).toContain(en.auth.login.passwordRequired);
  });

  it('requires a password of at least 3 characters', async () => {
    await type('email', 'coach@gym.test');
    await type('password', 'ab');
    await submit();

    http.expectNone('/api/auth/login');
    expect(text()).toContain(en.auth.login.passwordLength);
  });

  it('posts the email (case kept, spaces stripped by the email input) and the password as typed', async () => {
    await type('email', ' Coach@Gym.test ');
    await type('password', 'abc');
    await submit();

    const req = http.expectOne('/api/auth/login');
    expect(req.request.method).toBe('POST');
    // The component doesn't trim; <input type="email"> sanitizes its value, as browsers do.
    expect(req.request.body).toEqual({
      email: 'Coach@Gym.test',
      password: 'abc',
    });
    req.flush({ accessToken: makeToken({ role: 'ADMIN' }), account: {} });
  });

  it('skips the password check and sends an admin without an account id home', async () => {
    await logInWith({ role: 'ADMIN' });

    http.expectNone((req) => req.url.includes('password-status'));
    expect(router.url).toBe('/home');
  });

  it.each([
    ['TRAINER', '/home'],
    ['TRAINEE', '/my-profile'],
  ])(
    'sends a set-up %s to %s without asking about the password',
    async (role, url) => {
      await logInWith({ sub: 'account-1', role, setupRequired: false });

      http.expectNone((req) => req.url.includes('password-status'));
      expect(router.url).toBe(url);
    },
  );

  it.each(['TRAINER', 'TRAINEE'])(
    'sends a %s whose token requires the first-login setup to /account-setup',
    async (role) => {
      await logInWith({ sub: 'account-1', role, setupRequired: true });

      http.expectNone((req) => req.url.includes('password-status'));
      expect(router.url).toBe('/account-setup');
    },
  );

  it.each([
    [true, '/home'],
    [false, '/change-password'],
  ])('ADMIN with password changed = %s lands on %s', async (changed, url) => {
    await logInWith({ sub: 'account-1', role: 'ADMIN' });

    const req = http.expectOne('/api/accounts/account-1/password-status');
    expect(req.request.method).toBe('GET');
    req.flush({ accountId: 'account-1', hasUpdatedInitialPassword: changed });
    await settle();

    expect(router.url).toBe(url);
  });

  it('sends an admin home when the password check fails', async () => {
    await logInWith({ sub: 'account-1', role: 'ADMIN' });

    http
      .expectOne('/api/accounts/account-1/password-status')
      .flush(null, { status: 500, statusText: 'Server Error' });
    await settle();

    expect(router.url).toBe('/home');
  });

  describe('when sent here from a page that needs a sign-in (?returnUrl=)', () => {
    async function openWith(returnUrl: string) {
      await router.navigateByUrl(
        `/login?returnUrl=${encodeURIComponent(returnUrl)}`,
      );
      fixture = TestBed.createComponent(LoginComponent);
      el = fixture.nativeElement;
      await fixture.whenStable();
    }

    it.each(['TRAINER', 'TRAINEE'])(
      'takes a set-up %s to that page instead of their start page',
      async (role) => {
        await openWith('/schedule/s-1?week=2026-11-16');
        await logInWith({ sub: 'account-1', role, setupRequired: false });

        expect(router.url).toBe('/schedule/s-1?week=2026-11-16');
      },
    );

    it('passes the page on to the first-login setup', async () => {
      await openWith('/schedule/s-1');
      await logInWith({
        sub: 'account-1',
        role: 'TRAINEE',
        setupRequired: true,
      });

      expect(router.url).toBe('/account-setup?returnUrl=%2Fschedule%2Fs-1');
    });

    it('takes an admin to that page, and when the password check fails', async () => {
      await openWith('/settlements/s-1?tab=waiting');
      await logInWith({ sub: 'account-1', role: 'ADMIN' });
      http
        .expectOne('/api/accounts/account-1/password-status')
        .flush({ accountId: 'account-1', hasUpdatedInitialPassword: true });
      await settle();
      expect(router.url).toBe('/settlements/s-1?tab=waiting');

      await openWith('/trainees');
      await logInWith({ sub: 'account-1', role: 'ADMIN' });
      http
        .expectOne('/api/accounts/account-1/password-status')
        .flush(null, { status: 500, statusText: 'Server Error' });
      await settle();
      expect(router.url).toBe('/trainees');
    });

    it('still makes an admin with the seeded password change it first', async () => {
      await openWith('/trainees');
      await logInWith({ sub: 'account-1', role: 'ADMIN' });
      http
        .expectOne('/api/accounts/account-1/password-status')
        .flush({ accountId: 'account-1', hasUpdatedInitialPassword: false });
      await settle();

      expect(router.url).toBe('/change-password');
    });

    it('ignores an address outside the app', async () => {
      await openWith('//evil.example/home');
      await logInWith({ sub: 'account-1', role: 'TRAINEE' });

      expect(router.url).toBe('/my-profile');
    });

    it('does not pass the page on to Create an account', async () => {
      await openWith('/trainees');

      expect(el.querySelector('.login__footer a')!.getAttribute('href')).toBe(
        '/register',
      );
    });
  });

  describe('when the login fails', () => {
    async function failWith(body: object | null, status = 401) {
      await type('email', 'coach@gym.test');
      await type('password', 'wrong-pass');
      await submit();
      http
        .expectOne('/api/auth/login')
        .flush(body, { status, statusText: 'Error' });
      await settle();
    }

    const alert = () => el.querySelector('[role="alert"]')?.textContent?.trim();

    it('shows the API message and stores no token', async () => {
      await failWith({ message: 'Invalid credentials' });

      expect(alert()).toBe('Invalid credentials');
      expect(localStorage.getItem('accessToken')).toBeNull();
      expect(router.url).toBe('/');
    });

    it('explains, in the chosen language, that a 403 means the account waits to be connected', async () => {
      await failWith(
        { message: 'Your account is not connected to a profile yet.' },
        403,
      );

      expect(alert()).toBe(en.auth.login.notLinked);
      expect(localStorage.getItem('accessToken')).toBeNull();
      expect(router.url).toBe('/');
    });

    it('joins a list of API messages', async () => {
      await failWith({
        message: ['email must be an email', 'password is too short'],
      });

      expect(alert()).toBe('email must be an email, password is too short');
    });

    it('falls back to a generic message when the API sends none', async () => {
      await failWith(null);

      expect(alert()).toBe(en.auth.login.error);
    });

    it('lets the user try again with a second request', async () => {
      await failWith({ message: 'Invalid credentials' });
      await submit();

      http
        .expectOne('/api/auth/login')
        .flush({ accessToken: makeToken({ role: 'ADMIN' }) });
      await settle();
      expect(router.url).toBe('/home');
      expect(alert()).toBeUndefined();
    });
  });

  it('links to the register page for people without an account', () => {
    const link = Array.from(el.querySelectorAll('a')).find(
      (a) => a.textContent?.trim() === en.auth.login.createAccount,
    );
    expect(link?.getAttribute('href')).toBe('/register');
  });

  it('sends a second login request when submitted twice before the first answers', async () => {
    await type('email', 'coach@gym.test');
    await type('password', 'secret-pass');
    await submit();
    await submit();

    // CHARACTERIZATION: possibly unintended — the submit button is never disabled while signing in
    // (isSubmitting is not used in the template), so a double click logs in twice. TEST_NOTES.md S13.
    const requests = http.match('/api/auth/login');
    expect(requests.length).toBe(2);
    requests.forEach((req) =>
      req.flush({ accessToken: makeToken({ role: 'ADMIN' }) }),
    );
    await settle();
  });
});
